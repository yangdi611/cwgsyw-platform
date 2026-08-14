export type SpinnerSize = 'sm' | 'md' | 'lg'
export type SpinnerTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface SpinnerProps {
  size?: SpinnerSize
  tone?: SpinnerTone
  label?: string
  showLabel?: boolean
  className?: string
}

export function Spinner({
  size = 'sm',
  tone = 'neutral',
  label = '加载中',
  showLabel = true,
  className,
}: SpinnerProps) {
  return (
    <span
      className={['cwgsyw-spinner', `cwgsyw-spinner--${size}`, `cwgsyw-spinner--${tone}`, className]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="cwgsyw-spinner__mark" />
      {showLabel ? <span className="cwgsyw-type-label-sm">{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  )
}
