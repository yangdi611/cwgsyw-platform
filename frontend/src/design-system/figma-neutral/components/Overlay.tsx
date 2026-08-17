'use client'

import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'
import { Tooltip } from '@base-ui/react/tooltip'
import { forwardRef, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
import { Button } from './Button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from './AlertDialog'
import { DateInput } from './DateInput'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from './Dialog'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from './Drawer'
import { IconButton } from './IconButton'
import { Input } from './Input'

export function MenuItem({
  label,
  shortcut,
  type = 'default',
  disabled,
  selected,
  onClick,
}: {
  label: string
  shortcut?: string
  type?: 'default' | 'checkbox' | 'radio' | 'submenu' | 'destructive'
  disabled?: boolean
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <button type="button" role="menuitem" className="cwgsyw-menu-item" data-type={type} data-selected={selected || undefined} disabled={disabled} onClick={onClick}>
      <span>{label}</span>
      {shortcut ? <kbd className="cwgsyw-type-label-xs">{shortcut}</kbd> : null}
    </button>
  )
}

export const MenuTriggerButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md' | 'lg'; variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' }
>(function MenuTriggerButton({
  size = 'md',
  variant = 'ghost',
  className,
  type,
  children,
  ...props
}, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type={type ?? 'button'}
      className={['cwgsyw-btn', `cwgsyw-btn--${size}`, `cwgsyw-btn--${variant}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
})

export function DropdownMenu({ trigger, children }: { trigger: ReactElement; children: ReactNode }) {
  return (
    <Menu.Root>
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup className="cwgsyw-menu">{children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export function NeutralTooltip({
  content,
  children,
  className,
  followCursor = false,
}: {
  content: string
  children: ReactNode
  className?: string
  followCursor?: boolean
}) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root trackCursorAxis={followCursor ? 'both' : 'none'}>
        <Tooltip.Trigger
          render={<span className="cwgsyw-tooltip-trigger" />}
          delay={followCursor ? 80 : undefined}
          closeDelay={followCursor ? 40 : undefined}
        >
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner
            side={followCursor ? 'bottom' : 'top'}
            sideOffset={followCursor ? 18 : 6}
            positionMethod={followCursor ? 'fixed' : 'absolute'}
            collisionPadding={8}
            collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }}
          >
            <Tooltip.Popup className={['cwgsyw-tooltip', className].filter(Boolean).join(' ')}>{content}</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

export function NeutralPopover({ title, children, trigger }: { title?: string; children: ReactNode; trigger: ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger render={<span />}>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup className="cwgsyw-popover">
            {title ? <div className="cwgsyw-type-label-md">{title}</div> : null}
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function NeutralDialog({
  open,
  onOpenChange,
  title,
  description,
  showDescription = true,
  showClose = true,
  size = 'md',
  intent = 'default',
  children,
  footer,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  showDescription?: boolean
  showClose?: boolean
  size?: 'sm' | 'md' | 'lg' | 'alert'
  intent?: 'default' | 'destructive'
  children?: ReactNode
  footer?: ReactNode
}) {
  const focusReturnRef = useRef<HTMLElement | null>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent
            {...(showDescription && description ? {} : { 'aria-describedby': undefined })}
            className={[`cwgsyw-dialog--${size}`, intent === 'destructive' ? 'cwgsyw-dialog--destructive' : ''].filter(Boolean).join(' ')}
            onOpenAutoFocus={() => {
              focusReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            }}
            onCloseAutoFocus={(event) => {
              if (!focusReturnRef.current?.isConnected) return
              event.preventDefault()
              focusReturnRef.current.focus()
              focusReturnRef.current = null
            }}
          >
            <div className="cwgsyw-dialog__header">
              <div className="cwgsyw-dialog__title-group">
                <DialogTitle className="cwgsyw-type-title-sm">{title}</DialogTitle>
                {showDescription && description ? <DialogDescription className="cwgsyw-type-body-sm">{description}</DialogDescription> : null}
              </div>
              {showClose ? (
                <DialogClose asChild>
                  <IconButton type="button" variant="ghost" size="sm" icon="close" aria-label="关闭对话框" />
                </DialogClose>
              ) : null}
            </div>
            {children ? <div className="cwgsyw-dialog__body">{children}</div> : null}
            {footer ? <div className="cwgsyw-dialog__footer">{footer}</div> : null}
          </DialogContent>
        </DialogPortal>
    </Dialog>
  )
}

export function NeutralAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  className,
  icon,
  intent = 'default',
  confirmLabel = '确认',
  cancelLabel = '取消',
  onConfirm,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  className?: string
  icon?: ReactNode
  intent?: 'default' | 'destructive'
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
}) {
  const focusReturnRef = useRef<HTMLElement | null>(null)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        <AlertDialogOverlay />
        <AlertDialogContent
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={['cwgsyw-dialog--alert', intent === 'destructive' ? 'cwgsyw-dialog--destructive' : '', className].filter(Boolean).join(' ')}
          onOpenAutoFocus={() => {
            focusReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          }}
          onCloseAutoFocus={(event) => {
            if (!focusReturnRef.current?.isConnected) return
            event.preventDefault()
            focusReturnRef.current.focus()
            focusReturnRef.current = null
          }}
        >
          <div className="cwgsyw-dialog__header">
            {icon ? <div className="cwgsyw-dialog__alert-icon">{icon}</div> : null}
            <div className="cwgsyw-dialog__title-group">
              <AlertDialogTitle className="cwgsyw-type-title-sm">{title}</AlertDialogTitle>
              {description ? <AlertDialogDescription className="cwgsyw-type-body-sm">{description}</AlertDialogDescription> : null}
            </div>
          </div>
          <div className="cwgsyw-dialog__footer">
            <div className="cwgsyw-dialog__action-group">
              <AlertDialogCancel asChild>
                <Button type="button" variant="secondary">{cancelLabel}</Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  type="button"
                  variant={intent === 'destructive' ? 'destructive' : 'primary'}
                  onClick={(event) => {
                    event.preventDefault()
                    onConfirm?.()
                  }}
                >
                  {confirmLabel}
                </Button>
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  )
}

export function NeutralDrawer({
  open,
  onOpenChange,
  title,
  description,
  side = 'right',
  className,
  showClose = false,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  side?: 'left' | 'right'
  className?: string
  showClose?: boolean
  children?: ReactNode
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction={side}>
      <DrawerContent className={['cwgsyw-drawer', `cwgsyw-drawer--${side}`, className].filter(Boolean).join(' ')}>
        <div className="cwgsyw-drawer__header">
          <div className="cwgsyw-drawer__title-group">
            <DrawerTitle className="cwgsyw-type-title-sm">{title}</DrawerTitle>
            {description ? <DrawerDescription className="cwgsyw-type-body-sm">{description}</DrawerDescription> : null}
          </div>
          {showClose ? (
            <DrawerClose asChild>
              <IconButton type="button" variant="ghost" size="sm" icon="close" aria-label="关闭" />
            </DrawerClose>
          ) : null}
        </div>
        {children ? <div className="cwgsyw-drawer__body">{children}</div> : null}
      </DrawerContent>
    </Drawer>
  )
}

export function Calendar({
  monthLabel = '2026 年 8 月',
  selected,
  onSelect,
}: {
  monthLabel?: string
  selected?: number
  onSelect?: (day: number) => void
}) {
  const days = useMemo(() => Array.from({ length: 31 }, (_, index) => index + 1), [])
  return (
    <div className="cwgsyw-calendar">
      <div className="cwgsyw-type-label-md">{monthLabel}</div>
      <div className="cwgsyw-calendar__grid" role="grid">
        {['一', '二', '三', '四', '五', '六', '日'].map((label) => (
          <div key={label} className="cwgsyw-type-label-xs">
            {label}
          </div>
        ))}
        {days.map((day) => (
          <CalendarDay key={day} day={day} selected={day === selected} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

export function DatePicker({ disabled, error }: { disabled?: boolean; error?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div data-state={disabled ? 'disabled' : open ? 'open' : error ? 'error' : 'closed'}>
      <DateInput disabled={disabled} error={error} onFocus={() => setOpen(true)} />
      {open && !disabled ? <Calendar /> : null}
    </div>
  )
}

export function DateRangePicker({
  disabled,
  error,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
}: {
  disabled?: boolean
  error?: boolean
  startValue?: string
  endValue?: string
  onStartChange?: (value: string) => void
  onEndChange?: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div data-state={disabled ? 'disabled' : open ? 'open' : error ? 'error' : 'closed'}>
      <div className="cwgsyw-inline-controls">
        <DateInput
          disabled={disabled}
          error={error}
          value={startValue}
          aria-label="开始日期"
          onChange={(event) => onStartChange?.(event.target.value)}
          onFocus={() => setOpen(true)}
        />
        <DateInput
          disabled={disabled}
          error={error}
          value={endValue}
          aria-label="结束日期"
          onChange={(event) => onEndChange?.(event.target.value)}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && !disabled ? <Calendar /> : null}
    </div>
  )
}

export function CommandPalette({
  items = [],
  state = 'results',
}: {
  items?: { id: string; label: string }[]
  state?: 'results' | 'empty' | 'loading'
}) {
  const [query, setQuery] = useState('')
  const filtered = items.filter((item) => item.label.includes(query))
  return (
    <div className="cwgsyw-command" role="dialog" aria-label="命令面板">
      <Input placeholder="搜索命令" value={query} onChange={(event) => setQuery(event.target.value)} />
      {state === 'loading' ? <div role="status">加载中</div> : null}
      {state === 'empty' || filtered.length === 0 ? <div>无结果</div> : null}
      <CommandGroup title="结果">
        {filtered.map((item) => (
          <CommandItem key={item.id} label={item.label} />
        ))}
      </CommandGroup>
    </div>
  )
}


export function CalendarDay({ day, selected, disabled, onSelect }: { day: number; selected?: boolean; disabled?: boolean; onSelect?: (day: number) => void }) {
  return (
    <button type="button" className="cwgsyw-calendar__day" aria-selected={selected} disabled={disabled} onClick={() => onSelect?.(day)}>
      {day}
    </button>
  )
}

export function CommandItem({ label, selected, disabled }: { label: string; selected?: boolean; disabled?: boolean }) {
  return (
    <li>
      <button type="button" className="cwgsyw-menu-item" data-selected={selected ? 'true' : undefined} disabled={disabled}>
        {label}
      </button>
    </li>
  )
}

export function CommandGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div>
      {title ? <div className="cwgsyw-type-label-xs">{title}</div> : null}
      <ul>{children}</ul>
    </div>
  )
}
