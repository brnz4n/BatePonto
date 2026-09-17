import React, { useState } from 'react'
import { Building2, Lock, AlertCircle, Loader2, ShieldCheck } from 'lucide-react'
import type { AuthStatus } from '../../../shared/hooks/useAuthSession'

interface ResetPasswordScreenProps {
  authStatus: AuthStatus
  onSubmit: (newPassword: string) => Promise<{ success: boolean; error?: string }>
}

const MIN_PASSWORD_LENGTH = 8

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ authStatus, onSubmit }) => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFirstLogin = authStatus === 'first-login-required'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha precisa ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await onSubmit(password)
      if (!result.success) {
        setError(result.error || 'Não foi possível atualizar a senha. Tente novamente.')
      }
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
            <h1 className="text-lg font-extrabold text-white leading-none">
              {isFirstLogin ? 'Defina sua Senha' : 'Nova Senha'}
            </h1>
            <span className="text-xs text-slate-400 font-medium">Atlas Ponto • RFeitosa Group</span>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
          {isFirstLogin && (
            <div className="mb-4 p-3 bg-sky-950/60 border border-sky-800/60 rounded-xl text-xs text-sky-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                Este é o seu primeiro acesso. Por segurança, defina uma senha pessoal antes de continuar —
                a senha provisória enviada pelo RH não pode ser reutilizada.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Nova senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-750 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-wine-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirme a nova senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-750 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-wine-600"
                />
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-wine-700 hover:bg-wine-600 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-all shadow-md active:scale-98 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar Nova Senha
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
