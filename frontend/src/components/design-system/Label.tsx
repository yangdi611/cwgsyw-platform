import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label as UiLabel } from '@/components/ui/label'

export function Label({ className, ...props }: React.ComponentProps<typeof UiLabel>) {
  return <UiLabel className={cn('text-v2-fg', className)} {...props} />
}
