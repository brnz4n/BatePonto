import { useState, useEffect, useCallback } from 'react'

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

    const startTime = new Date(lunchStartTimestamp).getTime()
    const now = Date.now()
    const fiftyMinutesMs = 50 * 60 * 1000
    const oneHourMs = 60 * 60 * 1000

    const delay50 = Math.max(0, startTime + fiftyMinutesMs - now)
    const delay60 = Math.max(0, startTime + oneHourMs - now)

    // Lembrete de 50 minutos (aviso prévio de 10 min)
    if (delay50 > 0) {
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('Intervalo Quase Encerrado!', {
            body: 'Faltam 10 minutos para completar 1 hora de almoço. Prepare-se para bater o retorno.',
            icon: '/pwa-192x192.png',
          })
        }
      }, delay50)
    }

    // Lembrete de 60 minutos (horário legal atingido)
    if (delay60 > 0) {
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('Fim do Intervalo de Almoço', {
            body: 'Seu intervalo legal de 1h foi cumprido. Abra o Atlas Ponto para registrar o retorno!',
            icon: '/pwa-192x192.png',
          })
        }
      }, delay60)
    }
  }, [])

  return {
    isSupported,
    permission,
    isGranted: permission === 'granted',
    requestPermission,
    scheduleLunchReminder,
  }
}
