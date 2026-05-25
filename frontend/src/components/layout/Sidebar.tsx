'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import {
  FileText, CheckSquare, Users, Building2, Shield, LayoutDashboard,
  KeyRound, Bell, Settings, BarChart2, ClipboardList, FileCode,
  Database, Search, Server, Settings2, ChevronDown, ChevronRight,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  resource: string | null
  action: string | null
}

interface NavGroup {
  label: string
  icon: React.ElementType
  resource: string
  action: string
  storageKey: string
  children: NavItem[]
}

type SidebarEntry = NavItem | NavGroup

function isGroup(entry: SidebarEntry): entry is NavGroup {
  return 'children' in entry
}

const sidebarEntries: SidebarEntry[] = [
  { href: '/',               label: '首页',       icon: LayoutDashboard, resource: null,           action: null },
  { href: '/daily',          label: '我的日报',   icon: FileText,        resource: 'daily_report', action: 'read' },
  { href: '/workflow/tasks', label: '待审批',     icon: CheckSquare,     resource: 'workflow',     action: 'read' },
  { href: '/devices',        label: '设备密码库', icon: KeyRound,        resource: 'device',       action: 'read' },
  { href: '/notifications',  label: '通知中心',   icon: Bell,            resource: 'notification', action: 'read' },
  { href: '/change-docs',    label: '变更文档',   icon: FileText,        resource: 'change_doc',   action: 'read' },
  {
    label: 'CMDB',
    icon: Database,
    resource: 'cmdb_instance',
    action: 'read',
    storageKey: 'sidebar_cmdb_open',
    children: [
      { href: '/cmdb',           label: '搜索',     icon: Search,    resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/instances', label: 'CI 资源',  icon: Server,    resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/admin',     label: '配置管理', icon: Settings2, resource: 'cmdb_model',    action: 'write' },
    ],
  },
  { href: '/reports',        label: '报表导出',   icon: BarChart2,     resource: 'daily_report',        action: 'export' },
  { href: '/users',          label: '用户管理',   icon: Users,         resource: 'user',                action: 'read' },
  { href: '/groups',         label: '组管理',     icon: Building2,     resource: 'group',               action: 'read' },
  { href: '/rbac/roles',     label: '角色权限',   icon: Shield,        resource: 'role',                action: 'read' },
  { href: '/admin/change-doc-templates', label: 'AI模板管理', icon: FileCode, resource: 'change_doc_template', action: 'read' },
  { href: '/admin/config',   label: '系统配置',   icon: Settings,      resource: 'notification',        action: 'manage' },
  { href: '/admin/audit',    label: '审计日志',   icon: ClipboardList, resource: 'audit',               action: 'read' },
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

function NavGroupItem({ group, pathname, hasPermission }: {
  group: NavGroup
  pathname: string
  hasPermission: (r: string, a: string) => boolean
}) {
  const visibleChildren = group.children.filter(
    c => !c.resource || !c.action || hasPermission(c.resource, c.action)
  )
  if (visibleChildren.length === 0) return null

  const isAnyChildActive = visibleChildren.some(
    c => c.href === '/' ? pathname === '/' : pathname.startsWith(c.href)
  )
  const [open, setOpen] = usePersistState(group.storageKey, isAnyChildActive)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
          isAnyChildActive ? 'text-foreground font-medium' : 'hover:bg-muted text-muted-foreground'
        )}
      >
        <group.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {open && (
        <div className="ml-3 pl-3 border-l space-y-0.5 mt-0.5">
          {visibleChildren.map(child => (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                (child.href === '/cmdb' ? pathname === '/cmdb' : pathname.startsWith(child.href))
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              <child.icon className="h-3.5 w-3.5" />
              {child.label}
            </Link>
          ))}
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
        {sidebarEntries.map((entry, i) => {
          if (isGroup(entry)) {
            if (!hasPermission(entry.resource, entry.action)) return null
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
