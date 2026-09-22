import React, { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, ShieldOff } from 'lucide-react'

interface SyncFailureBannerProps {
  failedCount: number
  onRetry: () => Promise<void>
  isCircuitOpen?: boolean
  circuitOpenUntil?: number | null
}

export const SyncFailureBanner: React.FC<SyncFailureBannerProps> = ({
  failedCount,
  onRetry,
  isCircuitOpen,
  circuitOpenUntil,
}) => {
  const [isRetrying, setIsRetrying] = useState(false)
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null)

  // Contagem regressiva derivada num efeito (Date.now() fica fora do corpo do render) — sem
  // isso o texto "nova tentativa em até Xmin" ficaria congelado no valor calculado na 1ª render.
  useEffect(() => {
    if (!isCircuitOpen || !circuitOpenUntil) {
      setMinutesLeft(null)
      return
    }

    const updateMinutesLeft = () => {
      setMinutesLeft(Math.max(1, Math.ceil((circuitOpenUntil - Date.now()) / 60000)))
    }

    updateMinutesLeft()
    const interval = setInterval(updateMinutesLeft, 15000)
    return () => clearInterval(interval)
  }, [isCircuitOpen, circuitOpenUntil])

  if (isCircuitOpen) {
    return (
      <div className="flex items-center gap-2 p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-xs text-amber-200">
        <ShieldOff className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="leading-snug">
          Sincronização pausada temporariamente após falhas seguidas do servidor
          {minutesLeft ? ` — nova tentativa em até ${minutesLeft} min` : ''}. Seus pontos continuam salvos neste dispositivo.
        </span>
      </div>
    )
  }

  if (failedCount <= 0) return null

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await onRetry()
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="leading-snug">
          {failedCount} registro{failedCount > 1 ? 's' : ''} não sincronizado{failedCount > 1 ? 's' : ''} após várias tentativas.
        </span>
      </div>
      <button
        onClick={handleRetry}
        disabled={isRetrying}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-900/70 hover:bg-red-900 border border-red-700/60 rounded-lg font-semibold text-red-100 shrink-0 transition-colors disabled:opacity-60 cursor-pointer"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
        Tentar Novamente
      </button>
    </div>
  )
}
