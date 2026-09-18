import { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { LiveClock } from './LiveClock'
import { PunchButton } from './PunchButton'
import { LunchBreakTimer } from './LunchBreakTimer'
import { ManualOverrideModal } from './ManualOverrideModal'
import { DailyTimeline } from './DailyTimeline'
import { PunchSuccessModal } from './PunchSuccessModal'
import { SyncFailureBanner } from '../../sync/components/SyncFailureBanner'
import { useGeolocation } from '../../../shared/hooks/useGeolocation'
import { useSystemConfig } from '../../../shared/hooks/useSystemConfig'
import { checkGeofence } from '../../../shared/utils/geofence'
import { usePunchStateMachine } from '../hooks/usePunchStateMachine'
import { usePunchAction } from '../hooks/usePunchAction'
import type { LocalPunchRecord, PunchType } from '../types/punch.types'
import type { AuthenticatedContext } from '../../../app/AuthenticatedLayout'
import { ShieldCheck, UserCheck, AlertCircle, Wrench } from 'lucide-react'

export function PunchHomeScreen() {
  const { profile, syncManager, notificationManager } = useOutletContext<AuthenticatedContext>()
  const { coords, getPosition } = useGeolocation()
  const { isPunchEnabled, maintenanceMessage } = useSystemConfig()

  const [lastSuccessRecord, setLastSuccessRecord] = useState<LocalPunchRecord | null>(null)
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState<boolean>(false)

  // Busca a posição assim que a tela abre — sem isso o card só mostra "Aguardando GPS" até
  // o colaborador bater o primeiro ponto, o que parecia (e era) uma barreira de fricção zero.
  useEffect(() => {
    getPosition()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const geofence = useMemo(() => {
    if (!coords) return null
    return checkGeofence(coords.latitude, coords.longitude)
  }, [coords])

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
    colaboradorId: profile.colaboradorId,
    nextPunchType,
    todayPunches,
    onSuccess: (record: LocalPunchRecord) => setLastSuccessRecord(record),
    triggerSync: syncManager.triggerSync,
    refreshTodayPunches,
    getPosition,
    onLunchRegistered: (timestamp: string) => notificationManager.scheduleLunchReminder(timestamp),
  })

  const lastLunchPunch =
    todayPunches
      .filter((p) => p.punchType === 'SAIDA_INTERVALO')
      .slice(-1)[0] || null

  const workStatusMap: Record<string, { text: string; color: string }> = {
    FORA_DE_EXPEDIENTE: { text: 'Fora de Expediente', color: 'bg-slate-800 text-slate-300 border-slate-700' },
    TRABALHANDO: { text: 'Em Jornada Ativa', color: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60' },
    EM_INTERVALO: { text: 'Em Intervalo (Almoço)', color: 'bg-amber-950/70 text-amber-300 border-amber-800/60' },
    JORNADA_ENCERRADA: { text: 'Jornada Concluída', color: 'bg-blue-950/70 text-blue-300 border-blue-800/60' },
  }

  const currentStatusInfo = workStatusMap[currentWorkStatus] || workStatusMap.FORA_DE_EXPEDIENTE

  return (
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

      {/* Kill Switch: Admin pode desabilitar o botão de bater ponto sem novo deploy */}
      {!isPunchEnabled && (
        <div className="flex items-center gap-2 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200">
          <Wrench className="w-4 h-4 text-red-400 shrink-0" />
          <span className="leading-snug">
            {maintenanceMessage || 'Sistema em manutenção — o registro de ponto está temporariamente desabilitado.'}
          </span>
        </div>
      )}

      {/* Alerta de registros que esgotaram as tentativas de sincronização */}
      <SyncFailureBanner
        failedCount={syncManager.failedCount}
        onRetry={syncManager.retryFailed}
        isCircuitOpen={syncManager.isCircuitOpen}
        circuitOpenUntil={syncManager.circuitOpenUntil}
      />

      {/* Relógio Digital em Tempo Real */}
      <LiveClock hasGpsSignal={!!coords} accuracyMeters={coords?.accuracy} geofence={geofence} />

      {/* Cronômetro Dinâmico de Almoço (Exibido quando em intervalo) */}
      {currentWorkStatus === 'EM_INTERVALO' && (
        <LunchBreakTimer
          lastLunchPunch={lastLunchPunch}
          isNotificationGranted={notificationManager.isGranted}
          onRequestNotification={notificationManager.requestPermission}
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
        onOpenOverrideModal={isPunchEnabled ? () => setIsOverrideModalOpen(true) : undefined}
        disabled={!isPunchEnabled}
      />

      {/* Linha do Tempo dos Registros do Dia */}
      <DailyTimeline punches={todayPunches} />

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

      {/* Modal de Confirmação com Checkmark Verde */}
      <PunchSuccessModal record={lastSuccessRecord} onClose={() => setLastSuccessRecord(null)} />

      {/* Modal de Contingência Manual para Correção de Batida Esquecida */}
      <ManualOverrideModal
        isOpen={isOverrideModalOpen}
        currentDeducedType={nextPunchType}
        onClose={() => setIsOverrideModalOpen(false)}
        onSelectOverride={(type: PunchType, justification?: string) => {
          executePunch(type, justification)
        }}
      />
    </div>
  )
}
