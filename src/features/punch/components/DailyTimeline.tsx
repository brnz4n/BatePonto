import { Clock, ShieldAlert, CheckCircle2, History } from 'lucide-react'
import type { LocalPunchRecord } from '../types/punch.types'
import { PUNCH_TYPE_SHORT } from '../types/punch.types'

interface DailyTimelineProps {
  punches: LocalPunchRecord[]
}

export const DailyTimeline: React.FC<DailyTimelineProps> = ({ punches }) => {
  return (
    <div className="w-full max-w-sm mx-auto mt-4 bg-slate-900/40 backdrop-blur-md rounded-2xl p-4 border border-slate-800/80">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-200">Registros do Dia</h2>
        </div>
        <span className="text-xs font-mono text-slate-400 font-medium">
          {punches.length} {punches.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {punches.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-xs">
          <p>Nenhuma batida registrada hoje.</p>
          <p className="mt-1 text-[11px] text-slate-600">Sua linha do tempo aparecerá aqui conforme você bater o ponto.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {punches.map((punch, index) => {
            const timeFormatted = new Date(punch.clientTimestamp).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })

            const isSynced = punch.syncStatus === 'synced'
            const hasMockAlert = punch.auditMetadata?.isMockSuspect || punch.auditMetadata?.teleportationSuspect

            return (
              <div
                key={punch.id}
                className="flex items-center justify-between p-2.5 bg-slate-800/40 hover:bg-slate-800/60 rounded-xl border border-slate-750/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 font-mono">
                    {index + 1}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      {PUNCH_TYPE_SHORT[punch.punchType] || punch.punchType}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{timeFormatted}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {hasMockAlert && (
                    <div
                      title="Sinal de auditoria gerado para verificação do RH"
                      className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded-md border border-amber-800/40"
                    >
                      <ShieldAlert className="w-3 h-3" />
                      <span>Audit</span>
                    </div>
                  )}

                  {isSynced ? (
                    <div
                      title="Sincronizado na nuvem (Supabase)"
                      className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="text-[10px] font-medium">Salvo</span>
                    </div>
                  ) : (
                    <div
                      title="Salvo localmente no dispositivo (offline)"
                      className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-800/40"
                    >
                      <Clock className="w-3 h-3 animate-pulse" />
                      <span className="text-[10px] font-medium">Local</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
