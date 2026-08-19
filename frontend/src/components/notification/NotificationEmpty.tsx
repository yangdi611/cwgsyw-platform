import type { ReactNode } from 'react'
import { EmptyState } from '@/design-system/figma-neutral/components'

export const NOTIFICATION_BELL_ICON = '/figma-icons/notification-bell.svg'
export const NOTIFICATION_UNLINK_ICON = '/figma-icons/notification-unlink.svg'
export const NOTIFICATION_BELL_NODE = '6:23747'
export const NOTIFICATION_UNLINK_NODE = '6:30491'

export function NotificationEmpty({
  iconSrc,
  figmaNode,
  title,
  description,
  action,
}: {
  iconSrc: string
  figmaNode: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="cwgsyw-notifications-empty">
      {/* The exact 22px Figma SVG should be served directly; image optimization adds no value here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconSrc} width={22} height={22} alt="" data-figma-node={figmaNode} />
      <EmptyState showIcon={false} title={title} description={description} action={action} />
    </div>
  )
}
