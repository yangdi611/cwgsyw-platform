import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from './Icon'
import { Spinner } from './Spinner'
import type { ControlSize } from './Input'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  id?: string
  className?: string
  size?: ControlSize
  error?: boolean
  disabled?: boolean
  loading?: boolean
  overlay?: boolean
  open?: boolean
  defaultOpen?: boolean
  placeholder?: string
  value?: string
  options?: SelectOption[]
  'aria-describedby'?: string
  'aria-label'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-required'?: boolean | 'true' | 'false'
  onChange?: (value: string) => void
  onOpenChange?: (open: boolean) => void
}

export function Select({
  id,
  className,
  size = 'md',
  error = false,
  disabled = false,
  loading = false,
  overlay = false,
  open,
  defaultOpen = false,
  placeholder = '请选择',
  value,
  options = [],
  onChange,
  onOpenChange,
  ...aria
}: SelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isOpen = open ?? uncontrolledOpen
  const selected = options.find((option) => option.value === value)
  const setOpen = useCallback((next: boolean) => {
    if (open == null) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }, [onOpenChange, open])

  useEffect(() => {
    if (!isOpen) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [isOpen, setOpen])

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape') setOpen(false)
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  return (
    <div ref={rootRef} className={[overlay ? 'cwgsyw-select' : '', className].filter(Boolean).join(' ') || undefined}>
      <button
        {...aria}
        id={id}
        type="button"
        className={['cwgsyw-control', `cwgsyw-control--${size}`, error ? 'cwgsyw-control--error' : ''].filter(Boolean).join(' ')}
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setOpen(!isOpen)}
        onKeyDown={onKeyDown}
      >
        <span style={{ flex: 1, textAlign: 'left', color: selected ? undefined : 'var(--cwgsyw-text-tertiary)' }}>
          {selected?.label ?? placeholder}
        </span>
        {loading ? <Spinner size="sm" showLabel={false} /> : <Icon name="chevron-down" size="sm" />}
      </button>
      {isOpen ? (
        <ul id={listId} className={`cwgsyw-listbox${overlay ? ' cwgsyw-listbox--overlay' : ''}`} role="listbox">
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                onClick={() => {
                  onChange?.(option.value)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function Combobox({
  id,
  size = 'md',
  error = false,
  disabled = false,
  loading = false,
  placeholder = '搜索并选择',
  value,
  options = [],
  onChange,
  ...aria
}: SelectProps) {
  const listId = useId()
  const [query, setQuery] = useState(value ?? '')
  const [isOpen, setOpen] = useState(false)
  const filtered = useMemo(
    () => options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  )

  return (
    <div>
      <div className={['cwgsyw-control', `cwgsyw-control--${size}`, error ? 'cwgsyw-control--error' : ''].filter(Boolean).join(' ')}>
        <input
          {...aria}
          id={id}
          disabled={disabled || loading}
          placeholder={placeholder}
          value={query}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false)
          }}
        />
        <Icon name="chevron-down" size="sm" />
      </div>
      {isOpen ? (
        <ul id={listId} className="cwgsyw-listbox" role="listbox">
          {filtered.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  setQuery(option.label)
                  onChange?.(option.value)
                  setOpen(false)
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
