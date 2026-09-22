import { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { UserCircle2, Briefcase, Building2, Mail, IdCard, Clock3, CalendarClock, CheckCircle2, CalendarCheck2, Loader2 } from 'lucide-react'
import { JustifyPunchModal } from './JustifyPunchModal'
import { createRetroactivePunch } from '../services/retroactivePunchService'
import { computeMonthlySummary, type MonthlyWorkSummary } from '../services/workSummaryService'
import type { PunchType } from '../../punch/types/punch.types'
import type { AuthenticatedContext } from '../../../app/AuthenticatedLayout'

const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function formatCpf(cpf?: string): string {
  if (!cpf) return 'Não informado'
  const digits = cpf.replace(/\D/g, '').padStart(11, '0')
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

export function ProfileScreen() {
  const { profile, syncManager } = useOutletContext<AuthenticatedContext>()
  const [isJustifyModalOpen, setIsJustifyModalOpen] = useState(false)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [monthlySummary, setMonthlySummary] = useState<MonthlyWorkSummary | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(true)

  const now = new Date()
  const loadMonthlySummary = useCallback(async () => {
    setIsSummaryLoading(true)
    try {
      const summary = await computeMonthlySummary(profile.id, now.getFullYear(), now.getMonth())
      setMonthlySummary(summary)
    } catch {
      setMonthlySummary(null)
    } finally {
      setIsSummaryLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  useEffect(() => {
    loadMonthlySummary()
  }, [loadMonthlySummary])

  const infoRows = [
    { icon: IdCard, label: 'Matrícula', value: profile.registrationNumber },
    { icon: UserCircle2, label: 'CPF', value: formatCpf(profile.cpf) },
    { icon: Briefcase, label: 'Cargo', value: profile.role },
    { icon: Building2, label: 'Departamento', value: profile.department },
    { icon: Building2, label: 'Empresa', value: profile.company },
    { icon: Mail, label: 'E-mail', value: profile.email },
  ]

  const handleSubmitJustification = async (params: { punchType: PunchType; dateIso: string; justification: string }) => {
    await createRetroactivePunch({
      userId: profile.id,
      colaboradorId: profile.colaboradorId,
      punchType: params.punchType,
      dateIso: params.dateIso,
      justification: params.justification,
    })
    setSuccessNotice('Ajuste registrado! Ele aparece no seu histórico e segue para conferência do RH.')
    setTimeout(() => setSuccessNotice(null), 5000)
    loadMonthlySummary()
    if (navigator.onLine) {
      syncManager.triggerSync().catch(() => {})
    }
  }

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-200">
        <UserCircle2 className="w-4.5 h-4.5 text-[#c25b68]" />
        <h1 className="text-base font-bold">Meu Perfil</h1>
      </div>

      {/* Cartão de Identificação */}
      <div className="flex items-center gap-3 p-4 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8C3843] to-[#4A151B] border border-slate-700/80 flex items-center justify-center text-lg font-bold text-white shadow-md shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white leading-snug truncate">{profile.name}</h2>
          <p className="text-xs text-slate-400 truncate">{profile.role}</p>
        </div>
      </div>

      {/* Resumo do Mês */}
      <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarCheck2 className="w-4 h-4 text-[#c25b68]" />
          <h2 className="text-sm font-semibold text-slate-200">Resumo de {MONTH_LABELS[now.getMonth()]}</h2>
        </div>

        {isSummaryLoading ? (
          <div className="flex items-center justify-center py-4 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-lg font-bold text-white font-mono block">{monthlySummary?.workedHoursLabel ?? '0h'}</span>
              <span className="text-[10px] text-slate-500">Horas trabalhadas</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-lg font-bold text-white font-mono block">{monthlySummary?.daysWorked ?? 0}</span>
              <span className="text-[10px] text-slate-500">Dias trabalhados</span>
            </div>
          </div>
        )}

        <p className="mt-2.5 text-[10px] text-slate-500 leading-relaxed">
          Estimativa a partir das suas batidas — jornadas ainda abertas hoje não entram na soma.
        </p>
      </div>

      {/* Dados Cadastrais */}
      <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800/60">
          <h2 className="text-sm font-semibold text-slate-200">Dados Cadastrais</h2>
        </div>
        <div className="divide-y divide-slate-800/60">
          {infoRows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-2.5">
              <Icon className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 block">{label}</span>
                <span className="text-xs text-slate-200 font-medium truncate block">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Banco de Horas (placeholder) */}
      <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Clock3 className="w-4 h-4 text-[#c25b68]" />
          <h2 className="text-sm font-semibold text-slate-200">Banco de Horas</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Em breve: saldo de horas positivas/negativas calculado a partir das suas batidas.
        </p>
      </div>

      {/* Justificar Ponto Esquecido */}
      <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/80 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <CalendarClock className="w-4 h-4 text-[#c25b68]" />
          <h2 className="text-sm font-semibold text-slate-200">Justificar Ponto Esquecido</h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed mb-3">
          Esqueceu de bater o ponto em um dia anterior? Escolha a data, a hora e explique o motivo — o ajuste
          fica registrado para conferência do RH.
        </p>

        {successNotice && (
          <div className="mb-3 p-2.5 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsJustifyModalOpen(true)}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-all cursor-pointer"
        >
          Justificar um ponto
        </button>
      </div>

      <JustifyPunchModal
        isOpen={isJustifyModalOpen}
        onClose={() => setIsJustifyModalOpen(false)}
        onSubmit={handleSubmitJustification}
      />
    </div>
  )
}
