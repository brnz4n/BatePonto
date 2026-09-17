import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'

interface ForgotPasswordScreenProps {
  onSubmit: (email: string) => Promise<{ success: boolean; error?: string }>
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onSubmit }) => {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [wasSent, setWasSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await onSubmit(email.trim())
      if (result.success) {
        setWasSent(true)
      } else {
        setError('Não foi possível enviar o link. Verifique o e-mail informado.')
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
            <h1 className="text-lg font-extrabold text-white leading-none">Recuperar Senha</h1>
            <span className="text-xs text-slate-400 font-medium">Atlas Ponto • RFeitosa Group</span>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
          {wasSent ? (
            <div className="text-center space-y-3 py-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-sm text-slate-200 font-medium">Link enviado!</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Verifique a caixa de entrada do seu e-mail corporativo e siga as instruções para
                criar uma nova senha.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed mb-2">
                Informe seu e-mail corporativo. Enviaremos um link para você criar uma nova senha.
              </p>

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

              {error && <p className="text-xs text-red-300">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 bg-wine-700 hover:bg-wine-600 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-all shadow-md active:scale-98 cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar Link de Recuperação
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-wine-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
