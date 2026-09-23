import React from 'react'
import { Smartphone, Bell, BellRing, LogOut } from 'lucide-react'
import { SyncBadge } from './SyncBadge'
import type { EmployeeProfile } from '../../features/punch/types/punch.types'

interface HeaderProps {
  profile: EmployeeProfile
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  isStandalone: boolean
  isNotificationGranted?: boolean
  onRequestNotification?: () => void
  onManualSync: () => void
  onOpenInstallModal: () => void
  onSignOut?: () => void
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  isOnline,
  isSyncing,
  pendingCount,
  isStandalone,
  isNotificationGranted,
  onRequestNotification,
  onManualSync,
  onOpenInstallModal,
  onSignOut,
}) => {
  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 py-3 select-none">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Logo e Identidade do Grupo */}
        <div className="leading-none">
          <h1 className="text-lg font-extrabold tracking-tight text-[#212965]">
            XRFeitosa
          </h1>
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#6d0001]">
            GROUP
          </span>
        </div>

        {/* Badges de Ação e Status */}
        <div className="flex items-center gap-2">
          {onRequestNotification && (
            <button
              onClick={onRequestNotification}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isNotificationGranted
                  ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                  : 'text-[#727272] hover:text-[#212965] hover:bg-slate-100'
              }`}
              title={
                isNotificationGranted
                  ? 'Lembretes de ponto e almoço ativados'
                  : 'Ativar lembretes de ponto e almoço'
              }
              aria-label="Lembretes de ponto"
            >
              {isNotificationGranted ? (
                <BellRing className="w-4 h-4 text-emerald-600" />
              ) : (
                <Bell className="w-4 h-4 text-[#727272]" />
              )}
            </button>
          )}

          {!isStandalone && (
            <button
              onClick={onOpenInstallModal}
              className="p-1.5 text-[#727272] hover:text-[#212965] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Instalar na tela inicial do celular"
              aria-label="Instalar aplicativo"
            >
              <Smartphone className="w-4 h-4 text-[#727272]" />
            </button>
          )}

          <SyncBadge
            isOnline={isOnline}
            isSyncing={isSyncing}
            pendingCount={pendingCount}
            onManualSync={onManualSync}
          />

          {/* Avatar do Colaborador */}
          <div
            className="w-8 h-8 rounded-full bg-[#212965] flex items-center justify-center text-xs font-bold text-white shadow-sm"
            title={`${profile.name} (${profile.registrationNumber})`}
          >
            {initials}
          </div>

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="p-1.5 text-[#727272] hover:text-[#6d0001] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Sair da conta"
              aria-label="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
