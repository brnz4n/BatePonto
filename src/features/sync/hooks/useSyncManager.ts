import { useState, useEffect, useCallback } from 'react'
import { processSyncQueue } from '../services/syncQueueService'
import { getPendingPunchesCount } from '../db/localDb'

export function useSyncManager() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingPunchesCount()
      setPendingCount(count)
    } catch {
      // Ignora erro de leitura em caso de inicialização rápida
    }
  }, [])

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncInProgressFlag) return
    setIsSyncing(true)
    try {
      await processSyncQueue()
      await refreshPendingCount()
      setLastSyncTime(new Date())
    } finally {
      setIsSyncing(false)
    }
  }, [refreshPendingCount])

  useEffect(() => {
    refreshPendingCount()

    const handleOnline = () => {
      setIsOnline(true)
      triggerSync()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Intervalo de verificação a cada 15 segundos se houver pendências
    const interval = setInterval(() => {
      refreshPendingCount()
      if (navigator.onLine) {
        triggerSync()
      }
    }, 15000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [refreshPendingCount, triggerSync])

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    triggerSync,
    refreshPendingCount,
  }
}

let isSyncInProgressFlag = false
