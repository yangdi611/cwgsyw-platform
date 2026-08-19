'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const WikiShellHeaderHostContext = createContext<HTMLElement | null>(null)

export function WikiShellHeaderProvider({
  host,
  children,
}: {
  host: HTMLElement | null
  children: ReactNode
}) {
  return <WikiShellHeaderHostContext.Provider value={host}>{children}</WikiShellHeaderHostContext.Provider>
}

export function WikiShellHeader({ children }: { children: ReactNode }) {
  const host = useContext(WikiShellHeaderHostContext)
  if (!host) return <>{children}</>
  return createPortal(children, host)
}
