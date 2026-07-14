'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { navItems } from './sidebar/navItems'
import { isGroup } from './sidebar/utils'
import { useOpenGroup, useCollapsed } from './sidebar/useSidebarState'
import { NavGroupItem } from './sidebar/NavGroupItem'
import { CollapsedEntry } from './sidebar/CollapsedEntry'

export function Sidebar() {
  const pathname = usePathname()
  const { hasPermission } = usePermission()
  const groupScope = useAuthStore((state) => state.groupScope)

  // 默认展开的一级菜单：优先「当前页所属组」，其次「defaultOpen」的组。
  const groups = navItems.filter(isGroup)
  const initialOpenKey =
    groups.find(g => {
      if (!isGroup(g)) return false
      if (g.resource && g.action && !hasPermission(g.resource, g.action)) return false
      return g.children?.some(c => (!c.requiredScope || c.requiredScope === groupScope)
        && pathname.startsWith(c.href))
    })?.storageKey ??
    groups.find(g => isGroup(g) && g.defaultOpen && (!g.resource || !g.action || hasPermission(g.resource, g.action)))?.storageKey ??
    null

  const [openKey, toggleGroup] = useOpenGroup(initialOpenKey)
  const [collapsed, toggleCollapsed] = useCollapsed()

  const [schemaVersion, setSchemaVersion] = useState<string | null>(null)
  useEffect(() => {
    api.get('/system/info')
      .then(res => setSchemaVersion(res.data?.data?.schema_version ?? null))
      .catch(() => {})
  }, [])

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'
  const gitCommit = (process.env.NEXT_PUBLIC_GIT_COMMIT ?? 'dev').slice(0, 7)

  // 一次性迁移清理：移除旧版遗留的 localStorage key
  useEffect(() => {
    navItems.forEach(entry => {
      if (isGroup(entry)) {
        try { localStorage.removeItem(entry.storageKey) } catch {}
      }
    })
  }, [])

  return (
    <aside
      className={cn(
        'bg-gradient-to-b from-v2-sidebar to-v2-sidebar-2 text-v2-sidebar-fg border-r border-v2-sidebar-border flex flex-col min-h-screen sticky top-0 h-screen overflow-x-visible transition-[width] duration-200 ease-out motion-reduce:transition-none',
        collapsed ? 'w-[76px]' : 'w-[76px] md:w-[280px]',
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'h-14 flex items-center border-b border-v2-sidebar-border shrink-0',
          collapsed ? 'justify-center px-2' : 'justify-center px-2 md:justify-start md:gap-3 md:px-5',
        )}
      >
        <div className="w-[34px] h-[34px] rounded-[10px] bg-gradient-to-br from-blue-500 to-teal-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)] shrink-0" />
        {!collapsed && (
          <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold leading-tight tracking-tight whitespace-nowrap">CWGSYW 平台</div>
              <div className="text-xs text-v2-sidebar-muted mt-0.5 whitespace-nowrap">企业运维与 CMDB 工作台</div>
            </div>
            <button
              onClick={toggleCollapsed}
              title="收起侧栏"
              className="shrink-0 rounded-md p-1.5 text-v2-sidebar-muted transition-colors hover:bg-white/8 hover:text-white"
            >
              <PanelLeftClose className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center py-2 shrink-0">
          <button
            onClick={toggleCollapsed}
            title="展开侧栏"
            className="rounded-md p-1.5 text-v2-sidebar-muted transition-colors hover:bg-white/8 hover:text-white"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}

      {/* Navigation */}
      {collapsed ? (
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-visible">
          {navItems.map((entry) => {
            if (isGroup(entry) && entry.resource && entry.action && !hasPermission(entry.resource, entry.action)) return null
            return (
              <CollapsedEntry
                key={isGroup(entry) ? entry.label : entry.href}
                entry={entry}
                pathname={pathname}
                hasPermission={hasPermission}
                groupScope={groupScope}
              />
            )
          })}
        </nav>
      ) : (
        <>
          <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-visible p-2 md:hidden">
            {navItems.map((entry) => {
              if (isGroup(entry) && entry.resource && entry.action && !hasPermission(entry.resource, entry.action)) return null
              return (
                <CollapsedEntry
                  key={isGroup(entry) ? entry.label : entry.href}
                  entry={entry}
                  pathname={pathname}
                  hasPermission={hasPermission}
                  groupScope={groupScope}
                />
              )
            })}
          </nav>
          <nav className="hidden flex-1 space-y-1 overflow-y-auto p-3 md:block">
          {navItems.map((entry) => {
            if (isGroup(entry)) {
              if (entry.resource && entry.action && !hasPermission(entry.resource, entry.action)) return null
              return (
                <NavGroupItem
                  key={entry.label}
                  group={entry}
                  pathname={pathname}
                  hasPermission={hasPermission}
                  groupScope={groupScope}
                  isOpen={openKey === entry.storageKey}
                  onToggle={() => toggleGroup(entry.storageKey)}
                />
              )
            }

            const { href, label, icon: Icon, resource, action, badge } = entry
            if (resource && action && !hasPermission(resource, action)) return null
            const isActive = pathname === href

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600/30 text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.22)]'
                    : 'text-slate-300 hover:bg-white/6 hover:text-white'
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0 opacity-85" />
                <span className="flex-1 truncate">{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-white/10 text-blue-200 text-[11px] font-mono tabular-nums">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
          </nav>
        </>
      )}

      {/* Footer: Version Info（折叠态隐藏） */}
      {!collapsed && (
        <div className="hidden shrink-0 space-y-2 border-t border-v2-sidebar-border px-4 py-3 md:block">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-v2-sidebar-muted">App</span>
            <span
              className="text-[11px] font-mono text-slate-300 bg-white/8 px-1.5 py-0.5 rounded"
              title={`build ${gitCommit}`}
            >
              v{appVersion}
              <span className="text-slate-500 ml-1">·{gitCommit}</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-v2-sidebar-muted">Schema</span>
            <span className="text-[11px] font-mono text-slate-300 bg-white/8 px-1.5 py-0.5 rounded">
              {schemaVersion ? `V${schemaVersion}` : '—'}
            </span>
          </div>
          <div className="pt-1 border-t border-white/8 flex items-center justify-between">
            <span className="text-[10px] text-v2-sidebar-muted">© 2026 All rights reserved</span>
            <a
              href="https://github.com/cwgsyw/platform"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      )}
    </aside>
  )
}
