import { useAuthStore } from '@/store/authStore'

export function usePermission() {
  const permissions = useAuthStore((s) => s.permissions)
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const hasPermission = (resource: string, action: string) =>
    permissions.has(`${resource}:${action}`)
  return { hasPermission, isHydrated }
}
