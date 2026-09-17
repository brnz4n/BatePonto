import React, { useState, useEffect } from 'react'
import { Clock, MapPin, Building2, AlertTriangle } from 'lucide-react'

interface LiveClockProps {
  hasGpsSignal?: boolean
  accuracyMeters?: number
  geofence?: { distanceMeters: number; isWithinBounds: boolean } | null
}

export const LiveClock: React.FC<LiveClockProps> = ({ hasGpsSignal, accuracyMeters, geofence }) => {
  const [time, setTime] = useState<Date>(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const hours = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const seconds = time.toLocaleTimeString('pt-BR', { second: '2-digit' })
  const dateFormatted = time.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  // Capitaliza a primeira letra do dia da semana
  const displayDate = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1)

  return (
    <div className="flex flex-col items-center justify-center p-6 w-full max-w-sm mx-auto bg-slate-900/60 backdrop-blur-md rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
      {/* Luz ambiente sutil no topo do card */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-24 bg-[#722F37]/20 blur-2xl rounded-full pointer-events-none" />

      <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>Horário Oficial (Brasília)</span>
      </div>

      <div className="flex items-baseline justify-center font-extrabold tracking-tight text-white mb-2 select-none">
        <span className="text-6xl font-mono tabular-nums drop-shadow-md">{hours}</span>
        <span className="text-2xl font-mono text-[#8C3843] ml-1.5 drop-shadow-sm font-semibold">:{seconds}</span>
      </div>

      <div className="text-sm font-medium text-slate-300 text-center select-none">
        {displayDate}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 w-full flex items-center justify-between text-xs text-slate-400 px-1">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${hasGpsSignal ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span>{hasGpsSignal ? 'GPS Ativo' : 'Aguardando GPS'}</span>
        </div>
        {accuracyMeters ? (
          <div className="flex items-center gap-1 text-slate-400">
            <MapPin className="w-3 h-3 text-slate-400" />
            <span>Precisão: ±{accuracyMeters}m</span>
          </div>
        ) : (
          <span className="text-slate-500">Alta Precisão</span>
        )}
      </div>

      {geofence && (
        <div
          className={`mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold px-2 py-1.5 rounded-lg border ${
            geofence.isWithinBounds
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
              : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
          }`}
          title="Distância calculada em tempo real até a sede da RFeitosa Group"
        >
          {geofence.isWithinBounds ? (
            <Building2 className="w-3.5 h-3.5" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5" />
          )}
          <span>
            {geofence.isWithinBounds
              ? `Na sede (${geofence.distanceMeters}m)`
              : `Fora da sede — ${geofence.distanceMeters}m de distância`}
          </span>
        </div>
      )}
    </div>
  )
}
