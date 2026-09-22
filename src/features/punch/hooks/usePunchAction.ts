import { useState, useCallback, useEffect, useRef } from 'react'
import { db } from '../../sync/db/localDb'
import { punchPayloadSchema } from '../schemas/punch.schema'
import { checkVelocityAnomaly } from '../../../shared/utils/antiFraud'
import { checkGeofence } from '../../../shared/utils/geofence'
import { appendBlock } from '../services/blockchainLedger'
import type { LocalPunchRecord, PunchCoordinates, PunchType } from '../types/punch.types'
import type { GeolocationState } from '../../../shared/hooks/useGeolocation'

interface UsePunchActionProps {
  userId: string
  colaboradorId: string | undefined
  nextPunchType: PunchType
  todayPunches: LocalPunchRecord[]
  onSuccess: (record: LocalPunchRecord) => void
  triggerSync: () => Promise<void>
  refreshTodayPunches: () => Promise<void>
  geolocation: GeolocationState
  getPosition: () => Promise<{
    coords?: PunchCoordinates
    isMockSuspect: boolean
    mockReason?: string
    error?: string
  }>
  onLunchRegistered?: (timestamp: string) => void
  onCancelLunchReminder?: () => void
}

// Coordenada em cache mais velha que isso é descartada do registro imediato: preferimos deixar
// o refinamento em segundo plano preencher depois a gravar uma localização desatualizada (ex:
// colaborador deixou o PWA aberto no bolso por vários minutos entre abrir a tela e bater o ponto).
const MAX_CACHED_COORDS_AGE_MS = 2 * 60 * 1000

// Após uma batida bem-sucedida, `isPunching` volta a `false` quase instantaneamente (a gravação
// no Dexie é local e rápida) — sem essa trava extra, um segundo toque por hábito logo em
// seguida já registraria a PRÓXIMA marcação da sequência, não um "clique duplo" óbvio de notar.
const POST_SUCCESS_COOLDOWN_MS = 1000

interface GeoAuditFields {
  isOutOfBounds?: boolean
  distanceFromHqMeters?: number
  teleportationSuspect: boolean
  calculatedSpeedKmh?: number
}

function computeGeoAuditFields(
  coords: PunchCoordinates | undefined,
  previousPunches: LocalPunchRecord[],
  clientIso: string
): GeoAuditFields {
  if (!coords) return { teleportationSuspect: false }

  const geofence = checkGeofence(coords.latitude, coords.longitude)
  const lastPunchWithCoords = [...previousPunches].reverse().find((p) => p.coords?.latitude && p.coords?.longitude)

  let teleportationSuspect = false
  let calculatedSpeedKmh: number | undefined

  if (lastPunchWithCoords?.coords) {
    const anomaly = checkVelocityAnomaly(
      {
        lat: lastPunchWithCoords.coords.latitude,
        lng: lastPunchWithCoords.coords.longitude,
        timestamp: new Date(lastPunchWithCoords.clientTimestamp).getTime(),
      },
      { lat: coords.latitude, lng: coords.longitude, timestamp: new Date(clientIso).getTime() }
    )
    teleportationSuspect = anomaly.isAnomaly
    calculatedSpeedKmh = anomaly.speedKmh
  }

  return {
    isOutOfBounds: !geofence.isWithinBounds,
    distanceFromHqMeters: geofence.distanceMeters,
    teleportationSuspect,
    calculatedSpeedKmh,
  }
}

