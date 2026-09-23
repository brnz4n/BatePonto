import React, { useState, useEffect } from 'react'
import { Utensils, Bell, Clock, CheckCircle } from 'lucide-react'
import type { LocalPunchRecord } from '../types/punch.types'

interface LunchBreakTimerProps {
  lastLunchPunch: LocalPunchRecord | null
  isNotificationGranted: boolean
  onRequestNotification: () => void
}

export const LunchBreakTimer: React.FC<LunchBreakTimerProps> = ({
  lastLunchPunch,
  isNotificationGranted,
  onRequestNotification,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)

  useEffect(() => {
    if (!lastLunchPunch) return

    const calculateElapsed = () => {
      const startTime = new Date(lastLunchPunch.clientTimestamp).getTime()
      const now = Date.now()
      const diffSecs = Math.max(0, Math.floor((now - startTime) / 1000))
      setElapsedSeconds(diffSecs)
    }

    calculateElapsed()
    const timer = setInterval(calculateElapsed, 1000)

    return () => clearInterval(timer)
  }, [lastLunchPunch])

  if (!lastLunchPunch) return null

  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  const formattedMinutes = String(minutes).padStart(2, '0')
  const formattedSeconds = String(seconds).padStart(2, '0')

  // Meta padrão de 60 minutos (3600 segundos)
  const targetSeconds = 3600
  const progressPercent = Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100))
  const isCompleted = elapsedSeconds >= targetSeconds

  return (
    <div className="w-full max-w-sm mx-auto my-3 p-4 bg-white border border-amber-200 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-amber-700 font-semibold text-xs uppercase tracking-wider">
          <Utensils className="w-4 h-4 text-amber-600" />
          <span>Intervalo de Almoço Ativo</span>
        </div>

        {!isNotificationGranted ? (
          <button
            onClick={onRequestNotification}
            className="flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
            title="Ativar lembrete sonoro no celular"
          >
            <Bell className="w-3 h-3 text-amber-600" />
            <span>Avise-me</span>
          </button>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
            <CheckCircle className="w-3 h-3" />
            <span>Lembrete ativo</span>
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className="text-3xl font-bold font-mono text-[#212965] tracking-tight">
            {formattedMinutes}:{formattedSeconds}
          </span>
          <span className="text-xs text-[#727272] ml-2 font-medium">
            / 01:00:00 (Meta CLT)
          </span>
        </div>

        <div className="text-right">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
              isCompleted
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            {isCompleted ? '1h cumprida' : `${60 - minutes} min restantes`}
          </span>
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isCompleted ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center gap-1 text-[10px] text-[#727272]">
        <Clock className="w-3 h-3 text-[#727272] shrink-0" />
        <span>
          {isCompleted
            ? 'Você já pode registrar o Retorno do Almoço com segurança jurídica.'
            : 'Evite registrar o retorno antes de completar 60 minutos para evitar passivo CLT.'}
        </span>
      </div>
    </div>
  )
}
