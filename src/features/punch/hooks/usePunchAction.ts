import { useState, useCallback } from 'react'
import { db } from '../../sync/db/localDb'
import { punchPayloadSchema } from '../schemas/punch.schema'
import { checkVelocityAnomaly } from '../../../shared/utils/antiFraud'
import { checkGeofence } from '../../../shared/utils/geofence'
import type { LocalPunchRecord, PunchType } from '../types/punch.types'

interface UsePunchActionProps {
  userId: string
  colaboradorId: string | undefined
  nextPunchType: PunchType
  todayPunches: LocalPunchRecord[]
  onSuccess: (record: LocalPunchRecord) => void
  triggerSync: () => Promise<void>
  refreshTodayPunches: () => Promise<void>
  getPosition: () => Promise<{
    coords?: { latitude: number; longitude: number; accuracy: number }
    isMockSuspect: boolean
    mockReason?: string
    error?: string
  }>
  onLunchRegistered?: (timestamp: string) => void
}

export function usePunchAction({
  userId,
  colaboradorId,
  nextPunchType,
  todayPunches,
  onSuccess,
  triggerSync,
  refreshTodayPunches,
  getPosition,
  onLunchRegistered,
}: UsePunchActionProps) {
  const [isPunching, setIsPunching] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const executePunch = useCallback(
    async (customType?: PunchType, justification?: string) => {
      if (isPunching) return

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

        const rawPayload = {
          id: punchId,
          userId,
          colaboradorId,
          punchType: effectivePunchType,
          clientTimestamp: clientIso,
          performanceNow,
          isOffline,
          auditMetadata: {
            userAgent: navigator.userAgent,
            isManualOverride: !!customType,
            originalDeducedType: customType ? nextPunchType : undefined,
            justification: justification || undefined,
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
        await refreshTodayPunches()

        if (effectivePunchType === 'SAIDA_INTERVALO' && onLunchRegistered) {
          onLunchRegistered(clientIso)
        }

        if ('vibrate' in navigator) {
          navigator.vibrate(200)
        }

        onSuccess(newRecord)
        setIsPunching(false)

        // Geolocalização + geofencing + antifraude rodam em background e só então
        // disparam a sincronização — não bloqueiam a confirmação da batida (soft-audit).
        attachGeoDataInBackground(punchId, clientIso, todayPunches, getPosition, refreshTodayPunches, triggerSync)
      } catch (err: any) {
        setErrorMessage(err?.message || 'Falha ao registrar ponto')
        setIsPunching(false)
      }
    },
    [
      isPunching,
      userId,
      colaboradorId,
      nextPunchType,
      todayPunches,
      getPosition,
      refreshTodayPunches,
      onLunchRegistered,
      onSuccess,
      triggerSync,
    ]
  )

  return {
    executePunch,
    isPunching,
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

    let isOutOfBounds: boolean | undefined
    let distanceFromHqMeters: number | undefined

    if (geoResult.coords) {
      const geofence = checkGeofence(geoResult.coords.latitude, geoResult.coords.longitude)
      isOutOfBounds = !geofence.isWithinBounds
      distanceFromHqMeters = geofence.distanceMeters
    }

    let teleportationSuspect = false
    let calculatedSpeedKmh: number | undefined

    if (geoResult.coords && previousPunches.length > 0) {
      const lastPunchWithCoords = [...previousPunches].reverse().find((p) => p.coords?.latitude && p.coords?.longitude)

      if (lastPunchWithCoords?.coords) {
        const anomaly = checkVelocityAnomaly(
          {
            lat: lastPunchWithCoords.coords.latitude,
            lng: lastPunchWithCoords.coords.longitude,
            timestamp: new Date(lastPunchWithCoords.clientTimestamp).getTime(),
          },
          {
            lat: geoResult.coords.latitude,
            lng: geoResult.coords.longitude,
            timestamp: new Date(clientIso).getTime(),
          }
        )
        teleportationSuspect = anomaly.isAnomaly
        calculatedSpeedKmh = anomaly.speedKmh
      }
    }

    const existing = await db.punches.get(punchId)
    if (!existing) return // registro pode ter sido removido (ex: override) antes do GPS resolver

    await db.punches.update(punchId, {
      coords: geoResult.coords,
      auditMetadata: {
        ...existing.auditMetadata,
        isMockSuspect: geoResult.isMockSuspect,
        mockReason: geoResult.mockReason,
        teleportationSuspect,
        calculatedSpeedKmh,
        geoError: geoResult.error,
        isOutOfBounds,
        distanceFromHqMeters,
      },
    })

    await refreshTodayPunches()
  } finally {
    if (navigator.onLine) {
      triggerSync().catch(() => {
        // Falhas de rede serão resolvidas pelo SyncManager
      })
    }
  }
}
