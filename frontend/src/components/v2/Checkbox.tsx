import * as React from 'react'
import { cn } from '@/lib/utils'
import { Checkbox as UiCheckbox } from '@/components/ui/checkbox'

/**
 * V2 Checkbox — ui/Checkbox with V2 primary color when checked.
 */
export function Checkbox({ className, ...props }: React.ComponentProps<typeof UiCheckbox>) {
  return (
    <UiCheckbox
      className={cn(
        'border-v2-border-strong data-checked:border-v2-primary data-checked:bg-v2-primary data-checked:text-white focus-visible:border-v2-primary focus-visible:ring-v2-primary/20',
        className,
      )}
      {...props}
    />
  )
}
