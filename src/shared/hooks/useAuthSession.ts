import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isDemoMode } from '../lib/supabaseClient'
import { AUTH_REQUIRED_EVENT, resumePausedAuthQueue } from '../../features/sync/services/syncQueueService'
import { saveCachedProfile, getCachedProfile, clearCachedProfile } from '../../features/sync/db/localDb'
import type { EmployeeProfile } from '../../features/punch/types/punch.types'

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'first-login-required'
  | 'password-recovery'
  | 'authenticated'

const DEMO_PROFILE: EmployeeProfile = {
  id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  colaboradorId: 'f1e2d3c4-b5a6-4978-8695-1a2b3c4d5e6f',
  name: 'Antonio Feitosa',
  role: 'Desenvolvedor Full-Stack',
  registrationNumber: 'RF-1042',
  department: 'Tecnologia & Inovação',
  company: 'RFeitosa Group',
  email: 'demo@rfeitosagroup.com.br',
  isFirstLogin: false,
}

interface ColaboradorRow {
  id: string
  nome: string
  matricula: string
  cargo: string | null
  departamento: string | null
  empresa: string
  email: string
  is_first_login: boolean
  ativo: boolean
}

type FetchProfileResult =
  | { type: 'success'; data: ColaboradorRow }
  | { type: 'not_found' }
  | { type: 'network_error'; error: any }

async function fetchColaboradorProfile(authUserId: string): Promise<FetchProfileResult> {
  if (!navigator.onLine) {
    return { type: 'network_error', error: new Error('Dispositivo offline') }
  }

  try {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('id, nome, matricula, cargo, departamento, empresa, email, is_first_login, ativo')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (error) {
      return { type: 'network_error', error }
    }

    if (!data) {
      return { type: 'not_found' }
    }

    return { type: 'success', data: data as ColaboradorRow }
  } catch (err: any) {
    return { type: 'network_error', error: err }
  }
}

function toEmployeeProfile(authUserId: string, row: ColaboradorRow): EmployeeProfile {
  return {
    id: authUserId,
    colaboradorId: row.id,
    name: row.nome,
    role: row.cargo || 'Colaborador',
    registrationNumber: row.matricula,
    department: row.departamento || 'Geral',
    company: row.empresa,
    email: row.email,
    isFirstLogin: row.is_first_login,
  }
}

export function useAuthSession() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(isDemoMode ? DEMO_PROFILE : null)
  const [authStatus, setAuthStatus] = useState<AuthStatus>(isDemoMode ? 'authenticated' : 'loading')
  const [authError, setAuthError] = useState<string | null>(null)
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null)

  // Evita recarregar o perfil do colaborador em paralelo quando vários eventos de auth chegam juntos
  const isLoadingProfileRef = useRef(false)

  const loadProfileFromSession = useCallback(async (authUserId: string) => {
    if (isLoadingProfileRef.current) return
    isLoadingProfileRef.current = true

    try {
      const result = await fetchColaboradorProfile(authUserId)

      if (result.type === 'success') {
        const colaborador = result.data

        if (!colaborador.ativo) {
          await clearCachedProfile()
          setProfile(null)
          setAuthStatus('unauthenticated')
          setAuthError('Sua conta foi desativada. Contate o setor de Recursos Humanos.')
          await supabase.auth.signOut()
          return
        }

        const employeeProfile = toEmployeeProfile(authUserId, colaborador)
        await saveCachedProfile(employeeProfile)
        setProfile(employeeProfile)
        setAuthStatus(colaborador.is_first_login ? 'first-login-required' : 'authenticated')
        setAuthError(null)
        return
      }

      if (result.type === 'network_error') {
        // Falha de rede ou dispositivo offline (ex: acordou celular sem sinal imediato):
        // Resgata o perfil seguro do IndexedDB (Dexie) e mantém o colaborador autenticado.
        const cached = await getCachedProfile(authUserId)
        if (cached) {
          setProfile(cached)
          setAuthStatus(cached.isFirstLogin ? 'first-login-required' : 'authenticated')
          setAuthError(null)
          return
        }

        // Se não há cache (ex: primeiro acesso sem internet), aí sim pede login
        setProfile(null)
        setAuthStatus('unauthenticated')
        setAuthError('Sem conexão com a internet para carregar seu perfil. Conecte-se e tente novamente.')
        return
      }

      if (result.type === 'not_found') {
        // Servidor confirmou que o usuário não existe no banco do RH
        await clearCachedProfile()
        setProfile(null)
        setAuthStatus('unauthenticated')
        setAuthError('Sua conta ainda não foi provisionada pelo RH. Contate o setor de Recursos Humanos.')
        await supabase.auth.signOut()
        return
      }
    } finally {
      isLoadingProfileRef.current = false
    }
  }, [])

  useEffect(() => {
    if (isDemoMode) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfileFromSession(session.user.id)
      } else {
        setProfile(null)
        setAuthStatus('unauthenticated')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearCachedProfile().catch(() => {})
        setProfile(null)
        setAuthStatus('unauthenticated')
        return
      }

      if (event === 'PASSWORD_RECOVERY') {
        setAuthStatus('password-recovery')
        return
      }

      if (session?.user) {
        loadProfileFromSession(session.user.id)

        if (event === 'SIGNED_IN') {
          resumePausedAuthQueue()
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [loadProfileFromSession])

  // A fila de sincronização dispara este evento quando o Supabase rejeita o token (sessão expirada).
  useEffect(() => {
    if (isDemoMode) return

    const handleAuthRequired = async () => {
      // Se estiver offline, NÃO desloga! A fila está apenas pausada aguardando rede.
      if (!navigator.onLine) {
        return
      }

      // Tenta renovar o token silenciosamente antes de deslogar
      try {
        const { data, error } = await supabase.auth.refreshSession()
        if (!error && data?.session) {
          // Sessão renovada com sucesso! Reabre a fila de sincronização
          await resumePausedAuthQueue()
          return
        }
      } catch {
        // Falha transitória de rede durante o refresh não deve expulsar o usuário
        return
      }

      // Apenas se o refresh for rejeitado de forma definitiva pelo servidor
      setSessionExpiredNotice('Sua sessão expirou. Faça login novamente para continuar sincronizando seus pontos.')
      await clearCachedProfile()
      await supabase.auth.signOut()
    }

    window.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired)
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError('E-mail ou senha inválidos.')
      return { success: false }
    }
    setSessionExpiredNotice(null)
    return { success: true }
  }, [])

  const signOut = useCallback(async () => {
    await clearCachedProfile()
    await supabase.auth.signOut()
    setProfile(null)
    setAuthStatus('unauthenticated')
  }, [])

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { success: !error, error: error?.message }
  }, [])

  /** Usado tanto no fluxo de "esqueci minha senha" quanto no de primeiro acesso obrigatório. */
  const updatePassword = useCallback(async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    if (error || !data.user) {
      return { success: false, error: error?.message }
    }

    // Só a tabela colaboradores sabe se este era o primeiro acesso — encerra a obrigatoriedade aqui.
    await supabase
      .from('colaboradores')
      .update({ is_first_login: false })
      .eq('auth_user_id', data.user.id)

    await loadProfileFromSession(data.user.id)
    return { success: true }
  }, [loadProfileFromSession])

  return {
    profile,
    authStatus,
    authError,
    sessionExpiredNotice,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
  }
}
