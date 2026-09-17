import { useState, useEffect, useCallback } from 'react'
import { processSyncQueue } from '../services/syncQueueService'
import {
  getPendingPunchesCount,
  getFailedPunchesCount,
  getPausedAuthPunchesCount,
  retryFailedPunches,
} from '../db/localDb'

export function useSyncManager() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [failedCount, setFailedCount] = useState<number>(0)
  const [pausedAuthCount, setPausedAuthCount] = useState<number>(0)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  const refreshCounts = useCallback(async () => {
    try {
      const [pending, failed, pausedAuth] = await Promise.all([
        getPendingPunchesCount(),
        getFailedPunchesCount(),
        getPausedAuthPunchesCount(),
      ])
      setPendingCount(pending)
      setFailedCount(failed)
      setPausedAuthCount(pausedAuth)
    } catch {
      // Ignora erro de leitura em caso de inicialização rápida
    }
  }, [])

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) return
    setIsSyncing(true)

    try {
      await processSyncQueue()
      await refreshCounts()
      setLastSyncTime(new Date())
    } finally {
      setIsSyncing(false)
    }
  }, [refreshCounts])

  const retryFailed = useCallback(async () => {
    await retryFailedPunches()
    await refreshCounts()
    await triggerSync()
  }, [refreshCounts, triggerSync])

  useEffect(() => {
    refreshCounts()

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
      refreshCounts()
      if (navigator.onLine) {
        triggerSync()
      }
    }, 15000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [refreshCounts, triggerSync])

  return {
    isOnline,
    pendingCount,
    failedCount,
    pausedAuthCount,
    isSyncing,
    lastSyncTime,
    triggerSync,
    retryFailed,
    refreshPendingCount: refreshCounts,
  }
}
