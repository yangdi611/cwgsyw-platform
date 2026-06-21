import * as React from 'react'
import { cn } from '@/lib/utils'
import { Switch as UiSwitch } from '@/components/ui/switch'

/**
 * V2 Switch — ui/Switch with V2 primary color when checked.
 */
export function Switch({ className, ...props }: React.ComponentProps<typeof UiSwitch>) {
  return (
    <UiSwitch
      className={cn(
        'data-checked:bg-v2-primary focus-visible:border-v2-primary focus-visible:ring-v2-primary/20',
        className,
      )}
      {...props}
    />
  )
}
