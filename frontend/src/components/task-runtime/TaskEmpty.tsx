import type { ReactNode } from 'react'
import { EmptyState } from '@/design-system/figma-neutral/components'

export const TASK_CLIPBOARD_LIST_ICON = '/figma-icons/task-clipboard-list.svg'
export const TASK_LAYOUT_TEMPLATE_ICON = '/figma-icons/task-layout-template.svg'
export const TASK_CALENDAR_CLOCK_ICON = '/figma-icons/task-calendar-clock.svg'
export const TASK_TARGET_ICON = '/figma-icons/task-target.svg'
export const TASK_ZAP_ICON = '/figma-icons/task-zap.svg'
export const TASK_BAR_CHART_ICON = '/figma-icons/task-bar-chart-3.svg'
export const TASK_TRASH_ICON = '/figma-icons/cmdb-admin-trash-2.svg'
export const TASK_PLAY_ICON = '/figma-icons/workflow-play.svg'
export const TASK_PAUSE_ICON = '/figma-icons/workflow-pause.svg'
export const IDENTITY_USER_ICON = '/figma-icons/identity-user.svg'
export const IDENTITY_ARCHIVE_ICON = '/figma-icons/identity-archive.svg'
export const IDENTITY_LOCK_ICON = '/figma-icons/identity-lock.svg'

export const TASK_CLIPBOARD_LIST_NODE = '6:24490'
export const TASK_LAYOUT_TEMPLATE_NODE = '6:27507'
export const TASK_CALENDAR_CLOCK_NODE = '6:24038'
export const TASK_TARGET_NODE = '6:30124'
export const TASK_ZAP_NODE = '6:30954'
export const TASK_BAR_CHART_NODE = '6:23539'
export const TASK_PLAY_NODE = '6:28749'
export const TASK_PAUSE_NODE = '6:28585'
export const IDENTITY_USER_NODE = '683:13600'
export const IDENTITY_ARCHIVE_NODE = '6:23304'
export const IDENTITY_LOCK_NODE = '6:27761'

const TRASH_PATH = 'M7 3C7 2.82523 7.09745 2.56676 7.33211 2.33211C7.56676 2.09745 7.82523 2 8 2H12C12.1748 2 12.4332 2.09745 12.6679 2.33211C12.9025 2.56676 13 2.82523 13 3V4H7V3ZM5 4V3C5 2.17477 5.40255 1.43324 5.91789 0.917893C6.43324 0.402547 7.17477 0 8 0H12C12.8252 0 13.5668 0.402547 14.0821 0.917893C14.5975 1.43324 15 2.17477 15 3V4H17H19C19.5523 4 20 4.44772 20 5C20 5.55228 19.5523 6 19 6H18V19C18 19.8252 17.5975 20.5668 17.0821 21.0821C16.5668 21.5975 15.8252 22 15 22H5C4.17477 22 3.43324 21.5975 2.91789 21.0821C2.40255 20.5668 2 19.8252 2 19V6H1C0.447715 6 0 5.55228 0 5C0 4.44772 0.447715 4 1 4H3H5ZM14 6H6H4V19C4 19.1748 4.09745 19.4332 4.33211 19.6679C4.56676 19.9025 4.82523 20 5 20H15C15.1748 20 15.4332 19.9025 15.6679 19.6679C15.9025 19.4332 16 19.1748 16 19V6H14ZM8 9C8.55229 9 9 9.44771 9 10V16C9 16.5523 8.55229 17 8 17C7.44772 17 7 16.5523 7 16V10C7 9.44771 7.44772 9 8 9ZM13 10C13 9.44771 12.5523 9 12 9C11.4477 9 11 9.44771 11 10V16C11 16.5523 11.4477 17 12 17C12.5523 17 13 16.5523 13 16V10Z'

export function FigmaTrashIcon({ className }: { className?: string } = {}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 22"
      className={['cwgsyw-tasks-figma-icon', 'cwgsyw-tasks-figma-icon--trash', 'cwgsyw-tasks-figma-icon--inline', className].filter(Boolean).join(' ')}
    >
      <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d={TRASH_PATH} />
    </svg>
  )
}


export function TaskEmpty({
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
    <div className="cwgsyw-tasks-empty">
      {/* The exact 22px Figma SVG should be served directly; image optimization adds no value here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconSrc} width={22} height={22} alt="" data-figma-node={figmaNode} />
      <EmptyState showIcon={false} title={title} description={description} action={action} />
    </div>
  )
}

export function TaskPanel({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="cwgsyw-tasks-panel">
      <header>
        <span>{title}</span>
        {action}
      </header>
      {description ? <p className="cwgsyw-tasks-panel__desc">{description}</p> : null}
      <div className="cwgsyw-tasks-panel__body">{children}</div>
    </section>
  )
}
