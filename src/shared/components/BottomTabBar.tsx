import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, History } from 'lucide-react'

const TABS = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/historico', label: 'Histórico', icon: History, end: false },
]

export const BottomTabBar: React.FC = () => {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-[#0A192F]/95 backdrop-blur-md border-t border-slate-800/80"
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
                isActive ? 'text-[#c25b68]' : 'text-slate-500 hover:text-slate-300'
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
