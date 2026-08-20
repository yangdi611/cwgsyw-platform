'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'
import { useCommandPalette } from '@/store/commandPaletteStore'
import api from '@/lib/api'
import {
  Avatar,
  Button,
  IconButton,
  MenuItem,
} from '@/design-system/figma-neutral/components'
import { navItems } from './sidebar/navItems'
import { isGroup } from './sidebar/utils'
import { useOpenGroup } from './sidebar/useSidebarState'
import { NavGroupItem } from './sidebar/NavGroupItem'
import { CollapsedEntry } from './sidebar/CollapsedEntry'
import { getWorkItemCounts } from '@/lib/work-item-api'
import type { NavItem } from './sidebar/types'

const SIDEBAR_LOGO_URL = '/sidebar-logo.png'

export function Sidebar({
  collapsed,
  mobileOpen,
  onMobileOpenChange,
}: {
  collapsed: boolean
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const openPalette = useCommandPalette((state) => state.setOpen)
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

  const groups = resolvedNavItems.filter(isGroup)
  const initialOpenKey =
    groups.find((group) => {
      if (!isGroup(group)) return false
      if (group.resource && group.action && !hasPermission(group.resource, group.action)) return false
      return group.children.some((child) => (!child.requiredScope || child.requiredScope === groupScope)
        && pathname.startsWith(child.href))
    })?.storageKey ??
    groups.find((group) => isGroup(group) && group.defaultOpen && (!group.resource || !group.action || hasPermission(group.resource, group.action)))?.storageKey ??
    null

  const [openKey, toggleGroup] = useOpenGroup(initialOpenKey)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRegionRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const isCollapsed = mobileOpen ? false : collapsed
  const fallbackName = user?.realName?.trim() || user?.username?.trim() || 'U'
  const fallbackChar = Array.from(fallbackName)[0]?.toUpperCase() ?? 'U'

  const [schemaVersion, setSchemaVersion] = useState<string | null>(null)
  useEffect(() => {
    api.get('/system/info')
      .then((response) => setSchemaVersion(response.data?.data?.schema_version ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!userMenuOpen) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !userMenuRegionRef.current?.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUserMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [userMenuOpen])

  useEffect(() => {
    navItems.forEach((entry) => {
      if (isGroup(entry)) {
        try { localStorage.removeItem(entry.storageKey) } catch {}
      }
    })
  }, [])

  return (
    <>
      {mobileOpen ? (
        <IconButton
          type="button"
          variant="ghost"
          className="cwgsyw-mobile-nav-scrim"
          aria-label="关闭导航"
          onClick={() => onMobileOpenChange(false)}
        />
      ) : null}
      <aside
        className={cn(
          'cwgsyw-sidebar fixed inset-y-0 left-0 z-50 flex h-dvh min-h-0 flex-col overflow-hidden transition-[transform,width] duration-200 ease-out motion-reduce:transition-none md:sticky md:top-0 md:z-auto md:h-full md:translate-x-0',
          mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:translate-x-0',
          isCollapsed ? 'w-16 md:w-16' : 'w-[calc(100vw-48px)] max-w-80 md:w-[260px]',
          isCollapsed && 'cwgsyw-sidebar--collapsed',
        )}
      >
        <div className="cwgsyw-sidebar__brand">
          <div className="cwgsyw-sidebar__logomark" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- static product logo asset */}
            <img src={SIDEBAR_LOGO_URL} alt="" />
          </div>
          {!isCollapsed ? (
            <div className="cwgsyw-sidebar__brand-copy">
              <span className="cwgsyw-sidebar__brand-title">CWGSYW 平台</span>
              <span className="cwgsyw-sidebar__brand-subtitle">企业运维与 CMDB 工作台</span>
            </div>
          ) : null}
        </div>

        {!isCollapsed ? (
          <div className="cwgsyw-sidebar__search-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cwgsyw-sidebar__search"
              leadingIcon={<Search className="size-4" />}
              onClick={() => openPalette(true)}
            >
              搜索功能与页面…
            </Button>
          </div>
        ) : null}

        {isCollapsed ? (
          <nav className="cwgsyw-sidebar__collapsed-nav" aria-label="主导航">
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
          <nav className="cwgsyw-sidebar__nav" aria-label="主导航">
            <div className="cwgsyw-sidebar__section-title">核心工作</div>
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
                    onNavigate={() => onMobileOpenChange(false)}
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
                  onClick={() => onMobileOpenChange(false)}
                  className={cn('cwgsyw-sidebar__item', isActive && 'is-active')}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {badge !== undefined && badge > 0 ? (
                    <span className="cwgsyw-sidebar__badge">{badge > 99 ? '99+' : badge}</span>
                  ) : null}
                </Link>
              )
            })}
          </nav>
        )}

        <div ref={userMenuRegionRef} className="cwgsyw-sidebar__footer" data-figma-node="2:7746">
          <IconButton
            type="button"
            variant="ghost"
            className="cwgsyw-sidebar__user-trigger"
            aria-label="打开用户菜单"
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            icon={
              <span className={cn('cwgsyw-sidebar__user-avatar', !user?.avatarUrl && 'is-fallback')}>
                <Avatar
                  type={user?.avatarUrl ? 'image' : 'initials'}
                  size="md"
                  src={user?.avatarUrl ?? undefined}
                  alt={user?.realName || user?.username}
                  initials={fallbackChar}
                />
              </span>
            }
            onClick={() => setUserMenuOpen((open) => !open)}
          >
            {!isCollapsed ? (
              <>
                <span className="cwgsyw-sidebar__user-copy">
                  <span className="cwgsyw-sidebar__user-name" title={user?.realName || user?.username || undefined}>
                    {user?.realName || user?.username || '-'}
                  </span>
                  <span className="cwgsyw-sidebar__user-username" title={user?.username || undefined}>
                    {user?.username || '-'}
                  </span>
                </span>
                <span className="cwgsyw-sidebar__user-chevron" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element -- exact Figma chevrons-up-down asset */}
                  <img src="/figma-icons/sidebar-chevrons-up-down.svg" alt="" />
                </span>
              </>
            ) : null}
          </IconButton>
          <AnimatePresence initial={false}>
            {userMenuOpen ? (
              <motion.div
                key="sidebar-user-menu"
                className="cwgsyw-sidebar-user-menu"
                role="menu"
                aria-label="用户菜单"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                transition={reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
              <div className="cwgsyw-sidebar-user-menu__identity">
                <Avatar
                  type={user?.avatarUrl ? 'image' : 'initials'}
                  src={user?.avatarUrl ?? undefined}
                  alt={user?.realName || user?.username}
                  initials={fallbackChar}
                />
                <div>
                  <p className="cwgsyw-type-label-md">{user?.realName || '-'}</p>
                  <p className="cwgsyw-type-label-sm">@{user?.username}</p>
                </div>
              </div>
              <MenuItem label="个人资料" onClick={() => { router.push('/account/profile'); setUserMenuOpen(false) }} />
              <MenuItem label="修改密码" onClick={() => { router.push('/account/password'); setUserMenuOpen(false) }} />
              <MenuItem label={schemaVersion ? `Schema V${schemaVersion}` : 'Schema —'} disabled />
              <MenuItem label="退出登录" type="destructive" onClick={() => logout()} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </aside>
    </>
  )
}