export function usePunchAction({
  userId,
  colaboradorId,
  nextPunchType,
  todayPunches,
  onSuccess,
  triggerSync,
  refreshTodayPunches,
  geolocation,
  getPosition,
  onLunchRegistered,
  onCancelLunchReminder,
}: UsePunchActionProps) {
  const [isPunching, setIsPunching] = useState<boolean>(false)
  const [isCoolingDown, setIsCoolingDown] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current)
    }
  }, [])

  const executePunch = useCallback(
    async (customType?: PunchType, justification?: string) => {
      if (isPunching || isCoolingDown) return

      // Sem colaborador_id não há como popular o AFD nem manter a integridade referencial —
      // bloqueia a batida em vez de gravar um registro que nunca vai aparecer na auditoria do RH.
      if (!colaboradorId) {
        setErrorMessage('Não foi possível identificar seu cadastro de colaborador. Recarregue o app e tente novamente.')
        return
      }

      setIsPunching(true)
      setErrorMessage(null)

      try {
        const punchId = crypto.randomUUID()
        const clientIso = new Date().toISOString()
        const performanceNow = performance.now()
        const isOffline = !navigator.onLine
        const effectivePunchType = customType || nextPunchType

        // Usa a posição já em cache (obtida ao abrir a tela) em vez de esperar um novo ciclo de
        // GPS: se o colaborador fechar o app logo após ver a confirmação, o ponto já sai gravado
        // com coordenadas em vez de ficar sem nenhum dado de auditoria.
        const isCacheFresh =
          !!geolocation.coords &&
          geolocation.fetchedAt != null &&
          Date.now() - geolocation.fetchedAt <= MAX_CACHED_COORDS_AGE_MS
        const cachedCoords = isCacheFresh ? geolocation.coords! : undefined
        const geoAudit = computeGeoAuditFields(cachedCoords, todayPunches, clientIso)

        const rawPayload = {
          id: punchId,
          userId,
          colaboradorId,
          punchType: effectivePunchType,
          clientTimestamp: clientIso,
          performanceNow,
          coords: cachedCoords,
          isOffline,
          auditMetadata: {
            userAgent: navigator.userAgent,
            isManualOverride: !!customType,
            originalDeducedType: customType ? nextPunchType : undefined,
            justification: justification || undefined,
            isMockSuspect: cachedCoords ? geolocation.isMockSuspect : undefined,
            mockReason: cachedCoords ? geolocation.mockReason : undefined,
            geoError: cachedCoords ? undefined : geolocation.error || undefined,
            ...geoAudit,
          },
        }

        // Validação Zod estrita
        const validation = punchPayloadSchema.safeParse(rawPayload)
        if (!validation.success) {
          throw new Error(`Dados inválidos para registro: ${validation.error.issues[0]?.message}`)
        }

        const newRecord: LocalPunchRecord = {
          ...rawPayload,
          syncStatus: 'pending',
          retryCount: 0,
        }

        // Gravação local imediata no IndexedDB — fricção zero: nada aqui espera o GPS.
        await db.punches.add(newRecord)

        // Encadeamento criptográfico (hash chaining) — grava o elo antes de liberar a UI para
        // que o comprovante já saia com prova de cronologia, mesmo offline.
        const block = await appendBlock({
          punchId: punchId,
          colaboradorId,
          punchType: effectivePunchType,
          timestampIso: clientIso,
          coords: cachedCoords,
        })
        newRecord.auditMetadata = {
          ...newRecord.auditMetadata,
          blockchain: { hash: block.hash, previousHash: block.previousHash, sequence: block.sequence },
        }
        await db.punches.update(punchId, { auditMetadata: newRecord.auditMetadata })

        await refreshTodayPunches()

        if (effectivePunchType === 'SAIDA_INTERVALO' && onLunchRegistered) {
          onLunchRegistered(clientIso)
        } else if (
          (effectivePunchType === 'RETORNO_INTERVALO' || effectivePunchType === 'SAIDA') &&
          onCancelLunchReminder
        ) {
          onCancelLunchReminder()
        }

        if ('vibrate' in navigator) {
          navigator.vibrate(200)
        }

        onSuccess(newRecord)
        setIsPunching(false)
        setIsCoolingDown(true)
        cooldownTimeoutRef.current = setTimeout(() => setIsCoolingDown(false), POST_SUCCESS_COOLDOWN_MS)

        // Mesmo já tendo gravado com a posição em cache, tenta uma leitura fresca em segundo
        // plano para refinar a precisão — sem bloquear a confirmação da batida (soft-audit).
        attachGeoDataInBackground(punchId, clientIso, todayPunches, getPosition, refreshTodayPunches, triggerSync)
      } catch (err: any) {
        setErrorMessage(err?.message || 'Falha ao registrar ponto')
        setIsPunching(false)
      }
    },
    [
      isPunching,
      isCoolingDown,
      userId,
      colaboradorId,
      nextPunchType,
      todayPunches,
      geolocation,
      getPosition,
      refreshTodayPunches,
      onLunchRegistered,
      onCancelLunchReminder,
      onSuccess,
      triggerSync,
    ]
  )

  return {
    executePunch,
    isPunching,
    isCoolingDown,
    errorMessage,
  }
}

async function attachGeoDataInBackground(
  punchId: string,
  clientIso: string,
  previousPunches: LocalPunchRecord[],
  getPosition: UsePunchActionProps['getPosition'],
  refreshTodayPunches: () => Promise<void>,
  triggerSync: () => Promise<void>
) {
  try {
    const geoResult = await getPosition()
    const existing = await db.punches.get(punchId)
    if (!existing) return // registro pode ter sido removido (ex: override) antes do GPS resolver

    if (geoResult.coords) {
      // Leitura fresca disponível: substitui (ou preenche pela primeira vez) a coordenada do
      // registro com uma medição mais precisa que a usada na gravação síncrona.
      const geoAudit = computeGeoAuditFields(geoResult.coords, previousPunches, clientIso)
      await db.punches.update(punchId, {
        coords: geoResult.coords,
        auditMetadata: {
          ...existing.auditMetadata,
          isMockSuspect: geoResult.isMockSuspect,
          mockReason: geoResult.mockReason,
          geoError: undefined,
          ...geoAudit,
        },
      })
    } else if (!existing.coords) {
      // Sem coordenada em cache e sem coordenada fresca: ao menos registra o motivo do erro.
      await db.punches.update(punchId, {
        auditMetadata: { ...existing.auditMetadata, geoError: geoResult.error },
      })
    }

    await refreshTodayPunches()
  } finally {
    if (navigator.onLine) {
      triggerSync().catch(() => {
        // Falhas de rede serão resolvidas pelo SyncManager
      })
    }
  }
}
