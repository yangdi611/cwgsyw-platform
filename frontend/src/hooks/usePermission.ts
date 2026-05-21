import { useAuthStore } from '@/store/authStore'

export function usePermission() {
  const permissions = useAuthStore((s) => s.permissions)
  const hasPermission = (resource: string, action: string) =>
    permissions.has(`${resource}:${action}`)
  return { hasPermission }
}
