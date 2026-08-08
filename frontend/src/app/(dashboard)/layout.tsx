'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { getToken } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'
import { useIdleSession } from '@/hooks/useIdleSession'

const SETUP_PATH = '/account/setup'

const ROUTE_PERMISSIONS = [
  { path: '/cmdb/spatial', permissions: ['cmdb_spatial:read', 'cmdb_instance:read'] },
  { path: '/work', permissions: ['work_item:read'] },
  { path: '/ops-calendar/rosters', permissions: ['calendar_settings:read'] },
  { path: '/ops-calendar/holidays', permissions: ['calendar_settings:read'] },
  { path: '/ops-calendar', permissions: ['task:read'] },
  { path: '/tasks/templates', permissions: ['task_template:read'] },
  { path: '/tasks/plans', permissions: ['task_plan:read'] },
  { path: '/tasks/analytics', permissions: ['task_analytics:read'] },
  { path: '/tasks/metrics', permissions: ['task_analytics:read'] },
  { path: '/tasks/automations', permissions: ['task_analytics:read'] },
  { path: '/tasks', permissions: ['task:read'] },
  { path: '/workflow/design', permissions: ['workflow:configure'] },
  { path: '/workflow/admin', permissions: ['workflow:configure'] },
  { path: '/workflow/templates', permissions: ['workflow:configure'] },
  { path: '/workflow/bindings', permissions: ['workflow:configure'] },
  { path: '/users', permissions: ['user:read'] },
  { path: '/groups', permissions: ['group:read'] },
  { path: '/notifications', permissions: ['notification:read'] },
  { path: '/rbac/roles', permissions: ['role:read'] },
  {
    path: '/rbac/permissions',
    permissions: ['resource:read', 'resource:assign', 'role:read'],
  },
] as const

function requiredRoutePermission(pathname: string) {
  return ROUTE_PERMISSIONS.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const requiredActions = useAuthStore((s) => s.requiredActions)
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const permissions = useAuthStore((s) => s.permissions)
  const token = getToken()
  const routePermission = requiredRoutePermission(pathname)
  const canAccessRoute =
    !routePermission || routePermission.permissions.every((permission) => permissions.has(permission))

  useIdleSession()

  useEffect(() => {
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
    if (!canAccessRoute) {
      router.replace('/')
    }
  }, [router, pathname, requiredActions, isHydrated, token, canAccessRoute])

  const shouldRedirectToSetup = requiredActions.length > 0 && pathname !== SETUP_PATH
  const shouldRedirectFromSetup = requiredActions.length === 0 && pathname === SETUP_PATH
  const isFixedWorkspaceRoute = /^\/wiki\/[^/]+\/(?:[^/]+\/edit|graph)$/.test(pathname)
  if (!token || !isHydrated || shouldRedirectToSetup || shouldRedirectFromSetup || !canAccessRoute) {
    return null
  }

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-v2-bg">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header />
        <main
          className={`min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 md:p-6 ${
            isFixedWorkspaceRoute ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          <div className="min-w-0 w-full">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
