import { useState, useEffect } from 'react'
import { supabase, isDemoMode } from '../lib/supabaseClient'
import type { EmployeeProfile } from '../../features/punch/types/punch.types'

const DEFAULT_PROFILE: EmployeeProfile = {
  id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  name: 'Antonio Feitosa',
  role: 'Desenvolvedor Full-Stack',
  registrationNumber: 'RF-1042',
  department: 'Tecnologia & Inovação',
  company: 'RFeitosa Group',
}

export function useAuthSession() {
  const [profile, setProfile] = useState<EmployeeProfile>(DEFAULT_PROFILE)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  useEffect(() => {
    async function checkSession() {
      if (isDemoMode) {
        setIsAuthenticated(true)
        setProfile(DEFAULT_PROFILE)
        return
      }

      setIsLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setIsAuthenticated(true)
          setProfile({
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Colaborador',
            role: session.user.user_metadata?.role || 'Colaborador RFeitosa',
            registrationNumber: session.user.user_metadata?.registration_number || 'RF-0000',
            department: session.user.user_metadata?.department || 'Geral',
            company: 'RFeitosa Group',
          })
        } else {
          // Mantém o perfil de contingência para teste imediato
          setIsAuthenticated(true)
        }
      } catch {
        setIsAuthenticated(true)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()

    if (!isDemoMode) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setIsAuthenticated(true)
        }
      })
      return () => subscription.unsubscribe()
    }
  }, [])

  return {
    profile,
    isAuthenticated,
    isLoading,
  }
}
