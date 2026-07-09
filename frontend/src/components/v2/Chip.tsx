import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

export type ChipVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

export interface ChipProps {
  children: ReactNode
  variant?: ChipVariant
  active?: boolean
  onClick?: () => void
  className?: string
}

const variantStyles: Record<ChipVariant, string> = {
  default: 'border-v2-border bg-v2-surface text-v2-fg',
  primary: 'border-v2-primary-border bg-v2-primary-soft text-v2-primary',
  success: 'border-v2-success-border bg-v2-success-soft text-v2-success',
  warning: 'border-v2-warning-border bg-v2-warning-soft text-v2-warning',
  danger: 'border-v2-danger-border bg-v2-danger-soft text-v2-danger',
  neutral: 'border-v2-border bg-v2-surface-soft text-v2-muted',
}

export function Chip({
  children,
  variant = 'default',
  active = false,
  onClick,
  className,
}: ChipProps) {
  const isInteractive = !!onClick
  const baseStyles = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium'

  const Component = isInteractive ? 'button' : 'span'

  return (
    <Component
      type={isInteractive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        baseStyles,
        variantStyles[variant],
        isInteractive && 'transition-colors hover:border-v2-primary-border hover:text-v2-fg',
        active && 'border-v2-primary bg-v2-primary-soft text-v2-primary',
        className,
      )}
    >
      {active && <Check className="h-3 w-3" />}
      {children}
    </Component>
  )
}
