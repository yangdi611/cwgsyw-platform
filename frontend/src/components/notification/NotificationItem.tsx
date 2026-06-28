'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface NotificationVO {
  id: number
  title: string
  content: string
  type: string
  refType: string | null
  refId: number | null
  isRead: boolean
  createdAt: string
}

interface NotificationItemProps {
  notification: NotificationVO
  onMarkRead: (id: number) => void
}

function getHref(refType: string | null, refId: number | null): string | null {
  if (!refType || !refId) return null
  switch (refType) {
    case 'change_doc':
      return `/change-docs/${refId}`
    case 'daily_report':
      return `/daily/${refId}`
    case 'ci_instance':
      return `/cmdb/instances/${refId}`
    default:
      return null
  }
}

export function NotificationItem({ notification: n, onMarkRead }: NotificationItemProps) {
  const href = getHref(n.refType, n.refId)

  const inner = (
    <div
      onClick={() => !n.isRead && onMarkRead(n.id)}
      className={cn(
        'p-4 border rounded-lg transition-colors',
        n.isRead
          ? 'bg-card cursor-default'
          : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/30'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2 min-w-0">
          {!n.isRead && (
            <span className="mt-1.5 inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className={cn('font-medium text-sm', !n.isRead && 'text-v2-fg')}>{n.title}</p>
            <p className="text-sm text-v2-muted mt-0.5">{n.content}</p>
          </div>
        </div>
        <span className="text-xs text-v2-muted whitespace-nowrap flex-shrink-0">
          {new Date(n.createdAt).toLocaleString('zh-CN', {
            month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href} className="block">{inner}</Link>
  }
  return inner
}
