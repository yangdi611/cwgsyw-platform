import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-6 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface shadow-v2-sm">
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold text-v2-fg">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-v2-muted leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
