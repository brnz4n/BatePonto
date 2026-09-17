import React from 'react'
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'

interface SyncBadgeProps {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  onManualSync: () => void
}

export const SyncBadge: React.FC<SyncBadgeProps> = ({
  isOnline,
  isSyncing,
  pendingCount,
  onManualSync,
}) => {
  if (!isOnline) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 border border-amber-800/60 text-amber-300 rounded-full text-xs font-medium"
        title="Dispositivo sem conexão. Os pontos estão sendo salvos localmente e serão sincronizados automaticamente."
      >
        <WifiOff className="w-3.5 h-3.5 text-amber-400" />
        <span>Offline {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-950/60 border border-sky-800/60 text-sky-300 rounded-full text-xs font-medium">
        <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
        <span>Sincronizando...</span>
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <button
        onClick={onManualSync}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 border border-amber-700/60 hover:bg-amber-900/60 text-amber-300 rounded-full text-xs font-medium transition-colors cursor-pointer"
        title="Clique para sincronizar os registros pendentes agora"
      >
        <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
        <span>{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
      </button>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/50 border border-emerald-800/50 text-emerald-300 rounded-full text-xs font-medium"
      title="Conectado e todos os pontos sincronizados na nuvem"
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      <span className="hidden sm:inline">Conectado</span>
      <Wifi className="w-3 h-3 text-emerald-400 sm:hidden" />
    </div>
  )
}
