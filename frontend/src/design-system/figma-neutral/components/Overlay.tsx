'use client'

import { Dialog } from '@base-ui/react/dialog'
import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'
import { Tooltip } from '@base-ui/react/tooltip'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Button } from './Button'
import { DateInput } from './DateInput'
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

export function DropdownMenu({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (
    <Menu.Root>
      <Menu.Trigger render={<span />}>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup className="cwgsyw-menu">{children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export function NeutralTooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger render={<span />}>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup className="cwgsyw-tooltip">{content}</Tooltip.Popup>
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
  children,
  footer,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  showDescription?: boolean
  showClose?: boolean
  size?: 'sm' | 'md' | 'lg'
  children?: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="cwgsyw-overlay-scrim" />
        <Dialog.Popup className={['cwgsyw-dialog', `cwgsyw-dialog--${size}`].join(' ')}>
          <div>
            <Dialog.Title className="cwgsyw-type-title-sm">{title}</Dialog.Title>
            {showDescription && description ? <Dialog.Description className="cwgsyw-type-body-sm">{description}</Dialog.Description> : null}
          </div>
          {children}
          {footer}
          {showClose ? (
            <Dialog.Close render={<Button variant="ghost" size="sm" />}>
              关闭
            </Dialog.Close>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function NeutralAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  intent = 'default',
  confirmLabel = '确认',
  cancelLabel = '取消',
  onConfirm,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  intent?: 'default' | 'destructive'
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
}) {
  return (
    <NeutralDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      showClose={false}
      footer={
        <div className="cwgsyw-form__actions">
          <Button type="button" variant="secondary" onClick={() => onOpenChange?.(false)}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={intent === 'destructive' ? 'destructive' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    />
  )
}

export function NeutralDrawer({
  open,
  onOpenChange,
  title,
  description,
  side = 'right',
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  side?: 'left' | 'right'
  children?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="cwgsyw-overlay-scrim" />
        <Dialog.Popup className={['cwgsyw-drawer', `cwgsyw-drawer--${side}`].join(' ')}>
          <Dialog.Title className="cwgsyw-type-title-sm">{title}</Dialog.Title>
          {description ? <Dialog.Description className="cwgsyw-type-body-sm">{description}</Dialog.Description> : null}
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
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
