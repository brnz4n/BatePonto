import { useState, useEffect, useCallback } from 'react'

const LUNCH_REMINDER_STORAGE_KEY = 'atlas_ponto_lunch_reminder'
const FIFTY_MINUTES_MS = 50 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000
const MAX_LUNCH_REMINDER_AGE_MS = 90 * 60 * 1000

interface LunchReminderState {
  startTimestamp: string
  notifiedFifty: boolean
  notifiedSixty: boolean
}

function readLunchReminder(): LunchReminderState | null {
  try {
    const raw = localStorage.getItem(LUNCH_REMINDER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeLunchReminder(state: LunchReminderState | null): void {
  try {
    if (state) localStorage.setItem(LUNCH_REMINDER_STORAGE_KEY, JSON.stringify(state))
    else localStorage.removeItem(LUNCH_REMINDER_STORAGE_KEY)
  } catch {
    // Storage indisponível (modo privado, quota etc.) — segue sem persistência
  }
}

function notifyIfGranted(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification(title, { body, icon: '/pwa-192x192.png' })
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
}

/**
 * iOS/Android suspendem setTimeout com a tela bloqueada ou o app em segundo plano — os
 * lembretes agendados por scheduleLunchReminder podem nunca disparar nesse cenário. Ao
 * reabrir/desbloquear a tela (`visibilitychange`), recuperamos o horário salvo no localStorage
 * (sobrevive até a um fechamento completo do app) e disparamos na hora qualquer lembrete que já
 * devia ter tocado. Os próprios setTimeout continuam existindo como caminho "feliz" quando o
 * app segue em primeiro plano — os dois caminhos convergem aqui e são idempotentes.
 */
function checkPendingLunchReminder(): void {
  const state = readLunchReminder()
  if (!state) return

  const startTime = new Date(state.startTimestamp).getTime()
  const now = Date.now()

  // Se o intervalo já passou há mais de 1h30 (ex: app reaberto horas depois ou no dia seguinte),
  // descarta o lembrete caduco silenciosamente sem disparar notificações obsoletas.
  if (now > startTime + MAX_LUNCH_REMINDER_AGE_MS) {
    writeLunchReminder(null)
    return
  }

  if (!state.notifiedFifty && now >= startTime + FIFTY_MINUTES_MS) {
    notifyIfGranted(
      'Intervalo Quase Encerrado!',
      'Faltam 10 minutos para completar 1 hora de almoço. Prepare-se para bater o retorno.'
    )
    state.notifiedFifty = true
  }

  if (!state.notifiedSixty && now >= startTime + ONE_HOUR_MS) {
    notifyIfGranted(
      'Fim do Intervalo de Almoço',
      'Seu intervalo legal de 1h foi cumprido. Abra o Atlas Ponto para registrar o retorno!'
    )
    state.notifiedSixty = true
  }

  writeLunchReminder(state.notifiedFifty && state.notifiedSixty ? null : state)
}

export function useNotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [isSupported, setIsSupported] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)
    }
  }, [])

  // Cobre o caso "app estava fechado/suspenso quando o lembrete deveria ter tocado": ao montar
  // a tela e sempre que ela volta a ficar visível, verifica se algum lembrete pendente venceu.
  useEffect(() => {
    checkPendingLunchReminder()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkPendingLunchReminder()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        new Notification('Atlas Ponto — Notificações Ativadas', {
          body: 'Você receberá lembretes inteligentes para registrar o almoço e a saída.',
          icon: '/pwa-192x192.png',
        })
        return true
      }
      return false
    } catch {
      return false
    }
  }, [])

  const scheduleLunchReminder = useCallback((lunchStartTimestamp: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    // Persiste o horário de início do almoço — é essa cópia no localStorage (não os timers
    // abaixo) que sobrevive a um app suspenso/fechado e permite recuperar o lembrete perdido.
    writeLunchReminder({ startTimestamp: lunchStartTimestamp, notifiedFifty: false, notifiedSixty: false })

    const startTime = new Date(lunchStartTimestamp).getTime()
    const now = Date.now()
    const delay50 = Math.max(0, startTime + FIFTY_MINUTES_MS - now)
    const delay60 = Math.max(0, startTime + ONE_HOUR_MS - now)

    // Caminho "feliz": com o app em primeiro plano, dispara no segundo exato. Chama o checker
    // idempotente em vez de notificar direto, para nunca duplicar com o disparo via
    // visibilitychange caso os dois caminhos coincidam.
    setTimeout(checkPendingLunchReminder, delay50)
    setTimeout(checkPendingLunchReminder, delay60)
  }, [])

  const cancelLunchReminder = useCallback(() => {
    writeLunchReminder(null)
  }, [])

  return {
    isSupported,
    permission,
    isGranted: permission === 'granted',
    requestPermission,
    scheduleLunchReminder,
    cancelLunchReminder,
  }
}
