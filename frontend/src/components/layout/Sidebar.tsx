'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import {
  FileText,
  CheckSquare,
  Users,
  Building2,
  Shield,
  LayoutDashboard,
  KeyRound,
  Bell,
  Settings,
  Bot,
  BarChart2,
  ClipboardList,
  FileCode,
  ServerCog,
  Database,
  History,
  Globe,
  Box,
  Grid3x3,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: any
  resource: string | null
  action: string | null
}

type NavGroup = {
  label: string
  icon: any
  children: (NavItem | NavGroup)[]
  storageKey: string
  defaultOpen?: boolean
  resource: string | null
  action: string | null
}

type NavEntry = NavItem | NavGroup

function isGroup(item: NavEntry): item is NavGroup {
  return 'children' in item
}

const navItems: NavEntry[] = [
  { href: '/',               label: '首页',     icon: LayoutDashboard, resource: null,           action: null },
  { href: '/daily',          label: '我的日报', icon: FileText,        resource: 'daily_report', action: 'read' },
  { href: '/workflow/tasks', label: '待审批',   icon: CheckSquare,     resource: 'workflow',     action: 'read' },
  { href: '/devices',        label: '设备密码库', icon: KeyRound,       resource: 'device',       action: 'read' },
  { href: '/notifications',  label: '通知中心',   icon: Bell,            resource: 'notification',  action: 'read' },
  {
    label: 'CMDB',
    icon: ServerCog,
    resource: 'cmdb_model',
    action: 'read',
    storageKey: 'sidebar-cmdb',
    defaultOpen: true,
    children: [
      { href: '/cmdb/models',           label: '模型管理', icon: Box,      resource: 'cmdb_model',    action: 'read' },
      { href: '/cmdb/instances',        label: '实例管理', icon: Database, resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/changes',          label: '变更历史', icon: History,  resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/alerts',           label: 'CMDB 警告', icon: Bell,      resource: 'cmdb_alert',   action: 'read' },
      { href: '/cmdb/changes/stats',    label: '统计看板', icon: BarChart2, resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/instances/2d-view', label: '2D 视图', icon: Grid3x3, resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/admin',            label: '配置管理', icon: Settings, resource: 'cmdb_model',    action: 'write' },
    ],
  },
  { href: '/ipam',           label: 'IP 地址池',   icon: Globe,           resource: 'ip_pool',       action: 'read' },
  { href: '/change-docs',    label: '变更文档',   icon: FileText,        resource: 'change_doc',    action: 'read' },
  { href: '/reports',        label: '报表导出',   icon: BarChart2,      resource: 'daily_report', action: 'export' },
  { href: '/users',          label: '用户管理', icon: Users,           resource: 'user',          action: 'read' },
  { href: '/groups',         label: '组管理',   icon: Building2,       resource: 'group',         action: 'read' },
  { href: '/rbac/roles',     label: '角色权限', icon: Shield,          resource: 'role',          action: 'read' },
  { href: '/admin/change-doc-templates', label: 'AI模板管理', icon: FileCode, resource: 'change_doc_template', action: 'read' },
  { href: '/admin/config',   label: '系统配置',   icon: Settings,       resource: 'notification', action: 'manage' },
  { href: '/admin/audit',    label: '审计日志',   icon: ClipboardList,  resource: 'audit',         action: 'read' },
]

function usePersistState(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === 'undefined') return initial
    const saved = localStorage.getItem(key)
    return saved !== null ? saved === 'true' : initial
  })
  const set = (v: boolean) => {
    setValue(v)
    try { localStorage.setItem(key, String(v)) } catch {}
  }
  return [value, set]
}

function NavGroupItem({ group, pathname, hasPermission, depth = 0 }: {
  group: NavGroup
  pathname: string
  hasPermission: (r: string, a: string) => boolean
  depth?: number
}) {
  const visibleChildren = group.children.filter(c =>
    !c.resource || !c.action || hasPermission(c.resource, c.action)
  )
  if (visibleChildren.length === 0) return null

  const isAnyChildActive = visibleChildren.some(c => {
    if (isGroup(c)) {
      return c.children.some(ch => {
        if (isGroup(ch)) return false
        const href = (ch as NavItem).href
        return pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?')
      })
    }
    const href = (c as NavItem).href
    return pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?')
  })

  const [open, setOpen] = usePersistState(group.storageKey, group.defaultOpen ?? isAnyChildActive)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-3 rounded-md text-sm transition-colors',
          depth > 0 ? 'px-3 py-1.5' : 'px-3 py-2',
          isAnyChildActive ? 'text-foreground font-medium hover:bg-muted' : 'hover:bg-muted text-muted-foreground'
        )}
      >
        <group.icon className={cn('shrink-0', depth > 0 ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        <span className="flex-1 text-left">{group.label}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {open && (
        <div className="ml-3 pl-3 border-l space-y-0.5 mt-0.5">
          {visibleChildren.map((child) => {
            if (isGroup(child)) {
              return (
                <NavGroupItem
                  key={child.label}
                  group={child}
                  pathname={pathname}
                  hasPermission={hasPermission}
                  depth={depth + 1}
                />
              )
            }
            const item = child as NavItem
            const isActive = item.href === '/cmdb'
              ? pathname === '/cmdb'
              : pathname === item.href || pathname.startsWith(item.href + '/') || pathname.startsWith(item.href + '?')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { hasPermission } = usePermission()

  return (
    <aside className="w-56 border-r bg-background flex flex-col min-h-screen">
      <div className="p-4 border-b">
        <span className="font-bold text-lg">IT 运维平台</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((entry) => {
          if (isGroup(entry)) {
            if (!entry.resource || !entry.action || !hasPermission(entry.resource, entry.action)) return null
            return (
              <NavGroupItem
                key={entry.label}
                group={entry}
                pathname={pathname}
                hasPermission={hasPermission}
              />
            )
          }
          const { href, label, icon: Icon, resource, action } = entry
          if (resource && action && !hasPermission(resource, action)) return null
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                pathname === href ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
