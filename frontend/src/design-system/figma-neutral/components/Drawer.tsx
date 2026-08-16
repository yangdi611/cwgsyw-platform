'use client'

import { Drawer as DrawerPrimitive } from 'vaul'
import type { ComponentProps } from 'react'

function classNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function Drawer(props: ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

export function DrawerTrigger(props: ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

export function DrawerPortal(props: ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

export function DrawerClose(props: ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

export function DrawerOverlay({ className, ...props }: ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={classNames(
        'cwgsyw-overlay-scrim data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  )
}

export function DrawerContent({ className, children, ...props }: ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content data-slot="drawer-content" className={className} {...props}>
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

export function DrawerHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="drawer-header" className={className} {...props} />
}

export function DrawerFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="drawer-footer" className={className} {...props} />
}

export function DrawerTitle(props: ComponentProps<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title data-slot="drawer-title" {...props} />
}

export function DrawerDescription(props: ComponentProps<typeof DrawerPrimitive.Description>) {
  return <DrawerPrimitive.Description data-slot="drawer-description" {...props} />
}
