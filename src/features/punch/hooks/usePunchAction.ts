import { useState, useCallback } from 'react'
import { db } from '../../sync/db/localDb'
import { punchPayloadSchema } from '../schemas/punch.schema'
import { checkVelocityAnomaly } from '../../../shared/utils/antiFraud'
import type { LocalPunchRecord, PunchType } from '../types/punch.types'
import { triggerConfetti } from '../../../shared/utils/confetti'

interface UsePunchActionProps {
  userId: string
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
      setIsPunching(true)
      setErrorMessage(null)

      try {
        const punchId = crypto.randomUUID()
        const clientIso = new Date().toISOString()
        const performanceNow = performance.now()
        const isOffline = !navigator.onLine

        const effectivePunchType = customType || nextPunchType

        // Captura geolocalização com alta precisão (não-bloqueante / soft-audit)
        const geoResult = await getPosition()

        // Verificação de anomalia de velocidade com o último ponto registrado
        let teleportationSuspect = false
        let calculatedSpeedKmh: number | undefined

        if (geoResult.coords && todayPunches.length > 0) {
          const lastPunchWithCoords = [...todayPunches]
            .reverse()
            .find((p) => p.coords?.latitude && p.coords?.longitude)

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

        const rawPayload = {
          id: punchId,
          userId,
          punchType: effectivePunchType,
          clientTimestamp: clientIso,
          performanceNow,
          coords: geoResult.coords,
          isOffline,
          auditMetadata: {
            isMockSuspect: geoResult.isMockSuspect,
            mockReason: geoResult.mockReason,
            teleportationSuspect,
            calculatedSpeedKmh,
            geoError: geoResult.error,
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

        // Gravação local imediata no IndexedDB
        await db.punches.add(newRecord)

        // Atualiza linha do tempo local imediatamente
        await refreshTodayPunches()

        // Se for saída de almoço, dispara agendamento de notificação
        if (effectivePunchType === 'SAIDA_INTERVALO' && onLunchRegistered) {
          onLunchRegistered(clientIso)
        }

        // Feedback háptico em smartphones que suportam Vibration API
        if ('vibrate' in navigator) {
          navigator.vibrate([40, 60, 40])
        }

        // Efeito de celebração visual com confetes nativos
        triggerConfetti()

        onSuccess(newRecord)

        // Se houver conexão, dispara sincronização assíncrona em background
        if (navigator.onLine) {
          triggerSync().catch(() => {
            // Falhas de rede serão resolvidas pelo SyncManager
          })
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Falha ao registrar ponto')
      } finally {
        setIsPunching(false)
      }
    },
    [
      isPunching,
      userId,
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
