import { useEffect, useRef } from 'react'
import {
  detectExpectedSchedule,
  ENTRY_REMINDER_TOLERANCE_MINUTES,
  EXIT_REMINDER_TOLERANCE_MINUTES,
  type ExpectedScheduleHeuristic,
} from '../services/scheduleHeuristics'
import { getPunchesInRange } from '../../sync/db/localDb'
import { fetchRemotePunches, mergePunches } from '../../history/services/historyDataService'

// Reavalia a cada 5 minutos enquanto o app estiver aberto — não é um alarme real com a tela
// travada (isso exigiria Web Push + Service Worker + backend), mas cobre o caso comum de o
// colaborador deixar o PWA aberto ou reabri-lo em algum momento do expediente.
const CHECK_INTERVAL_MS = 5 * 60 * 1000

function todayRangeIso(): { startIso: string; endIso: string } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

/** Evita repetir o mesmo lembrete várias vezes no mesmo dia a cada checagem de 5 minutos. */
function notifyOnce(storageKey: string, title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const today = new Date().toDateString()
  const dedupeKey = `atlas-ponto:${storageKey}`
  if (localStorage.getItem(dedupeKey) === today) return

  new Notification(title, { body, icon: '/pwa-192x192.png' })
  localStorage.setItem(dedupeKey, today)
}

export function useSmartPunchReminder(userId: string | undefined, isNotificationGranted: boolean): void {
  const scheduleRef = useRef<ExpectedScheduleHeuristic | null>(null)

  useEffect(() => {
    scheduleRef.current = null
    if (!userId || !isNotificationGranted) return

    let cancelled = false
    detectExpectedSchedule(userId).then((schedule) => {
      if (!cancelled) scheduleRef.current = schedule
    })

    return () => {
      cancelled = true
    }
  }, [userId, isNotificationGranted])

  useEffect(() => {
    if (!userId || !isNotificationGranted) return

    const checkSchedule = async () => {
      const schedule = scheduleRef.current
      if (!schedule || !schedule.workWeekdays.includes(new Date().getDay())) return

      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()

      const { startIso, endIso } = todayRangeIso()
      const localRecords = await getPunchesInRange(userId, startIso, endIso)
      let todayPunches = localRecords
      try {
        const remoteRecords = await fetchRemotePunches(userId, startIso, endIso)
        todayPunches = mergePunches(remoteRecords, localRecords)
      } catch {
        // Sem rede: segue só com o que já está no dispositivo
      }

      const hasEntrada = todayPunches.some((p) => p.punchType === 'ENTRADA')
      const hasSaida = todayPunches.some((p) => p.punchType === 'SAIDA')

      if (!hasEntrada && nowMinutes >= schedule.expectedEntryMinutes + ENTRY_REMINDER_TOLERANCE_MINUTES) {
        notifyOnce(
          'reminder-entrada',
          'Lembrete de Ponto - Atlas Ponto',
          'Não identificamos sua Entrada hoje. Lembrou de bater o ponto?'
        )
        return
      }

      if (
        schedule.expectedExitMinutes != null &&
        hasEntrada &&
        !hasSaida &&
        nowMinutes >= schedule.expectedExitMinutes + EXIT_REMINDER_TOLERANCE_MINUTES
      ) {
        notifyOnce(
          'reminder-saida',
          'Lembrete de Ponto - Atlas Ponto',
          'Seu horário habitual de saída já passou. Não esqueça de bater o ponto antes de encerrar o dia.'
        )
      }
    }

    checkSchedule()
    const interval = setInterval(checkSchedule, CHECK_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkSchedule()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [userId, isNotificationGranted])
}
