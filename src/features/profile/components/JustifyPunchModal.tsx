import React, { useState } from 'react'
import { AlertTriangle, X, Check, Loader2 } from 'lucide-react'
import type { PunchType } from '../../punch/types/punch.types'
import { PUNCH_TYPE_LABELS } from '../../punch/types/punch.types'

interface JustifyPunchModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (params: { punchType: PunchType; dateIso: string; justification: string }) => Promise<void>
}

const ALL_PUNCH_TYPES: PunchType[] = ['ENTRADA', 'SAIDA_INTERVALO', 'RETORNO_INTERVALO', 'SAIDA', 'EXTRA']

function todayLocalDate(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function nowLocalTime(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export const JustifyPunchModal: React.FC<JustifyPunchModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [punchType, setPunchType] = useState<PunchType>('ENTRADA')
  const [date, setDate] = useState<string>(todayLocalDate())
  const [time, setTime] = useState<string>(nowLocalTime())
  const [justification, setJustification] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleClose = () => {
    if (isSubmitting) return
    setError(null)
    onClose()
  }

  const handleSubmit = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      await onSubmit({ punchType, dateIso: `${date}T${time}:00`, justification })
      setJustification('')
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Não foi possível registrar o ajuste.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-left overflow-hidden max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-[#727272] hover:text-[#212965] rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#212965]">Justificar Ponto Esquecido</h3>
            <span className="text-xs text-[#727272]">Registre uma batida em data/hora retroativa</span>
          </div>
        </div>

        {/* Tipo de marcação */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-[#212965] mb-1.5">Tipo de marcação:</label>
          <div className="grid grid-cols-1 gap-2">
            {ALL_PUNCH_TYPES.map((type) => {
              const isSelected = punchType === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPunchType(type)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#6d0001] border-[#6d0001] text-white shadow-md'
                      : 'bg-white border-slate-200 text-[#212965] hover:bg-slate-50'
                  }`}
                >
                  <span>{PUNCH_TYPE_LABELS[type]}</span>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Data e Hora */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div>
            <label className="block text-xs font-medium text-[#212965] mb-1.5">Data:</label>
            <input
              type="date"
              value={date}
              max={todayLocalDate()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-[#212965] focus:outline-none focus:border-[#6d0001]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#212965] mb-1.5">Hora:</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-[#212965] focus:outline-none focus:border-[#6d0001]"
            />
          </div>
        </div>

        {/* Justificativa */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-[#212965] mb-1.5">Justificativa (obrigatória):</label>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Ex: Esqueci de bater o ponto de entrada ao chegar"
            rows={3}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-[#212965] placeholder-slate-400 focus:outline-none focus:border-[#6d0001] resize-none"
          />
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="bg-[#F8F9FA] border border-slate-200 rounded-xl p-2.5 mb-5 text-[11px] text-[#727272] leading-relaxed">
          Este ajuste fica marcado como <strong>retroativo</strong> para conferência do RH e recebe o mesmo elo
          criptográfico (blockchain local) das demais batidas.
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || justification.trim().length < 5}
            className="flex-1 py-3 bg-[#6d0001] hover:bg-[#8f0002] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-xs transition-all shadow-md active:scale-98 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Registrar Ajuste
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-[#212965] font-medium rounded-xl text-xs transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
