import type { ReactNode } from 'react'
import { Icon, isIconName, type IconName } from './Icon'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface BadgeProps {
  label: string
  tone?: Tone
  status?: Tone
  size?: 'sm' | 'md'
  icon?: IconName | ReactNode
  showIcon?: boolean
}

export function Badge({ label, tone = 'neutral', status, size = 'sm', icon, showIcon }: BadgeProps) {
  const resolved = status ?? tone
  return (
    <span className={['cwgsyw-badge', `cwgsyw-badge--${size}`, `cwgsyw-badge--${resolved}`].join(' ')}>
      {showIcon && icon ? isIconName(icon) ? <Icon name={icon} size="sm" /> : icon : null}
      <span>{label}</span>
    </span>
  )
}

export function StatusBadge(props: BadgeProps) {
  return <Badge size={props.size ?? 'md'} {...props} />
}

export interface ChipProps {
  label: string
  size?: 'sm' | 'md'
  tone?: Tone
  selected?: boolean
  disabled?: boolean
  showRemove?: boolean
  onRemove?: () => void
  onClick?: () => void
}

export function Chip({ label, size = 'sm', tone = 'neutral', selected = false, disabled, showRemove, onRemove, onClick }: ChipProps) {
  const Comp = onClick ? 'button' : 'span'
  return (
    <Comp type={onClick ? 'button' : undefined} className={['cwgsyw-chip', `cwgsyw-chip--${size}`, `cwgsyw-chip--${tone}`].join(' ')} aria-pressed={selected || undefined} aria-disabled={disabled || undefined} disabled={onClick ? disabled : undefined} onClick={onClick}>
      {label}
      {showRemove ? (
        <button type="button" className="cwgsyw-chip__remove" aria-label={`移除 ${label}`} disabled={disabled} onClick={onRemove}>
          <Icon name="close" size="sm" />
        </button>
      ) : null}
    </Comp>
  )
}
