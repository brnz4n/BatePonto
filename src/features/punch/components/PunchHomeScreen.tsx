import { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { LiveClock } from './LiveClock'
import { PunchButton } from './PunchButton'
import { LunchBreakTimer } from './LunchBreakTimer'
import { DailyTimeline } from './DailyTimeline'
import { PunchSuccessModal } from './PunchSuccessModal'
import { SyncFailureBanner } from '../../sync/components/SyncFailureBanner'
import { useGeolocation } from '../../../shared/hooks/useGeolocation'
import { useSystemConfig } from '../../../shared/hooks/useSystemConfig'
import { checkGeofence } from '../../../shared/utils/geofence'
import { usePunchStateMachine } from '../hooks/usePunchStateMachine'
import { usePunchAction } from '../hooks/usePunchAction'
import type { LocalPunchRecord } from '../types/punch.types'
import type { AuthenticatedContext } from '../../../app/AuthenticatedLayout'
import { ShieldCheck, UserCheck, AlertCircle, Wrench, BadgeCheck } from 'lucide-react'

export function PunchHomeScreen() {
  const { profile, syncManager, notificationManager } = useOutletContext<AuthenticatedContext>()
  const geolocation = useGeolocation()
  const { coords, getPosition } = geolocation
  const { isPunchEnabled, maintenanceMessage } = useSystemConfig()

  const [lastSuccessRecord, setLastSuccessRecord] = useState<LocalPunchRecord | null>(null)

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
    nextActionDesc,
    currentWorkStatus,
    refreshTodayPunches,
  } = usePunchStateMachine(profile.id)

  const { executePunch, isPunching, isCoolingDown, errorMessage } = usePunchAction({
    userId: profile.id,
    colaboradorId: profile.colaboradorId,
    nextPunchType,
    todayPunches,
    onSuccess: (record: LocalPunchRecord) => setLastSuccessRecord(record),
    triggerSync: syncManager.triggerSync,
    refreshTodayPunches,
    geolocation,
    getPosition,
    onLunchRegistered: (timestamp: string) => notificationManager.scheduleLunchReminder(timestamp),
    onCancelLunchReminder: notificationManager.cancelLunchReminder,
  })

  const lastLunchPunch =
    todayPunches
      .filter((p) => p.punchType === 'SAIDA_INTERVALO')
      .slice(-1)[0] || null

  const workStatusMap: Record<string, { text: string; color: string }> = {
    FORA_DE_EXPEDIENTE: { text: 'Fora de Expediente', color: 'bg-white/10 text-slate-200 border-white/15' },
    TRABALHANDO: { text: 'Jornada Ativa', color: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/25' },
    EM_INTERVALO: { text: 'Em Intervalo (Almoço)', color: 'bg-amber-400/15 text-amber-200 border-amber-300/25' },
    JORNADA_ENCERRADA: { text: 'Jornada Concluída', color: 'bg-sky-400/15 text-sky-200 border-sky-300/25' },
  }

  const currentStatusInfo = workStatusMap[currentWorkStatus] || workStatusMap.FORA_DE_EXPEDIENTE

  return (
    <div className="space-y-4">
      {/* Card do Colaborador (Âncora de Autoridade) */}
      <div className="p-4 bg-[#212965] rounded-2xl text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold leading-snug truncate">{profile.name}</h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300 flex-wrap">
              <span>Matrícula: {profile.registrationNumber}</span>
              <span>•</span>
              <span>{profile.department}</span>
            </div>
          </div>
        </div>

        <div
          className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${currentStatusInfo.color}`}
        >
          <BadgeCheck className="w-3.5 h-3.5" />
          {currentStatusInfo.text}
        </div>
      </div>

      {/* Kill Switch: Admin pode desabilitar o botão de bater ponto sem novo deploy */}
      {!isPunchEnabled && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          <Wrench className="w-4 h-4 text-red-500 shrink-0" />
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
      <LiveClock
        hasGpsSignal={!!coords}
        accuracyMeters={coords?.accuracy}
        geofence={geofence}
        isLoadingGps={geolocation.isLoading}
        gpsError={geolocation.error}
        gpsErrorType={geolocation.errorType}
        onRetryGps={getPosition}
      />

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
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Botão Gigante de Ação Única (Vinho Bordô) */}
      <PunchButton
        punchType={nextPunchType}
        sublabel={nextActionDesc}
        isPunching={isPunching}
        onClick={() => executePunch()}
        disabled={!isPunchEnabled || isCoolingDown}
      />

      {/* Linha do Tempo dos Registros do Dia */}
      <DailyTimeline punches={todayPunches} />

      {/* Rodapé de Compliance e Segurança */}
      <footer className="mt-8 pb-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-[#727272]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#727272]" />
          <span>Sistema em conformidade com a Portaria 671/2021 MTE (REP-P)</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">
          Atlas Ponto • RFeitosa Group • v1.0.1
        </div>
      </footer>

      {/* Modal de Confirmação com Checkmark Verde */}
      <PunchSuccessModal record={lastSuccessRecord} onClose={() => setLastSuccessRecord(null)} />
    </div>
  )
}
