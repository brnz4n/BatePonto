import React from 'react'
import { Fingerprint, Loader2 } from 'lucide-react'
import type { PunchType } from '../types/punch.types'

// Marcação Sequencial Neutra: o rótulo principal do botão nunca varia por tipo de batida —
// o "sublabel" (posição sequencial da jornada) é quem carrega o contexto.
const BUTTON_LABEL = 'Registrar Ponto'

interface PunchButtonProps {
  punchType: PunchType
  sublabel: string
  isPunching: boolean
  onClick: () => void
  disabled?: boolean
}

export const PunchButton: React.FC<PunchButtonProps> = ({
  punchType: _punchType,
  sublabel,
  isPunching,
  onClick,
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
          relative z-10 w-48 h-48 rounded-full
          bg-[#6d0001]
          hover:bg-[#8f0002]
          active:scale-95
          transition-all duration-200 ease-out
          shadow-[0_16px_32px_rgba(109,0,1,0.35)]
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
            <Fingerprint className="w-10 h-10 text-white mb-2" />

            <span className="text-white font-bold text-lg leading-tight px-2 max-w-[170px]">
              {BUTTON_LABEL}
            </span>

            <span className="text-white/70 text-[10px] font-medium tracking-wide uppercase mt-1">
              Toque para registrar
            </span>
          </>
        )}
      </button>

      {/* Legenda explicativa contextual abaixo do botão */}
      <div className="mt-3 text-center max-w-xs px-4">
        <p className="text-xs text-[#727272] font-medium">{sublabel}</p>
      </div>
    </div>
  )
}
