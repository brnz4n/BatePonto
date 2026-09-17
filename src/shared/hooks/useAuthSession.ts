import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isDemoMode } from '../lib/supabaseClient'
import { AUTH_REQUIRED_EVENT, resumePausedAuthQueue } from '../../features/sync/services/syncQueueService'
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
}

async function fetchColaboradorProfile(authUserId: string): Promise<ColaboradorRow | null> {
  const { data, error } = await supabase
    .from('colaboradores')
    .select('id, nome, matricula, cargo, departamento, empresa, email, is_first_login')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error || !data) return null
  return data as ColaboradorRow
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
      const colaborador = await fetchColaboradorProfile(authUserId)

      if (!colaborador) {
        // Sessão válida no Supabase Auth, mas sem conta provisionada pelo RH em `colaboradores`.
        setProfile(null)
        setAuthStatus('unauthenticated')
        setAuthError('Sua conta ainda não foi provisionada pelo RH. Contate o setor de Recursos Humanos.')
        await supabase.auth.signOut()
        return
      }

      setProfile(toEmployeeProfile(authUserId, colaborador))
      setAuthStatus(colaborador.is_first_login ? 'first-login-required' : 'authenticated')
      setAuthError(null)
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
      setSessionExpiredNotice('Sua sessão expirou. Faça login novamente para continuar sincronizando seus pontos.')
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
    await supabase.auth.signOut()
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
