import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, History, UserCircle2 } from 'lucide-react'

const TABS = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/historico', label: 'Histórico', icon: History, end: false },
  { to: '/perfil', label: 'Perfil', icon: UserCircle2, end: false },
]

export const BottomTabBar: React.FC = () => {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-md mx-auto flex items-stretch">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] text-xs font-semibold transition-colors ${
                isActive ? 'text-[#6d0001]' : 'text-[#727272] hover:text-[#212965]'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
