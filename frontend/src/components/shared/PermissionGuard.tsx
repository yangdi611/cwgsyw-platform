'use client'
import { usePermission } from '@/hooks/usePermission'

interface Props {
  resource: string
  action: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGuard({
  resource,
  action,
  children,
  fallback = null,
}: Props) {
  const { hasPermission } = usePermission()
  return hasPermission(resource, action) ? <>{children}</> : <>{fallback}</>
}
