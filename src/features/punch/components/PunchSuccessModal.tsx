import React, { useEffect } from 'react'
import { CheckCircle2, ShieldCheck, MapPin, X } from 'lucide-react'
import type { LocalPunchRecord } from '../types/punch.types'
import { PUNCH_TYPE_SHORT } from '../types/punch.types'

interface PunchSuccessModalProps {
  record: LocalPunchRecord | null
  onClose: () => void
}

// Colaborador bate ponto na correria (catraca, ponto de ônibus) — 4s de espera parece uma
// eternidade. 2s é o tempo pra ver o check verde e o horário sem travar o fluxo dele.
const AUTO_CLOSE_MS = 2000

export const PunchSuccessModal: React.FC<PunchSuccessModalProps> = ({ record, onClose }) => {
  useEffect(() => {
    if (!record) return
    const timer = setTimeout(onClose, AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [record, onClose])

  if (!record) return null

  const timeFormatted = new Date(record.clientTimestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const dateFormatted = new Date(record.clientTimestamp).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-slate-900 border border-slate-750 rounded-3xl p-6 shadow-2xl text-center overflow-hidden"
      >
        {/* Luz ambiente esmeralda de sucesso */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-32 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Ícone de Sucesso Animado */}
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-950/80 border-2 border-emerald-500/60 flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.35)] animate-in zoom-in-50 duration-300">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 drop-shadow-md" />
        </div>

        <h3 className="text-xl font-bold text-white mb-1">Ponto Registrado!</h3>
        <p className="text-sm font-semibold text-[#c25b68] mb-4">
          {PUNCH_TYPE_SHORT[record.punchType] || record.punchType}
        </p>

        {/* Resumo do comprovante */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-left space-y-2 mb-5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Horário:</span>
            <span className="font-mono font-bold text-white text-sm">{timeFormatted}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Data:</span>
            <span className="text-slate-200 font-medium">{dateFormatted}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Localização:</span>
            <span className="text-slate-300 font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              {record.coords ? `±${record.coords.accuracy}m (GPS)` : 'Local (Rede)'}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center text-[11px]">
            <span className="text-slate-500">ID do Comprovante:</span>
            <span className="font-mono text-slate-400 text-[10px] truncate max-w-[140px]" title={record.id}>
              {record.id.slice(0, 13)}...
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400/90 font-medium mb-4">
          <ShieldCheck className="w-4 h-4" />
          <span>Assinatura digital gravada e auditável</span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-[#722F37] hover:bg-[#8C3843] text-white font-semibold rounded-xl text-sm transition-all shadow-md active:scale-98"
        >
          OK
        </button>
      </div>
    </div>
  )
}
