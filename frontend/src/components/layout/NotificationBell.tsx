'use client'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'

export function NotificationBell() {
  const { hasPermission, isHydrated } = usePermission()
  const canReadNotifications = hasPermission('notification', 'read')
  const { data: count = 0 } = useQuery<number>({
    queryKey: ['notification-unread'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data.data).catch(() => 0),
    refetchInterval: 30_000,
    retry: false,
    enabled: typeof window !== 'undefined' && isHydrated && canReadNotifications,
  })

  if (!isHydrated || !canReadNotifications) return null

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `通知，${count} 条未读` : '通知'}
      className="cwgsyw-icon-btn cwgsyw-icon-btn--md cwgsyw-icon-btn--ghost cwgsyw-notification-bell"
    >
      <Bell aria-hidden="true" />
      {count > 0 ? (
        <span className="cwgsyw-notification-count">{count > 99 ? '99+' : count}</span>
      ) : null}
    </Link>
  )
}
