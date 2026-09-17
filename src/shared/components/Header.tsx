import React from 'react'
import { Smartphone, Building2, Bell, BellRing, LogOut } from 'lucide-react'
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
    <header className="sticky top-0 z-40 w-full bg-[#0A192F]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 select-none">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Logo e Identidade do Grupo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#722F37] to-[#4A151B] border border-slate-700/80 flex items-center justify-center shadow-md">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-extrabold tracking-tight text-white leading-none">
                Atlas Ponto
              </h1>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#722F37]/40 text-[#c25b68] border border-[#722F37]/50">
                PWA
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium leading-tight block">
              {profile.company}
            </span>
          </div>
        </div>

        {/* Badges de Ação e Status */}
        <div className="flex items-center gap-2">
          {onRequestNotification && (
            <button
              onClick={onRequestNotification}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isNotificationGranted
                  ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={
                isNotificationGranted
                  ? 'Lembretes de ponto e almoço ativados'
                  : 'Ativar lembretes de ponto e almoço'
              }
              aria-label="Lembretes de ponto"
            >
              {isNotificationGranted ? (
                <BellRing className="w-4 h-4 text-emerald-400" />
              ) : (
                <Bell className="w-4 h-4 text-slate-400" />
              )}
            </button>
          )}

          {!isStandalone && (
            <button
              onClick={onOpenInstallModal}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Instalar na tela inicial do celular"
              aria-label="Instalar aplicativo"
            >
              <Smartphone className="w-4 h-4 text-[#c25b68]" />
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
            className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shadow-sm"
            title={`${profile.name} (${profile.registrationNumber})`}
          >
            {initials}
          </div>

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
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
