import { useState, useEffect, useCallback } from 'react'
import { supabase, isDemoMode } from '../lib/supabaseClient'

export interface SystemConfigState {
  isPunchEnabled: boolean
  maintenanceMessage: string | null
  isLoading: boolean
}

/**
 * Kill Switch: flag lida do Supabase (tabela `system_config`, linha única) que permite a um
 * Admin desabilitar o botão de bater ponto em produção sem precisar de um novo deploy — por
 * exemplo diante de um ataque ou bug crítico na geolocalização. Falha de leitura (offline, RLS,
 * etc.) mantém o ponto habilitado por padrão: o Kill Switch é para desligar deliberadamente,
 * não para virar um ponto único de falha que trava todo mundo por causa de uma rede instável.
 */
export function useSystemConfig(): SystemConfigState {
  const [isPunchEnabled, setIsPunchEnabled] = useState(true)
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (isDemoMode) {
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('is_punch_enabled, maintenance_message')
        .eq('id', true)
        .maybeSingle()

      if (!error && data) {
        setIsPunchEnabled(data.is_punch_enabled)
        setMaintenanceMessage(data.maintenance_message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    // Reconsulta periodicamente para reagir a um Admin acionando o kill switch em produção
    // sem depender do colaborador recarregar o app manualmente.
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [load])

  return { isPunchEnabled, maintenanceMessage, isLoading }
}
