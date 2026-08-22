'use client'

import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from '@/design-system/figma-neutral/components'

const WikiShellHeaderHostContext = createContext<HTMLElement | null>(null)
const WikiShellToggleContext = createContext<{
  collapsed: boolean
  setCollapsed: Dispatch<SetStateAction<boolean>>
} | null>(null)

export function WikiShellHeaderProvider({
  host,
  collapsed,
  setCollapsed,
  children,
}: {
  host: HTMLElement | null
  collapsed: boolean
  setCollapsed: Dispatch<SetStateAction<boolean>>
  children: ReactNode
}) {
  return (
    <WikiShellHeaderHostContext.Provider value={host}>
      <WikiShellToggleContext.Provider value={{ collapsed, setCollapsed }}>
        {children}
      </WikiShellToggleContext.Provider>
    </WikiShellHeaderHostContext.Provider>
  )
}

export function WikiShellHeader({ children }: { children: ReactNode }) {
  const host = useContext(WikiShellHeaderHostContext)
  if (!host) return <>{children}</>
  return createPortal(children, host)
}

export function WikiShellToggle() {
  const ctx = useContext(WikiShellToggleContext)
  if (!ctx) return null
  return (
    <IconButton
      type="button"
      variant="ghost"
      size="sm"
      className="cwgsyw-wiki-shell__toggle"
      icon={ctx.collapsed ? 'chevron-next' : 'chevron-previous'}
      aria-expanded={!ctx.collapsed}
      aria-label={ctx.collapsed ? '展开目录' : '收起目录'}
      onClick={() => ctx.setCollapsed((value) => !value)}
    />
  )
}
