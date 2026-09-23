import React, { useState, useEffect, memo } from 'react'
import { Clock, MapPin, MapPinOff, Building2, AlertTriangle, RefreshCw } from 'lucide-react'
import type { GeolocationErrorType } from '../../../shared/hooks/useGeolocation'

interface LiveClockProps {
  hasGpsSignal?: boolean
  accuracyMeters?: number
  geofence?: { distanceMeters: number; isWithinBounds: boolean } | null
  isLoadingGps?: boolean
  gpsError?: string | null
  gpsErrorType?: GeolocationErrorType | null
  onRetryGps?: () => void
}

// Isolado num componente próprio (sem props) para que o tick de 1s re-renderize só o relógio —
// sem isso, o card inteiro (badges de GPS, geofence, alertas) re-renderizava a cada segundo junto.
const ClockDigits: React.FC = memo(() => {
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
    <>
      <div className="flex items-baseline justify-center font-extrabold tracking-tight text-[#212965] mb-2 select-none">
        <span className="text-6xl font-mono tabular-nums">{hours}</span>
        <span className="text-2xl font-mono text-[#6d0001] ml-1.5 font-semibold">:{seconds}</span>
      </div>

      <div className="text-sm font-medium text-[#727272] text-center select-none">
        {displayDate}
      </div>
    </>
  )
})
ClockDigits.displayName = 'ClockDigits'

export const LiveClock: React.FC<LiveClockProps> = ({
  hasGpsSignal,
  accuracyMeters,
  geofence,
  isLoadingGps,
  gpsError,
  gpsErrorType,
  onRetryGps,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-6 w-full max-w-sm mx-auto relative">
      <div className="flex items-center gap-2 mb-2 text-[#727272] text-xs font-semibold uppercase tracking-wider">
        <Clock className="w-3.5 h-3.5 text-[#727272]" />
        <span>Horário Oficial (Brasília)</span>
      </div>

      <ClockDigits />

      <div className="mt-4 pt-3 border-t border-slate-200 w-full flex items-center justify-between text-xs text-[#727272] px-1">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              hasGpsSignal
                ? 'bg-emerald-500 animate-pulse'
                : isLoadingGps
                ? 'bg-amber-400 animate-ping'
                : gpsError
                ? 'bg-amber-500'
                : 'bg-amber-500'
            }`}
          />
          <span className="font-medium">
            {hasGpsSignal
              ? 'GPS Ativo'
              : isLoadingGps
              ? 'Localizando...'
              : gpsErrorType === 'PERMISSION_DENIED'
              ? 'Localização Bloqueada'
              : gpsErrorType === 'POSITION_UNAVAILABLE'
              ? 'GPS Desativado'
              : gpsErrorType === 'TIMEOUT'
              ? 'Sinal de GPS Fraco'
              : 'Aguardando GPS'}
          </span>
        </div>
        {accuracyMeters ? (
          <div className="flex items-center gap-1 text-[#727272]">
            <MapPin className="w-3 h-3 text-[#727272]" />
            <span>Precisão: ±{accuracyMeters}m</span>
          </div>
        ) : (
          <span className="text-slate-400">
            {isLoadingGps ? 'Buscando...' : gpsError ? 'Sem sinal' : 'Alta Precisão'}
          </span>
        )}
      </div>

      {/* Alerta Inline Não-Bloqueante quando o GPS falhar */}
      {gpsError && !hasGpsSignal && !isLoadingGps && (
        <div className="mt-2.5 w-full p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-left">
          <div className="flex items-start gap-2">
            <MapPinOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[11px] font-medium text-amber-800 leading-snug">
                {gpsErrorType === 'PERMISSION_DENIED'
                  ? 'Permissão negada no navegador. Habilite a localização no ícone de cadeado/ajustes do navegador para a auditoria de presença do RH.'
                  : gpsErrorType === 'POSITION_UNAVAILABLE'
                  ? 'Sinal indisponível. Verifique se o GPS/Localização do seu celular está ativado.'
                  : 'Tempo esgotado ao buscar satélites. Você pode bater o ponto normalmente ou tentar reconectar.'}
              </p>
              {onRetryGps && (
                <button
                  type="button"
                  onClick={onRetryGps}
                  disabled={isLoadingGps}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg border border-amber-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingGps ? 'animate-spin' : ''}`} />
                  <span>Tentar novamente</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {geofence && (
        <div
          className={`mt-3 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border bg-white ${
            geofence.isWithinBounds
              ? 'text-[#727272] border-slate-200'
              : 'text-amber-700 border-amber-200 bg-amber-50'
          }`}
          title="Distância calculada em tempo real até a sede da RFeitosa Group"
        >
          {geofence.isWithinBounds ? (
            <Building2 className="w-3.5 h-3.5 text-[#727272]" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
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
