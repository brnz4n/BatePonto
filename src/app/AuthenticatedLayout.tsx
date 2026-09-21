import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from '../shared/components/Header'
import { BottomTabBar } from '../shared/components/BottomTabBar'
import { InstallGuidanceModal } from '../features/install/components/InstallGuidanceModal'
import { useSyncManager } from '../features/sync/hooks/useSyncManager'
import { usePWAInstallPrompt } from '../features/install/hooks/usePWAInstallPrompt'
import { useNotificationManager } from '../features/notifications/hooks/useNotificationManager'
import { useSmartPunchReminder } from '../features/notifications/hooks/useSmartPunchReminder'
import type { EmployeeProfile } from '../features/punch/types/punch.types'

export interface AuthenticatedContext {
  profile: EmployeeProfile
  syncManager: ReturnType<typeof useSyncManager>
  notificationManager: ReturnType<typeof useNotificationManager>
}

interface AuthenticatedLayoutProps {
  profile: EmployeeProfile
  onSignOut: () => void
}

export function AuthenticatedLayout({ profile, onSignOut }: AuthenticatedLayoutProps) {
  const syncManager = useSyncManager()
  const notificationManager = useNotificationManager()
  useSmartPunchReminder(profile.id, notificationManager.isGranted)
  const { isStandalone } = usePWAInstallPrompt()
  const [isInstallModalForced, setIsInstallModalForced] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-[#0A192F] text-slate-100 selection:bg-[#722F37]">
      <Header
        profile={profile}
        isOnline={syncManager.isOnline}
        isSyncing={syncManager.isSyncing}
        pendingCount={syncManager.pendingCount}
        isStandalone={isStandalone}
        isNotificationGranted={notificationManager.isGranted}
        onRequestNotification={notificationManager.requestPermission}
        onManualSync={syncManager.triggerSync}
        onOpenInstallModal={() => setIsInstallModalForced(true)}
        onSignOut={onSignOut}
      />

      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4 pb-24">
        <Outlet context={{ profile, syncManager, notificationManager } satisfies AuthenticatedContext} />
      </main>

      <BottomTabBar />

      <InstallGuidanceModal forceOpen={isInstallModalForced} onClose={() => setIsInstallModalForced(false)} />
    </div>
  )
}
