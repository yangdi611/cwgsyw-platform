'use client'

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import * as React from 'react'

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger
export const AlertDialogPortal = AlertDialogPrimitive.Portal
export const AlertDialogAction = AlertDialogPrimitive.Action
export const AlertDialogCancel = AlertDialogPrimitive.Cancel
export const AlertDialogTitle = AlertDialogPrimitive.Title
export const AlertDialogDescription = AlertDialogPrimitive.Description

export const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(function AlertDialogOverlay({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      className={['cwgsyw-overlay-scrim', 'cwgsyw-dialog-overlay', className].filter(Boolean).join(' ')}
      {...props}
    />
  )
})

export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(function AlertDialogContent({ className, ...props }, ref) {
  return <AlertDialogPrimitive.Content ref={ref} className={['cwgsyw-dialog', className].filter(Boolean).join(' ')} {...props} />
})
