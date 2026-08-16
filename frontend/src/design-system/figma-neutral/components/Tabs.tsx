import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { motion } from 'motion/react'

export interface TabItem {
  id: string
  label: string
  disabled?: boolean
  panel: ReactNode
  badge?: ReactNode
}

export interface TabsProps {
  items: TabItem[]
  value?: string
  defaultValue?: string
  onChange?: (id: string) => void
  style?: 'underline' | 'segmented' | 'cmdb'
  size?: 'sm' | 'md'
}

export function Tabs({ items, value, defaultValue, onChange, style = 'underline', size = 'md' }: TabsProps) {
  const baseId = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? items[0]?.id)
  const selected = value ?? uncontrolled
  const select = (id: string) => {
    if (value == null) setUncontrolled(id)
    onChange?.(id)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = items.filter((item) => !item.disabled)
    const index = enabled.findIndex((item) => item.id === selected)
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      select(enabled[(index + 1) % enabled.length].id)
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      select(enabled[(index - 1 + enabled.length) % enabled.length].id)
    }
  }

  return (
    <div>
      <TabsList className={['cwgsyw-tabs', `cwgsyw-tabs--${style}`, `cwgsyw-tabs--${size}`].join(' ')} onKeyDown={onKeyDown}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${item.id}`}
            aria-controls={`${baseId}-panel-${item.id}`}
            aria-selected={item.id === selected}
            disabled={item.disabled}
            tabIndex={item.id === selected ? 0 : -1}
            className={style === 'cmdb' ? 'cwgsyw-tab cwgsyw-cmdb-tab' : 'cwgsyw-tab'}
            onClick={() => select(item.id)}
          >
            {style === 'cmdb' && item.id === selected ? (
              <motion.span
                className="cwgsyw-cmdb-tab-indicator"
                layoutId={`${baseId}-cmdb-tab-indicator`}
                transition={{ type: 'spring', stiffness: 180, damping: 26, bounce: 0 }}
              />
            ) : null}
            <span className="cwgsyw-cmdb-tab-label">{item.label}</span>
            {item.badge}
          </button>
        ))}
      </TabsList>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== selected}
        >
          {item.panel}
        </div>
      ))}
    </div>
  )
}


export function TabsList({ children, className, onKeyDown }: { children: ReactNode; className?: string; onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void }) {
  return (
    <div className={className} role="tablist" onKeyDown={onKeyDown}>
      {children}
    </div>
  )
}
