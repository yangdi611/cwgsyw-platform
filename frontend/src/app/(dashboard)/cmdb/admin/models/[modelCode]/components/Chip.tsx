import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export function Chip({
  label,
  active = false,
  onClick,
}: {
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        active
          ? 'border-v2-primary bg-v2-primary-soft text-v2-primary'
          : 'border-v2-border bg-v2-surface text-v2-muted hover:border-v2-primary-border hover:text-v2-fg',
      )}
    >
      {active && <Check className="h-3 w-3" />}
      {label}
    </button>
  )
}
