import { useAuthStore } from '@/store/authStore'

// Deprecated action alias map (spec AD-7). Old callers that still pass the
// deprecated `write` action are treated as `update` for the listed resources.
// Remove this map and any remaining `write` call sites after one release.
const DEPRECATED_ACTION_ALIAS: Record<string, Record<string, string>> = {
  cmdb_model: { write: 'update' },
}

export function usePermission() {
  const permissions = useAuthStore((s) => s.permissions)
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const hasPermission = (resource: string, action: string) => {
    const canonicalAction = DEPRECATED_ACTION_ALIAS[resource]?.[action] ?? action
    return permissions.has(`${resource}:${canonicalAction}`)
  }
  return { hasPermission, isHydrated }
}
