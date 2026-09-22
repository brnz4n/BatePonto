import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthSession } from './shared/hooks/useAuthSession'
import { LoginScreen } from './features/auth/components/LoginScreen'
import { ForgotPasswordScreen } from './features/auth/components/ForgotPasswordScreen'
import { ResetPasswordScreen } from './features/auth/components/ResetPasswordScreen'
import { AuthenticatedLayout } from './app/AuthenticatedLayout'
import { PunchHomeScreen } from './features/punch/components/PunchHomeScreen'
import { HistoryScreen } from './features/history/components/HistoryScreen'
import { ProfileScreen } from './features/profile/components/ProfileScreen'

function LoadingSplash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900">
      <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
    </div>
  )
}

export function App() {
  const {
    profile,
    authStatus,
    authError,
    sessionExpiredNotice,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
  } = useAuthSession()

  if (authStatus === 'loading') {
    return <LoadingSplash />
  }

  const needsPasswordReset = authStatus === 'first-login-required' || authStatus === 'password-recovery'

  const authenticatedElement =
    authStatus === 'unauthenticated' ? (
      <Navigate to="/login" replace />
    ) : needsPasswordReset ? (
      <Navigate to="/reset-password" replace />
    ) : profile ? (
      <AuthenticatedLayout profile={profile} onSignOut={signOut} />
    ) : (
      <LoadingSplash />
    )

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authStatus === 'unauthenticated' ? (
            <LoginScreen onLogin={signIn} authError={authError} sessionExpiredNotice={sessionExpiredNotice} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route path="/forgot-password" element={<ForgotPasswordScreen onSubmit={sendPasswordReset} />} />

      <Route
        path="/reset-password"
        element={
          needsPasswordReset ? (
            <ResetPasswordScreen authStatus={authStatus} onSubmit={updatePassword} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route path="/" element={authenticatedElement}>
        <Route index element={<PunchHomeScreen />} />
        <Route path="historico" element={<HistoryScreen />} />
        <Route path="perfil" element={<ProfileScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
