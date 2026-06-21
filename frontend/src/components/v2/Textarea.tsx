import * as React from 'react'
import { cn } from '@/lib/utils'
import { Textarea as UiTextarea } from '@/components/ui/textarea'

/**
 * V2 Textarea — ui/Textarea with V2 Design Token overrides.
 */
export function Textarea({ className, ...props }: React.ComponentProps<typeof UiTextarea>) {
  return (
    <UiTextarea
      className={cn(
        'border-v2-border bg-v2-surface text-v2-fg placeholder:text-v2-subtle focus-visible:border-v2-primary focus-visible:ring-v2-primary/20',
        className,
      )}
      {...props}
    />
  )
}
