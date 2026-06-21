import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: 'ok' | 'warn' | 'danger' | 'neutral'
}

export function StatusBadge({ status, className, children, ...props }: StatusBadgeProps) {
  const variants = {
    ok: 'bg-v2-success-soft text-v2-success border-v2-success-border',
    warn: 'bg-v2-warning-soft text-v2-warning border-v2-warning-border',
    danger: 'bg-v2-danger-soft text-v2-danger border-v2-danger-border',
    neutral: 'bg-v2-surface-soft text-v2-muted border-v2-border',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border',
        variants[status],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
