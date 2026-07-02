'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { getToken } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import { useIdleSession } from '@/hooks/useIdleSession'

const SETUP_PATH = '/account/setup'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)
  const requiredActions = useAuthStore((s) => s.requiredActions)
  const isHydrated = useAuthStore((s) => s.isHydrated)

  useIdleSession()

  useEffect(() => {
    const token = getToken()
    if (!token) {
      router.replace('/login')
      return
    }
    if (!isHydrated) return

    // 首次登录强制流程守卫（SPEC 13.4）：requiredActions 非空必须先去 setup，
    // 已完成则不能停留在 setup 页面。
    if (requiredActions.length > 0 && pathname !== SETUP_PATH) {
      router.replace(SETUP_PATH)
      return
    }
    if (requiredActions.length === 0 && pathname === SETUP_PATH) {
      router.replace('/')
      return
    }
    setChecked(true)
  }, [router, pathname, requiredActions, isHydrated])

  if (!checked) return null

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <div className="w-full max-w-none">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
