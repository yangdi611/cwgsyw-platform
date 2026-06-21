import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogClose,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogContent as UiDialogContent,
  DialogDescription as UiDialogDescription,
  DialogFooter as UiDialogFooter,
} from '@/components/ui/dialog'

/**
 * V2 Dialog — ui/Dialog with V2 surface tokens on Content / Description / Footer.
 * Root / Trigger / Header / Title re-exported unchanged.
 */
export { Dialog, DialogClose, DialogTrigger, DialogPortal, DialogOverlay, DialogHeader, DialogTitle }

export function DialogContent({ className, ...props }: React.ComponentProps<typeof UiDialogContent>) {
  return (
    <UiDialogContent
      className={cn('bg-v2-surface text-v2-fg ring-v2-border', className)}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof UiDialogDescription>) {
  return <UiDialogDescription className={cn('text-v2-muted', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.ComponentProps<typeof UiDialogFooter>) {
  return (
    <UiDialogFooter
      className={cn('border-v2-border bg-v2-surface-soft', className)}
      {...props}
    />
  )
}
