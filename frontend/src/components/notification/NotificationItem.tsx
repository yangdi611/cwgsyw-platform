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
      className={['cwgsyw-notifications-item', n.isRead ? '' : 'cwgsyw-notifications-item--unread'].filter(Boolean).join(' ')}
      onClick={() => {
        if (!n.isRead) onMarkRead(n.id)
      }}
    >
      {n.isRead ? <StatusBadge label="已读" status="neutral" /> : <StatusBadge label="未读" status="neutral" />}
      <div className="cwgsyw-notifications-item__body">
        <p className="cwgsyw-notifications-item__title">{n.title}</p>
        <p className="cwgsyw-notifications-item__content">{n.content}</p>
      </div>
      <time className="cwgsyw-notifications-item__time" dateTime={n.createdAt}>
        {new Date(n.createdAt).toLocaleString('zh-CN', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </time>
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
