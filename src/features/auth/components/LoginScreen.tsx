import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react'

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean }>
  authError: string | null
  sessionExpiredNotice: string | null
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, authError, sessionExpiredNotice }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onLogin(email.trim(), password)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-navy-900 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-wine-700 to-wine-900 border border-slate-700/80 flex items-center justify-center shadow-lg">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-extrabold text-white leading-none">Atlas Ponto</h1>
            <span className="text-xs text-slate-400 font-medium">RFeitosa Group</span>
          </div>
        </div>

        {sessionExpiredNotice && (
          <div className="mb-4 p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-xs text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{sessionExpiredNotice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">E-mail corporativo</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.nome@rfeitosagroup.com.br"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-750 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-wine-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-750 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-wine-600"
              />
            </div>
          </div>

          {authError && (
            <div className="p-2.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-wine-700 hover:bg-wine-600 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-all shadow-md active:scale-98 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Entrar
          </button>

          <div className="text-center pt-1">
            <Link to="/forgot-password" className="text-xs text-slate-400 hover:text-wine-400 transition-colors">
              Esqueci minha senha
            </Link>
          </div>
        </form>

        <p className="text-center text-[11px] text-slate-500 mt-6">
          Acesso restrito a colaboradores cadastrados pelo RH da RFeitosa Group.
        </p>
      </div>
    </div>
  )
}
