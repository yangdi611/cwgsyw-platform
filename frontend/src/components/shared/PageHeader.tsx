import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-6', className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-v2-primary">
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl font-bold text-v2-fg leading-tight">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm text-v2-muted leading-relaxed max-w-3xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          {actions}
        </div>
      )}
    </div>
  )
}
