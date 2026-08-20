import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, isIconName, type IconName } from './Icon'
import { Spinner } from './Spinner'

export type IconButtonSize = 'sm' | 'md' | 'lg'
export type IconButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize
  variant?: IconButtonVariant
  loading?: boolean
  icon?: IconName | ReactNode
  'aria-label': string
}

export function IconButton({
  size = 'md',
  variant = 'primary',
  loading = false,
  disabled,
  icon = 'close',
  className,
  type,
  children,
  ...props
}: IconButtonProps) {
  const isDisabled = Boolean(disabled || loading)
  return (
    <button
      {...props}
      type={type ?? 'button'}
      className={['cwgsyw-icon-btn', `cwgsyw-icon-btn--${size}`, `cwgsyw-icon-btn--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
    >
      {loading ? (
        <Spinner size="sm" showLabel={false} label={props['aria-label']} />
      ) : isIconName(icon) ? (
        <Icon name={icon} size={size} />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}
