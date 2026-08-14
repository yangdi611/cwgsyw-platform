import type { ReactNode } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'
import { Spinner } from './Spinner'

export type FeedbackLayout = 'default' | 'compact'
export type FeedbackTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export function Skeleton({
  type = 'text',
  state = 'loading',
}: {
  type?: 'text' | 'avatar' | 'card' | 'table-row' | 'list-item'
  state?: 'static' | 'loading'
}) {
  return (
    <div className={['cwgsyw-skeleton', `cwgsyw-skeleton--${type}`, state === 'loading' ? 'cwgsyw-skeleton--loading' : ''].filter(Boolean).join(' ')} aria-hidden="true">
      {type === 'avatar' ? <div className="cwgsyw-skeleton__avatar" /> : null}
      <div className="cwgsyw-skeleton__bar" />
      {type !== 'text' ? <div className="cwgsyw-skeleton__bar" /> : null}
      {type === 'card' ? <div className="cwgsyw-skeleton__block" style={{ height: 72 }} /> : null}
    </div>
  )
}

export function EmptyState({
  title = '暂无内容',
  description = '当前没有可显示的内容。',
  showDescription = true,
  showIcon = true,
  action,
  showAction = Boolean(action),
  layout = 'default',
}: {
  title?: string
  description?: string
  showDescription?: boolean
  showIcon?: boolean
  action?: ReactNode
  showAction?: boolean
  layout?: FeedbackLayout
}) {
  return (
    <div className={['cwgsyw-state', `cwgsyw-state--${layout}`].join(' ')}>
      {showIcon ? <Icon name="inbox" size="lg" /> : null}
      <h2 className="cwgsyw-type-title-sm">{title}</h2>
      {showDescription ? <p className="cwgsyw-state__desc cwgsyw-type-body-sm">{description}</p> : null}
      {showAction ? action : null}
    </div>
  )
}

export function ErrorState({
  title = '加载失败',
  description = '暂时无法获取内容，请稍后重试。',
  showDescription = true,
  showIcon = true,
  retry,
  showRetry = Boolean(retry),
  layout = 'default',
}: {
  title?: string
  description?: string
  showDescription?: boolean
  showIcon?: boolean
  retry?: ReactNode
  showRetry?: boolean
  layout?: FeedbackLayout
}) {
  return (
    <div className={['cwgsyw-state', `cwgsyw-state--${layout}`].join(' ')} role="alert">
      {showIcon ? <Icon name="close" size="lg" /> : null}
      <h2 className="cwgsyw-type-title-sm">{title}</h2>
      {showDescription ? <p className="cwgsyw-state__desc cwgsyw-type-body-sm">{description}</p> : null}
      {showRetry ? retry ?? <Button variant="secondary">重试</Button> : null}
    </div>
  )
}

export function LoadingState({
  type = 'spinner',
  label = '正在加载内容',
  showLabel = true,
  layout = 'default',
  children,
}: {
  type?: 'spinner' | 'skeleton'
  label?: string
  showLabel?: boolean
  layout?: FeedbackLayout
  children?: ReactNode
}) {
  return (
    <div className={['cwgsyw-state', `cwgsyw-state--${layout}`].join(' ')} aria-busy="true" role="status">
      {type === 'spinner' ? <Spinner label={label} showLabel={showLabel} /> : <Skeleton type="card" />}
      {type === 'skeleton' && showLabel ? <p className="cwgsyw-type-label-sm">{label}</p> : null}
      {children}
    </div>
  )
}

export function Alert({
  tone = 'info',
  layout = 'default',
  title = '状态提示',
  description = '补充当前状态和下一步信息。',
  showDescription = true,
  showIcon = true,
  showDismiss = true,
  action,
  onDismiss,
}: {
  tone?: Exclude<FeedbackTone, 'neutral'>
  layout?: FeedbackLayout
  title?: string
  description?: string
  showDescription?: boolean
  showIcon?: boolean
  showDismiss?: boolean
  action?: ReactNode
  onDismiss?: () => void
}) {
  return (
    <div className={['cwgsyw-alert', `cwgsyw-alert--${layout}`].join(' ')} data-cwgsyw-feedback={tone} data-feedback-context={tone} role="status">
      {showIcon ? <Icon name="check" size="sm" /> : <span />}
      <div className="cwgsyw-alert__body">
        <div className="cwgsyw-type-label-md">{title}</div>
        {showDescription ? <div className="cwgsyw-type-body-sm">{description}</div> : null}
        {action}
      </div>
      {showDismiss ? (
        <button type="button" className="cwgsyw-alert__dismiss" aria-label="关闭提示" onClick={onDismiss}>
          <Icon name="close" size="sm" />
        </button>
      ) : null}
    </div>
  )
}

export function Toast({
  tone = 'neutral',
  layout = 'default',
  title = '操作完成',
  description = '当前操作已成功执行。',
  showDescription = true,
  showDismiss = true,
  action,
  onDismiss,
}: {
  tone?: FeedbackTone
  layout?: FeedbackLayout
  title?: string
  description?: string
  showDescription?: boolean
  showDismiss?: boolean
  action?: ReactNode
  onDismiss?: () => void
}) {
  return (
    <div className={['cwgsyw-toast', `cwgsyw-toast--${layout}`].join(' ')} data-cwgsyw-feedback={tone} data-feedback-context={tone === 'danger' ? 'danger' : tone === 'neutral' ? undefined : tone} role="status" aria-live="polite">
      <Icon name="check" size="sm" />
      <div className="cwgsyw-toast__body">
        <div className="cwgsyw-type-label-md">{title}</div>
        {showDescription ? <div className="cwgsyw-type-body-sm">{description}</div> : null}
        {action}
      </div>
      {showDismiss ? (
        <button type="button" className="cwgsyw-toast__dismiss" aria-label="关闭通知" onClick={onDismiss}>
          <Icon name="close" size="sm" />
        </button>
      ) : null}
    </div>
  )
}

export function Progress({
  value,
  label = '处理进度',
  showLabel = true,
  showPercentage = true,
  size = 'md',
  tone = 'neutral',
}: {
  value?: number
  label?: string
  showLabel?: boolean
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
  tone?: FeedbackTone
}) {
  const indeterminate = value == null
  const safe = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className={['cwgsyw-progress', `cwgsyw-progress--${size}`, `cwgsyw-progress--${tone}`].join(' ')}>
      {showLabel ? <div className="cwgsyw-type-label-sm">{label}</div> : null}
      <div
        className="cwgsyw-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : safe}
        aria-label={label}
      >
        <div className="cwgsyw-progress__bar" style={{ width: indeterminate ? '40%' : `${safe}%` }} />
      </div>
      {showPercentage && !indeterminate ? <div className="cwgsyw-type-label-xs">{safe}%</div> : null}
    </div>
  )
}
