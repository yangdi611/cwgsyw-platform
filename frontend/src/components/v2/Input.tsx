import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input as UiInput } from '@/components/ui/input'

/**
 * V2 Input — ui/Input with V2 Design Token overrides.
 * API identical to ui/Input; className is merged after v2 tokens.
 */
export function Input({ className, ...props }: React.ComponentProps<typeof UiInput>) {
  return (
    <UiInput
      className={cn(
        'border-v2-border bg-v2-surface text-v2-fg placeholder:text-v2-subtle focus-visible:border-v2-primary focus-visible:ring-v2-primary/20',
        className,
      )}
      {...props}
    />
  )
}
