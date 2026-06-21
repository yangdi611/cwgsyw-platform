import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface FilterBarProps {
  children: ReactNode
  className?: string
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {children}
    </div>
  )
}

export interface FilterChipProps {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}

export function FilterChip({ active = false, onClick, children, className }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-8 px-3 rounded-full border text-xs font-semibold transition-all',
        active
          ? 'bg-v2-primary-soft text-v2-primary border-v2-primary-border'
          : 'bg-v2-surface text-v2-muted border-v2-border hover:border-v2-border-strong hover:bg-v2-surface-hover',
        className
      )}
    >
      {children}
    </button>
  )
}
