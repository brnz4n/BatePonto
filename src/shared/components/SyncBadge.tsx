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
        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-medium"
        title="Dispositivo sem conexão. Os pontos estão sendo salvos localmente e serão sincronizados automaticamente."
      >
        <WifiOff className="w-3.5 h-3.5 text-amber-600" />
        <span>Offline {pendingCount > 0 ? `(${pendingCount})` : ''}</span>
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 border border-sky-200 text-sky-700 rounded-full text-xs font-medium">
        <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin" />
        <span>Sincronizando...</span>
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <button
        onClick={onManualSync}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-700 rounded-full text-xs font-medium transition-colors cursor-pointer"
        title="Clique para sincronizar os registros pendentes agora"
      >
        <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
        <span>{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
      </button>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-medium"
      title="Conectado e todos os pontos sincronizados na nuvem"
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
      <span className="hidden sm:inline">Conectado</span>
      <Wifi className="w-3 h-3 text-emerald-600 sm:hidden" />
    </div>
  )
}
