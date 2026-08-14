'use client'

import Link from 'next/link'
import { StatusBadge } from '@/design-system/figma-neutral/components'

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

const NOTIFICATION_REFERENCE_TYPES = new Set([
  'change_doc',
  'task',
  'ci_instance',
  'wiki_page',
])

export function getNotificationTargetHref(notificationId: number, refType: string | null, refId: number | null): string | null {
  if (!refType || !refId || !NOTIFICATION_REFERENCE_TYPES.has(refType)) return null
  return `/notifications/targets/resolve/${notificationId}`
}

export function NotificationItem({ notification: n, onMarkRead }: NotificationItemProps) {
  const href = getNotificationTargetHref(n.id, n.refType, n.refId)

  const inner = (
    <article
      className={['cwgsyw-card', 'cwgsyw-card--md', n.isRead ? '' : 'cwgsyw-card--selected'].filter(Boolean).join(' ')}
      onClick={() => {
        if (!n.isRead) onMarkRead(n.id)
      }}
    >
      <div className="cwgsyw-inline-controls">
        {n.isRead ? <StatusBadge label="已读" status="neutral" /> : <StatusBadge label="未读" status="info" />}
        <div>
          <p className="cwgsyw-type-label-md">{n.title}</p>
          <p className="cwgsyw-type-body-sm">{n.content}</p>
        </div>
        <span className="cwgsyw-type-label-xs">
          {new Date(n.createdAt).toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </article>
  )

  if (href) {
    return (
      <Link href={href} prefetch={false}>
        {inner}
      </Link>
    )
  }
  return inner
}
