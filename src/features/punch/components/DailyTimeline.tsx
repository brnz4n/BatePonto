import { Clock, ShieldAlert, CheckCircle2, History } from 'lucide-react'
import type { LocalPunchRecord } from '../types/punch.types'
import { PUNCH_TYPE_SHORT } from '../types/punch.types'

interface DailyTimelineProps {
  punches: LocalPunchRecord[]
}

export const DailyTimeline: React.FC<DailyTimelineProps> = ({ punches }) => {
  return (
    <div className="w-full max-w-sm mx-auto mt-4">
      <div className="flex items-center justify-between pb-3 mb-1">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#727272]" />
          <h2 className="text-sm font-semibold text-[#212965]">Registros da Jornada</h2>
        </div>
        <span className="text-xs font-mono text-[#727272] font-medium">
          {punches.length} {punches.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {punches.length === 0 ? (
        <div className="text-center py-6 text-[#727272] text-xs">
          <p>Nenhuma batida registrada na jornada atual.</p>
          <p className="mt-1 text-[11px] text-slate-400">Sua linha do tempo aparecerá aqui conforme você bater o ponto.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Linha vertical ligando os nós da timeline */}
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-slate-200" aria-hidden="true" />

          <div className="space-y-3">
            {punches.map((punch) => {
              const punchDate = new Date(punch.clientTimestamp)
              const timeFormatted = punchDate.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })

              // Turno noturno atravessa a meia-noite: sem essa marcação, uma ENTRADA de "ontem"
              // às 22h e uma SAIDA de "hoje" às 06h pareceriam do mesmo dia na lista.
              const yesterday = new Date()
              yesterday.setDate(yesterday.getDate() - 1)
              const dateLabel =
                punchDate.toDateString() === yesterday.toDateString()
                  ? 'Ontem'
                  : punchDate.toDateString() !== new Date().toDateString()
                    ? punchDate.toLocaleDateString('pt-BR')
                    : null

              const isSynced = punch.syncStatus === 'synced'
              const hasMockAlert = punch.auditMetadata?.isMockSuspect || punch.auditMetadata?.teleportationSuspect

              return (
                <div key={punch.id} className="relative flex items-start gap-3 pl-0">
                  {/* Nó circular da timeline */}
                  <div className="relative z-10 w-6 h-6 rounded-full bg-[#212965] border-4 border-white shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>

                  <div className="flex-1 flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-[#212965] block">
                        {PUNCH_TYPE_SHORT[punch.punchType] || punch.punchType}
                      </span>
                      <span className="text-[10px] text-[#727272] font-mono">
                        {timeFormatted}
                        {dateLabel && <span> · {dateLabel}</span>}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {hasMockAlert && (
                        <div
                          title="Sinal de auditoria gerado para verificação do RH"
                          className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          <span>Audit</span>
                        </div>
                      )}

                      {isSynced ? (
                        <div
                          title="Sincronizado na nuvem (Supabase)"
                          className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-[10px] font-medium">Salvo</span>
                        </div>
                      ) : (
                        <div
                          title="Salvo localmente no dispositivo (offline)"
                          className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200"
                        >
                          <Clock className="w-3 h-3 animate-pulse" />
                          <span className="text-[10px] font-medium">Local</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Próximo ponto deduzido: nó cinzento vazado, ainda não registado */}
            <div className="relative flex items-start gap-3">
              <div className="relative z-10 w-6 h-6 rounded-full bg-white border-2 border-dashed border-slate-300 shrink-0 mt-0.5" />
              <div className="flex-1 flex items-center py-1">
                <span className="text-[11px] text-slate-400 italic">Aguardando próximo registo</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
