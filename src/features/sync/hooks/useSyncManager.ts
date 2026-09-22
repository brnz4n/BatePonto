import { useState, useEffect, useCallback } from 'react'
import { processSyncQueue, getCircuitBreakerStatus, resetCircuitBreaker } from '../services/syncQueueService'
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
  const [circuitOpenUntil, setCircuitOpenUntil] = useState<number | null>(null)
  const [isCircuitOpen, setIsCircuitOpen] = useState<boolean>(false)

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

  const triggerSync = useCallback(async (forceResetCircuit = false) => {
    if (!navigator.onLine) return
    if (forceResetCircuit) {
      resetCircuitBreaker()
    }
    setIsSyncing(true)

    try {
      await processSyncQueue()
      await refreshCounts()
      setLastSyncTime(new Date())
      setCircuitOpenUntil(getCircuitBreakerStatus().openUntil)
    } finally {
      setIsSyncing(false)
    }
  }, [refreshCounts])

  const retryFailed = useCallback(async () => {
    resetCircuitBreaker()
    await retryFailedPunches()
    await refreshCounts()
    await triggerSync(true)
  }, [refreshCounts, triggerSync])

  // `isCircuitOpen` precisa expirar sozinho quando o cooldown passa, mesmo sem nenhuma outra
  // sincronização disparar um re-render — por isso vira estado próprio, atualizado num efeito
  // (Date.now() fora do corpo do render) em vez de recalculado impuramente a cada render.
  useEffect(() => {
    if (circuitOpenUntil == null) {
      setIsCircuitOpen(false)
      return
    }

    const remainingMs = circuitOpenUntil - Date.now()
    if (remainingMs <= 0) {
      setIsCircuitOpen(false)
      return
    }

    setIsCircuitOpen(true)
    const timer = setTimeout(() => setIsCircuitOpen(false), remainingMs)
    return () => clearTimeout(timer)
  }, [circuitOpenUntil])

  useEffect(() => {
    refreshCounts()

    const handleOnline = () => {
      setIsOnline(true)
      // A rede voltou de verdade — o disjuntor pode ter sido armado durante a queda, mas o
      // motivo dele (falha de rede) acabou de ser resolvido. Sem isso, o colaborador ficaria
      // até 5 minutos sem sincronizar automaticamente mesmo com o Wi-Fi/4G já de volta.
      resetCircuitBreaker()
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
    isCircuitOpen,
    circuitOpenUntil,
    triggerSync,
    retryFailed,
    refreshPendingCount: refreshCounts,
  }
}
