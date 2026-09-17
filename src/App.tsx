import { useState } from 'react'
import { Header } from './shared/components/Header'
import { LiveClock } from './features/punch/components/LiveClock'
import { PunchButton } from './features/punch/components/PunchButton'
import { LunchBreakTimer } from './features/punch/components/LunchBreakTimer'
import { ManualOverrideModal } from './features/punch/components/ManualOverrideModal'
import { DailyTimeline } from './features/punch/components/DailyTimeline'
import { PunchSuccessModal } from './features/punch/components/PunchSuccessModal'
import { InstallGuidanceModal } from './features/install/components/InstallGuidanceModal'
import { useAuthSession } from './shared/hooks/useAuthSession'
import { useSyncManager } from './features/sync/hooks/useSyncManager'
import { useGeolocation } from './shared/hooks/useGeolocation'
import { usePunchStateMachine } from './features/punch/hooks/usePunchStateMachine'
import { usePunchAction } from './features/punch/hooks/usePunchAction'
import { usePWAInstallPrompt } from './features/install/hooks/usePWAInstallPrompt'
import { useNotificationManager } from './features/notifications/hooks/useNotificationManager'
import type { LocalPunchRecord, PunchType } from './features/punch/types/punch.types'
import { ShieldCheck, UserCheck, AlertCircle } from 'lucide-react'

export function App() {
  const { profile } = useAuthSession()
  const { isOnline, pendingCount, isSyncing, triggerSync } = useSyncManager()
  const { coords, getPosition } = useGeolocation()
  const { isStandalone } = usePWAInstallPrompt()
  const { isGranted: isNotificationGranted, requestPermission, scheduleLunchReminder } = useNotificationManager()

  const [lastSuccessRecord, setLastSuccessRecord] = useState<LocalPunchRecord | null>(null)
  const [isInstallModalForced, setIsInstallModalForced] = useState<boolean>(false)
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState<boolean>(false)

  const {
    todayPunches,
    nextPunchType,
    nextActionLabel,
    nextActionDesc,
    currentWorkStatus,
    refreshTodayPunches,
  } = usePunchStateMachine(profile.id)

  const { executePunch, isPunching, errorMessage } = usePunchAction({
    userId: profile.id,
    nextPunchType,
    todayPunches,
    onSuccess: (record: LocalPunchRecord) => setLastSuccessRecord(record),
    triggerSync,
    refreshTodayPunches,
    getPosition,
    onLunchRegistered: (timestamp: string) => scheduleLunchReminder(timestamp),
  })

  // Localiza a última batida de saída para almoço do dia (para o contador)
  const lastLunchPunch =
    todayPunches
      .filter((p) => p.punchType === 'SAIDA_INTERVALO')
      .slice(-1)[0] || null

  // Tradução visual do status da jornada
  const workStatusMap: Record<string, { text: string; color: string }> = {
    FORA_DE_EXPEDIENTE: { text: 'Fora de Expediente', color: 'bg-slate-800 text-slate-300 border-slate-700' },
    TRABALHANDO: { text: 'Em Jornada Ativa', color: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60' },
    EM_INTERVALO: { text: 'Em Intervalo (Almoço)', color: 'bg-amber-950/70 text-amber-300 border-amber-800/60' },
    JORNADA_ENCERRADA: { text: 'Jornada Concluída', color: 'bg-blue-950/70 text-blue-300 border-blue-800/60' },
  }

  const currentStatusInfo = workStatusMap[currentWorkStatus] || workStatusMap.FORA_DE_EXPEDIENTE

  return (
    <div className="min-h-screen flex flex-col bg-[#0A192F] text-slate-100 selection:bg-[#722F37]">
      {/* Header Institucional */}
      <Header
        profile={profile}
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
        isStandalone={isStandalone}
        isNotificationGranted={isNotificationGranted}
        onRequestNotification={requestPermission}
        onManualSync={triggerSync}
        onOpenInstallModal={() => setIsInstallModalForced(true)}
      />

      {/* Conteúdo Principal (Centralizado e Mobile-First) */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Card do Colaborador e Status Atual */}
          <div className="flex items-center justify-between p-3.5 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700">
                <UserCheck className="w-5 h-5 text-[#c25b68]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white leading-snug">{profile.name}</h2>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>Matrícula: {profile.registrationNumber}</span>
                  <span>•</span>
                  <span>{profile.department}</span>
                </div>
              </div>
            </div>

            <div className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${currentStatusInfo.color}`}>
              {currentStatusInfo.text}
            </div>
          </div>

          {/* Relógio Digital em Tempo Real */}
          <LiveClock
            hasGpsSignal={!!coords}
            accuracyMeters={coords?.accuracy}
          />

          {/* Cronômetro Dinâmico de Almoço (Exibido quando em intervalo) */}
          {currentWorkStatus === 'EM_INTERVALO' && (
            <LunchBreakTimer
              lastLunchPunch={lastLunchPunch}
              isNotificationGranted={isNotificationGranted}
              onRequestNotification={requestPermission}
            />
          )}

          {/* Alerta de Erro se houver falha de validação Zod */}
          {errorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Botão Gigante de Ação Única (Vinho Bordô) com opção de override manual */}
          <PunchButton
            punchType={nextPunchType}
            label={nextActionLabel}
            sublabel={nextActionDesc}
            isPunching={isPunching}
            onClick={() => executePunch()}
            onOpenOverrideModal={() => setIsOverrideModalOpen(true)}
          />

          {/* Linha do Tempo dos Registros do Dia */}
          <DailyTimeline punches={todayPunches} />
        </div>

        {/* Rodapé de Compliance e Segurança */}
        <footer className="mt-8 pb-4 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Sistema em conformidade com a Portaria 671/2021 MTE (REP-P)</span>
          </div>
          <div className="text-[10px] text-slate-600 mt-1">
            Atlas Ponto • RFeitosa Group • v1.0.0
          </div>
        </footer>
      </main>

      {/* Modal de Confirmação com Checkmark Verde */}
      <PunchSuccessModal
        record={lastSuccessRecord}
        onClose={() => setLastSuccessRecord(null)}
      />

      {/* Modal de Contingência Manual para Correção de Batida Esquecida */}
      <ManualOverrideModal
        isOpen={isOverrideModalOpen}
        currentDeducedType={nextPunchType}
        onClose={() => setIsOverrideModalOpen(false)}
        onSelectOverride={(type: PunchType, justification?: string) => {
          executePunch(type, justification)
        }}
      />

      {/* Modal Guiado de Instalação PWA (Safari / Chrome) */}
      <InstallGuidanceModal
        forceOpen={isInstallModalForced}
        onClose={() => setIsInstallModalForced(false)}
      />
    </div>
  )
}
export default App
