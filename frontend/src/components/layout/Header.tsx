'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
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
    </header>
  )
}
