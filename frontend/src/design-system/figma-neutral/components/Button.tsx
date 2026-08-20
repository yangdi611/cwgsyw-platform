import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, isIconName, type IconName } from './Icon'
import { Spinner } from './Spinner'

export type ButtonSize = 'sm' | 'md' | 'lg'
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize
  variant?: ButtonVariant
  loading?: boolean
  leadingIcon?: IconName | ReactNode
  trailingIcon?: IconName | ReactNode
}

function renderIcon(value: IconName | ReactNode | undefined, size: ButtonSize) {
  if (!value) return null
  if (isIconName(value)) return <Icon name={value} size={size} />
  return value
}

export function Button({
  size = 'md',
  variant = 'primary',
  loading = false,
  disabled,
  leadingIcon,
  trailingIcon,
  className,
  children,
  type,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading)
  return (
    <button
      {...props}
      type={type ?? 'button'}
      className={['cwgsyw-btn', `cwgsyw-btn--${size}`, `cwgsyw-btn--${variant}`, className].filter(Boolean).join(' ')}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
    >
      {renderIcon(leadingIcon, size)}
      <span>{children}</span>
      {renderIcon(trailingIcon, size)}
      {loading ? <Spinner size="sm" tone={variant === 'destructive' ? 'danger' : 'neutral'} showLabel={false} label="加载中" /> : null}
    </button>
  )
}
