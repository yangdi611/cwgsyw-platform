'use client'

import { useTheme } from 'next-themes'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { IconButton } from '@/design-system/figma-neutral/components'

export function Header({
  sidebarCollapsed,
  onOpenNavigation,
  onToggleSidebar,
}: {
  sidebarCollapsed: boolean
  onOpenNavigation: () => void
  onToggleSidebar: () => void
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <header className="cwgsyw-app-header">
      <div className="cwgsyw-app-header__context">
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          className="cwgsyw-app-header__sidebar-toggle"
          aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          icon={sidebarCollapsed ? <PanelLeftOpen className="size-[16px]" /> : <PanelLeftClose className="size-[16px]" />}
          onClick={onToggleSidebar}
        />
        <span className="cwgsyw-app-header__divider" aria-hidden="true" />
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          className="cwgsyw-app-header__nav-trigger"
          aria-label="打开导航"
          icon={<PanelLeftOpen className="size-[16px]" />}
          onClick={onOpenNavigation}
        />
        <div className="cwgsyw-app-header__breadcrumb">
          <Breadcrumb />
        </div>
      </div>
      <div className="cwgsyw-app-header__actions">
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          className="cwgsyw-app-header__theme-toggle"
          aria-label={isDark ? '切换至浅色模式' : '切换至深色模式'}
          icon={(
            <span
              className={`cwgsyw-app-header__figma-icon ${isDark ? 'cwgsyw-app-header__figma-icon--moon' : 'cwgsyw-app-header__figma-icon--sun'}`}
              aria-hidden="true"
            />
          )}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        />
        <NotificationBell />
      </div>
    </header>
  )
}
