import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectValue,
  SelectTrigger as UiSelectTrigger,
} from '@/components/ui/select'

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectValue,
}

export function SelectTrigger({ className, ...props }: React.ComponentProps<typeof UiSelectTrigger>) {
  return (
    <UiSelectTrigger
      className={cn(
        'border-v2-border bg-v2-surface text-v2-fg data-placeholder:text-v2-subtle focus-visible:border-v2-primary focus-visible:ring-v2-primary/20',
        className,
      )}
      {...props}
    />
  )
}
