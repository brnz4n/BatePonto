import React from 'react'
import { Fingerprint, Loader2, HelpCircle } from 'lucide-react'
import type { PunchType } from '../types/punch.types'

// Marcação Sequencial Neutra: o rótulo principal do botão nunca varia por tipo de batida —
// o "sublabel" (posição sequencial da jornada) é quem carrega o contexto.
const BUTTON_LABEL = 'Registrar Ponto'

interface PunchButtonProps {
  punchType: PunchType
  sublabel: string
  isPunching: boolean
  onClick: () => void
  onOpenOverrideModal?: () => void
  disabled?: boolean
}

export const PunchButton: React.FC<PunchButtonProps> = ({
  punchType: _punchType,
  sublabel,
  isPunching,
  onClick,
  onOpenOverrideModal,
  disabled,
}) => {
  return (
    <div className="relative flex flex-col items-center justify-center my-6">
      {/* Botão Gigante de Ação Única */}
      <button
        onClick={onClick}
        disabled={isPunching || disabled}
        aria-label={BUTTON_LABEL}
        className={`
          relative z-10 w-52 h-52 rounded-full
          bg-gradient-to-br from-[#8C3843] via-[#722F37] to-[#4A151B]
          hover:from-[#9C3F4B] hover:to-[#5C1B23]
          active:scale-95 active:shadow-inner
          transition-all duration-200 ease-out
          shadow-[0_12px_36px_rgba(114,47,55,0.45)]
          border-4 border-slate-900/50
          flex flex-col items-center justify-center p-4 text-center select-none
          cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        `}
      >
        {isPunching ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
            <span className="text-white text-xs font-semibold tracking-wider uppercase">
              Registrando...
            </span>
          </div>
        ) : (
          <>
            <div className="p-3 bg-white/10 rounded-full mb-1 shadow-inner">
              <Fingerprint className="w-9 h-9 text-white drop-shadow-sm" />
            </div>

            <span className="text-white font-bold text-lg leading-tight drop-shadow-md px-2 max-w-[170px]">
              {BUTTON_LABEL}
            </span>

            <span className="text-slate-200/80 text-[10px] font-medium tracking-wide uppercase mt-1">
              Toque para registrar
            </span>
          </>
        )}
      </button>

      {/* Legenda explicativa contextual abaixo do botão */}
      <div className="mt-3 text-center max-w-xs px-4">
        <p className="text-xs text-slate-400 font-medium">{sublabel}</p>

        {onOpenOverrideModal && (
          <button
            type="button"
            onClick={onOpenOverrideModal}
            className="mt-2 text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors cursor-pointer inline-flex items-center justify-center gap-1 mx-auto"
          >
            <HelpCircle className="w-3 h-3 text-[#c25b68]" />
            <span>Esqueceu o ponto anterior? Alterar tipo</span>
          </button>
        )}
      </div>
    </div>
  )
}
