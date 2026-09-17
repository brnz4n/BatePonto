import React, { useState } from 'react'
import { AlertTriangle, X, Check, HelpCircle } from 'lucide-react'
import type { PunchType } from '../types/punch.types'
import { PUNCH_TYPE_LABELS, PUNCH_TYPE_SHORT } from '../types/punch.types'

interface ManualOverrideModalProps {
  isOpen: boolean
  currentDeducedType: PunchType
  onClose: () => void
  onSelectOverride: (selectedType: PunchType, justification?: string) => void
}

const ALL_PUNCH_TYPES: PunchType[] = [
  'ENTRADA',
  'SAIDA_INTERVALO',
  'RETORNO_INTERVALO',
  'SAIDA',
  'EXTRA',
]

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  isOpen,
  currentDeducedType,
  onClose,
  onSelectOverride,
}) => {
  const [selectedType, setSelectedType] = useState<PunchType>(currentDeducedType)
  const [justification, setJustification] = useState<string>('')

  if (!isOpen) return null

  const handleConfirm = () => {
    onSelectOverride(selectedType, justification.trim() || undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-750 rounded-3xl p-6 shadow-2xl text-left overflow-hidden">
        {/* Luz ambiente de aviso */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/20 blur-2xl rounded-full pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-950/80 border border-amber-800/80 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Alterar Tipo de Ponto</h3>
            <span className="text-xs text-slate-400">Esqueceu a batida anterior?</span>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Selecione o tipo correto para este momento. O horário registrado será o carimbo oficial de agora.
        </p>

        {/* Lista de Opções de Batida */}
        <div className="space-y-2 mb-4">
          {ALL_PUNCH_TYPES.map((type) => {
            const isSelected = selectedType === type
            const isDefault = currentDeducedType === type

            return (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#722F37] border-[#8C3843] text-white shadow-md'
                    : 'bg-slate-800/60 border-slate-750 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{PUNCH_TYPE_LABELS[type]}</span>
                  {isDefault && (
                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-300">
                      Sugerido
                    </span>
                  )}
                </div>

                {isSelected && <Check className="w-4 h-4 text-white" />}
              </button>
            )
          })}
        </div>

        {/* Campo de Justificativa Opcional */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Justificativa para o RH (opcional):
          </label>
          <input
            type="text"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Ex: Esqueci de registrar a saída do almoço"
            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-750 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#8C3843]"
          />
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 mb-5 flex items-start gap-2 text-[11px] text-slate-400">
          <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Esta ação marcará a batida como <strong>ajuste manual</strong> para auditoria no espelho do Atlas RH.
          </span>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-3 bg-[#722F37] hover:bg-[#8C3843] text-white font-semibold rounded-xl text-xs transition-all shadow-md active:scale-98"
          >
            Aplicar: {PUNCH_TYPE_SHORT[selectedType]}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium rounded-xl text-xs transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
