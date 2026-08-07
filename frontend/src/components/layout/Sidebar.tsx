'use client'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { getWorkItemCounts } from '@/lib/work-item-api'
import type { NavItem } from './sidebar/types'

export function Sidebar() {
  const pathname = usePathname()
  const { hasPermission } = usePermission()
  const groupScope = useAuthStore((state) => state.groupScope)
  const canReadWorkItems = hasPermission('work_item', 'read')
  const canReadAlerts = hasPermission('cmdb_alert', 'read')
  const canReadChangeDocs = hasPermission('change_doc', 'read')
  const workItemCounts = useQuery({
    queryKey: ['work-item-counts'],
    queryFn: getWorkItemCounts,
    enabled: canReadWorkItems,
    staleTime: 30_000,
  })
  const alertCount = useQuery({
    queryKey: ['cmdb-alerts', 'sidebar-count'],
    queryFn: () => api.get('/cmdb/alerts', {
      params: { status: 'firing', page: 1, size: 1 },
    }).then((response) => Number(response.data?.data?.total ?? 0)),
    enabled: canReadAlerts,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const changeDocCount = useQuery({
    queryKey: ['change-docs', 'sidebar-count'],
    queryFn: async () => {
      const [pending, planPending] = await Promise.all([
        api.get('/change-docs', { params: { status: 'pending', page: 1, size: 1 } }),
        api.get('/change-docs', { params: { status: 'plan_pending', page: 1, size: 1 } }),
      ])
      return Number(pending.data?.data?.total ?? 0) + Number(planPending.data?.data?.total ?? 0)
    },
    enabled: canReadChangeDocs,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const workBadge = (workItemCounts.data?.execute ?? 0) + (workItemCounts.data?.approve ?? 0)
  const badges: Record<NonNullable<NavItem['badgeKey']>, number> = {
    work: workBadge,
    alerts: alertCount.data ?? 0,
    changeDocs: changeDocCount.data ?? 0,
  }
  const resolvedNavItems = navItems.map((entry) => isGroup(entry)
    ? { ...entry, children: entry.children.map((child) => child.badgeKey ? { ...child, badge: badges[child.badgeKey] } : child) }
    : entry.badgeKey ? { ...entry, badge: badges[entry.badgeKey] } : entry)

  // 默认展开的一级菜单：优先「当前页所属组」，其次「defaultOpen」的组。
  const groups = resolvedNavItems.filter(isGroup)
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
        'bg-v2-sidebar text-v2-sidebar-fg border-r border-v2-sidebar-border flex min-h-0 h-full flex-col sticky top-0 overflow-x-visible transition-[width] duration-200 ease-out motion-reduce:transition-none',
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
          {resolvedNavItems.map((entry) => {
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
            {resolvedNavItems.map((entry) => {
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
          {resolvedNavItems.map((entry) => {
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
                  <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-v2-danger px-1.5 font-mono text-[11px] tabular-nums text-white">
                    {badge > 99 ? '99+' : badge}
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
