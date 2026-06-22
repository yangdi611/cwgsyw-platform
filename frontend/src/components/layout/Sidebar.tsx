'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import {
  LayoutDashboard,
  Database,
  FileText,
  FolderOpen,
  GitBranch,
  BarChart2,
  Shield,
  Settings,
  ServerCog,
  Box,
  History,
  Bell,
  Grid3x3,
  KeyRound,
  Globe,
  CheckSquare,
  Users,
  Building2,
  FileCode,
  ClipboardList,
  Edit3,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: any
  resource: string | null
  action: string | null
  badge?: number
  /** 精确匹配 pathname（不走 startsWith 前缀）。用于根路径项如 /cmdb 概览，
   *  避免 /cmdb/* 任意子页都把它点亮。 */
  exact?: boolean
}

type NavGroup = {
  label: string
  icon: any
  children: NavItem[]
  storageKey: string
  defaultOpen?: boolean
  resource: string | null
  action: string | null
}

type NavEntry = NavItem | NavGroup

function isGroup(item: NavEntry): item is NavGroup {
  return 'children' in item
}

// V2 导航架构：8 大模块
const navItems: NavEntry[] = [
  // 1. 工作台
  {
    href: '/',
    label: '工作台',
    icon: LayoutDashboard,
    resource: null,
    action: null,
    badge: 18, // 待办数量示例
  },

  // 2. CMDB
  {
    label: 'CMDB',
    icon: ServerCog,
    resource: 'cmdb_instance',
    action: 'read',
    storageKey: 'sidebar_cmdb_v2',
    defaultOpen: true,
    children: [
      { href: '/cmdb', label: '概览', icon: LayoutDashboard, resource: 'cmdb_instance', action: 'read', exact: true },
      { href: '/cmdb/instances', label: '实例管理', icon: Database, resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/models', label: '模型管理', icon: Box, resource: 'cmdb_model', action: 'read' },
      { href: '/cmdb/changes', label: '变更记录', icon: History, resource: 'cmdb_change', action: 'read' },
      { href: '/cmdb/alerts', label: '告警中心', icon: Bell, resource: 'cmdb_alert', action: 'read', badge: 7 },
      { href: '/cmdb/instances/2d-view', label: '2D 视图', icon: Grid3x3, resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/admin', label: '配置管理', icon: Settings, resource: 'cmdb_model', action: 'update' },
    ],
  },

  // 3. 变更文档
  {
    label: '变更文档',
    icon: FileText,
    resource: 'change_doc',
    action: 'read',
    storageKey: 'sidebar_changedoc_v2',
    defaultOpen: false,
    children: [
      { href: '/change-docs', label: '文档列表', icon: FileText, resource: 'change_doc', action: 'read', badge: 42 },
      { href: '/change-docs/new', label: '新建变更', icon: Edit3, resource: 'change_doc', action: 'create' },
      { href: '/admin/change-doc-templates', label: '模板管理', icon: FileCode, resource: 'change_doc_template', action: 'read' },
    ],
  },

  // 4. 资源管理
  {
    label: '资源管理',
    icon: FolderOpen,
    resource: 'device',
    action: 'read',
    storageKey: 'sidebar_resource_v2',
    defaultOpen: false,
    children: [
      { href: '/devices', label: '设备密码库', icon: KeyRound, resource: 'device', action: 'read' },
      { href: '/ipam', label: 'IP 地址池', icon: Globe, resource: 'ip_pool', action: 'read' },
      { href: '/files', label: '共享文档', icon: FolderOpen, resource: 'shared_file', action: 'read' },
    ],
  },

  // 5. 流程中心
  {
    label: '流程中心',
    icon: GitBranch,
    resource: 'workflow',
    action: 'read',
    storageKey: 'sidebar_workflow_v2',
    defaultOpen: false,
    children: [
      { href: '/workflow/tasks', label: '我的任务', icon: CheckSquare, resource: 'workflow', action: 'read', badge: 12 },
      { href: '/daily', label: '日报审批', icon: FileText, resource: 'daily_report', action: 'read' },
      { href: '/workflow/instances', label: '流程实例', icon: GitBranch, resource: 'workflow', action: 'read' },
      { href: '/workflow/design', label: '流程设计', icon: Edit3, resource: 'workflow', action: 'configure' },
      { href: '/workflow/admin', label: '流程配置', icon: Settings, resource: 'workflow', action: 'configure' },
    ],
  },

  // 6. 报表分析
  {
    label: '报表分析',
    icon: BarChart2,
    resource: null,
    action: null,
    storageKey: 'sidebar_reports_v2',
    defaultOpen: false,
    children: [
      { href: '/reports', label: '综合报表', icon: BarChart2, resource: null, action: null },
      { href: '/cmdb/changes/stats', label: 'CMDB 统计', icon: BarChart2, resource: 'cmdb_change', action: 'read' },
      { href: '/workflow/stats', label: '流程统计', icon: BarChart2, resource: 'workflow', action: 'read' },
    ],
  },

  // 7. 身份与权限
  {
    label: '身份与权限',
    icon: Shield,
    resource: 'user',
    action: 'read',
    storageKey: 'sidebar_identity_v2',
    defaultOpen: false,
    children: [
      { href: '/users', label: '用户管理', icon: Users, resource: 'user', action: 'read' },
      { href: '/groups', label: '用户组', icon: Building2, resource: 'group', action: 'read' },
      { href: '/rbac/roles', label: '角色管理', icon: Shield, resource: 'role', action: 'read' },
      { href: '/rbac/permissions', label: '权限配置', icon: Shield, resource: 'role', action: 'assign' },
    ],
  },

  // 8. 系统管理
  {
    label: '系统管理',
    icon: Settings,
    resource: 'notification',
    action: 'manage',
    storageKey: 'sidebar_system_v2',
    defaultOpen: false,
    children: [
      { href: '/admin/config', label: '系统配置', icon: Settings, resource: 'notification', action: 'manage' },
      { href: '/admin/ai', label: 'AI 配置', icon: Settings, resource: 'notification', action: 'manage' },
      { href: '/admin/audit', label: '审计日志', icon: ClipboardList, resource: null, action: null },
      { href: '/notifications', label: '通知中心', icon: Bell, resource: 'notification', action: 'read' },
    ],
  },
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
  const visibleChildren = group.children.filter(c =>
    !c.resource || !c.action || hasPermission(c.resource, c.action)
  )
  if (visibleChildren.length === 0) return null

  const isAnyChildActive = visibleChildren.some(c => {
    return pathname === c.href || pathname.startsWith(c.href + '/') || pathname.startsWith(c.href + '?')
  })

  const [open, setOpen] = usePersistState(group.storageKey, group.defaultOpen ?? isAnyChildActive)

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isAnyChildActive
            ? 'bg-white/10 text-v2-sidebar-fg'
            : 'text-v2-sidebar-muted hover:bg-white/6 hover:text-v2-sidebar-fg'
        )}
      >
        <group.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>

      {open && (
        <div className="mt-1 space-y-0.5">
          {visibleChildren.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href ||
                pathname.startsWith(item.href + '/') ||
                pathname.startsWith(item.href + '?')

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ml-3',
                  isActive
                    ? 'bg-blue-600/30 text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.22)]'
                    : 'text-slate-300 hover:bg-white/6 hover:text-white'
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0 opacity-85" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-white/10 text-blue-200 text-[11px] font-mono tabular-nums">
                    {item.badge}
                  </span>
                )}
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
    <aside className="w-[280px] bg-gradient-to-b from-v2-sidebar to-v2-sidebar-2 text-v2-sidebar-fg border-r border-v2-sidebar-border flex flex-col min-h-screen sticky top-0 h-screen overflow-hidden">
      {/* Brand */}
      <div className="h-[68px] px-5 flex items-center gap-3 border-b border-v2-sidebar-border shrink-0">
        <div className="w-[34px] h-[34px] rounded-[10px] bg-gradient-to-br from-blue-500 to-teal-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)] shrink-0" />
        <div className="min-w-0">
          <div className="text-[15px] font-bold leading-tight tracking-tight whitespace-nowrap">
            CWGSYW 平台
          </div>
          <div className="text-xs text-v2-sidebar-muted mt-0.5 whitespace-nowrap">
            企业运维与 CMDB 工作台
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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

      {/* Footer: System Health Card */}
      <div className="p-3 border-t border-v2-sidebar-border shrink-0">
        <div className="px-3 py-3 rounded-[14px] bg-white/6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[13px] font-bold text-slate-50">系统健康度</span>
            <span className="text-[13px] font-mono font-bold text-emerald-300 tabular-nums">94%</span>
          </div>
          <p className="text-xs text-v2-sidebar-muted leading-relaxed">
            设备、IP、CMDB 关系与流程节点均处于可控范围。
          </p>
        </div>
      </div>
    </aside>
  )
}
