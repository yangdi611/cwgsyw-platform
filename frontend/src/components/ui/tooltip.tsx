"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({ ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" {...props} />
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: TooltipPrimitive.Popup.Props & {
  sideOffset?: number
}) {
  return (
    <TooltipPrimitive.Positioner sideOffset={sideOffset} className="z-50">
      <TooltipPrimitive.Popup
        data-slot="tooltip-content"
        className={cn(
          "max-w-xs rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fill-mode-forwards",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Positioner>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipPrimitive, TooltipTrigger }
