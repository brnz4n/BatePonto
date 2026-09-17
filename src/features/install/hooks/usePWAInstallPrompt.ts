import { useState, useEffect } from 'react'

export interface PWAInstallState {
  isStandalone: boolean
  isIos: boolean
  isAndroid: boolean
  canPromptNative: boolean
  promptToInstall: () => Promise<void>
}

export function usePWAInstallPrompt() {
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null)
  const [isStandalone, setIsStandalone] = useState<boolean>(false)
  const [isIos, setIsIos] = useState<boolean>(false)
  const [isAndroid, setIsAndroid] = useState<boolean>(false)

  useEffect(() => {
    // Verifica se já está rodando como app instalado (PWA Standalone)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    setIsStandalone(isStandaloneMode)

    // Detecção de plataforma através de User Agent
    const userAgent = window.navigator.userAgent.toLowerCase()
    const iosDevice = /iphone|ipad|ipod/.test(userAgent)
    const androidDevice = /android/.test(userAgent)

    setIsIos(iosDevice)
    setIsAndroid(androidDevice)

    // Captura evento beforeinstallprompt (Android / Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPromptEvent(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const promptToInstall = async () => {
    if (installPromptEvent) {
      await installPromptEvent.prompt()
      const choice = await installPromptEvent.userChoice
      if (choice.outcome === 'accepted') {
        setInstallPromptEvent(null)
      }
    }
  }

  return {
    isStandalone,
    isIos,
    isAndroid,
    canPromptNative: !!installPromptEvent,
    promptToInstall,
  }
}
