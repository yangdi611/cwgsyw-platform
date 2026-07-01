'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import api from '@/lib/api'
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
  DatabaseBackup,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
  LayoutTemplate,
  Link2,
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

/** 某个一级菜单（权限过滤后）是否存在子项命中当前路由。 */
function groupActiveChild(
  group: NavGroup,
  pathname: string,
  hasPermission: (r: string, a: string) => boolean,
): boolean {
  const visibleChildren = group.children.filter(
    c => !c.resource || !c.action || hasPermission(c.resource, c.action),
  )
  if (visibleChildren.length === 0) return false
  return visibleChildren.some(
    c => pathname === c.href || pathname.startsWith(c.href + '/') || pathname.startsWith(c.href + '?'),
  )
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

  // 1.5 运维日历
  {
    href: '/ops-calendar',
    label: '运维日历',
    icon: CalendarDays,
    resource: 'ops_calendar',
    action: 'read',
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
      { href: '/cmdb/instances', label: '实例管理', icon: Database, resource: 'cmdb_instance', action: 'read', exact: true },
      { href: '/cmdb/changes', label: '变更记录', icon: History, resource: 'cmdb_change', action: 'read' },
      { href: '/cmdb/alerts', label: '告警中心', icon: Bell, resource: 'cmdb_alert', action: 'read', badge: 7 },
      { href: '/cmdb/instances/2d-view', label: '2D 视图', icon: Grid3x3, resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/admin', label: '模型管理', icon: Box, resource: 'cmdb_model', action: 'read' },
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
      { href: '/change-docs', label: '文档列表', icon: FileText, resource: 'change_doc', action: 'read', badge: 42, exact: true },
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

  // 知识库
  {
    href: '/wiki',
    label: '知识库',
    icon: BookOpen,
    resource: 'wiki',
    action: 'read',
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
      { href: '/workflow/todo', label: '待办中心', icon: CheckSquare, resource: 'workflow', action: 'read' },
      { href: '/workflow/tasks', label: '我的任务', icon: CheckSquare, resource: 'workflow', action: 'read', badge: 12 },
      { href: '/daily', label: '日报审批', icon: FileText, resource: 'daily_report', action: 'read' },
      { href: '/workflow/instances', label: '流程实例', icon: GitBranch, resource: 'workflow', action: 'read' },
      { href: '/workflow/templates', label: '流程模板', icon: LayoutTemplate, resource: 'workflow', action: 'configure' },
      { href: '/workflow/design', label: '流程设计', icon: Edit3, resource: 'workflow', action: 'configure' },
      { href: '/workflow/bindings', label: '流程绑定', icon: Link2, resource: 'workflow', action: 'configure' },
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
      { href: '/admin/backup', label: '备份与恢复', icon: DatabaseBackup, resource: 'backup', action: 'read' },
      { href: '/notifications', label: '通知中心', icon: Bell, resource: 'notification', action: 'read' },
    ],
  },
]

const OPEN_GROUP_KEY = 'sidebar_open_group_v2'

/**
 * 手风琴式展开状态：同一时刻只允许一个一级菜单展开。
 * 返回当前展开组的 storageKey（全部折叠时为 null）与切换函数。
 * - localStorage 无值 → 使用传入的 initialKey（当前页所属组 / defaultOpen）
 * - localStorage 为 '' → 用户已主动全部折叠，保持全部关闭
 * - localStorage 为某 storageKey → 展开该组
 */
function useOpenGroup(initialKey: string | null): [string | null, (key: string) => void] {
  const [openKey, setOpenKey] = useState<string | null>(() => {
    if (typeof window === 'undefined') return initialKey
    const saved = localStorage.getItem(OPEN_GROUP_KEY)
    if (saved === null) return initialKey
    return saved || null
  })
  const toggle = (key: string) => {
    setOpenKey(prev => {
      const next = prev === key ? null : key
      try {
        localStorage.setItem(OPEN_GROUP_KEY, next ?? '')
      } catch {}
      return next
    })
  }
  return [openKey, toggle]
}

const COLLAPSE_KEY = 'sidebar_collapsed_v2'

/** 折叠状态（localStorage 持久化）。收起后侧栏只显示 logo + 一级图标。 */
function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  })
  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {}
      return next
    })
  }
  return [collapsed, toggle]
}

function NavGroupItem({ group, pathname, hasPermission, isOpen, onToggle }: {
  group: NavGroup
  pathname: string
  hasPermission: (r: string, a: string) => boolean
  isOpen: boolean
  onToggle: () => void
}) {
  const visibleChildren = group.children.filter(c =>
    !c.resource || !c.action || hasPermission(c.resource, c.action)
  )
  if (visibleChildren.length === 0) return null

  const isAnyChildActive = groupActiveChild(group, pathname, hasPermission)

  const open = isOpen

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isAnyChildActive
            ? 'bg-white/10 text-v2-sidebar-fg'
            : 'text-v2-sidebar-muted hover:bg-white/6 hover:text-v2-sidebar-fg'
        )}
      >
        <group.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none',
            open ? 'rotate-0' : '-rotate-90',
          )}
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden min-h-0">
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
        </div>
      </div>
    </div>
  )
}

/**
 * 折叠态下的一级条目：只显示图标。
 * - 单项（NavItem）：hover 显示标题 tooltip，点击直接跳转
 * - 分组（NavGroup）：hover 在右侧弹出 flyout 二级菜单
 * flyout 用 fixed 定位（按图标 rect 计算），避免被侧栏 overflow 裁切。
 *
 * 交互：
 * - 鼠标移出后延时 200ms 才收起（grace 期），期间移入 flyout 可取消收起
 * - flyout 左侧有透明 bridge（pl-2）桥接侧栏与浮层之间的间隙，鼠标可平滑移过去
 * - 弹出/收回为 scale + opacity 过渡（origin-left），类似 macOS Dock 的 zoom 效果
 */
const CLOSE_DELAY = 200 // ms，鼠标移出后的宽限时间
const ANIM_MS = 200 // ms，与 CSS duration-200 对齐

function CollapsedEntry({ entry, pathname, hasPermission }: {
  entry: NavEntry
  pathname: string
  hasPermission: (r: string, a: string) => boolean
}) {
  const [mounted, setMounted] = useState(false) // 是否在 DOM 中
  const [entered, setEntered] = useState(false) // 是否处于完整 scale/opacity（驱动过渡）
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const open = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (unmountTimer.current) clearTimeout(unmountTimer.current)
    const rect = ref.current?.getBoundingClientRect()
    if (rect) setCoords({ top: rect.top, left: rect.right })
    setMounted(true)
    // 双 rAF 确保挂载后下一帧再触发过渡，动画才会生效
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
  }

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      setEntered(false) // 先播放收回动画
      unmountTimer.current = setTimeout(() => setMounted(false), ANIM_MS) // 动画结束再卸载
    }, CLOSE_DELAY)
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      if (unmountTimer.current) clearTimeout(unmountTimer.current)
    }
  }, [])

  if (isGroup(entry)) {
    const visibleChildren = entry.children.filter(
      c => !c.resource || !c.action || hasPermission(c.resource, c.action),
    )
    if (visibleChildren.length === 0) return null
    const isActive = groupActiveChild(entry, pathname, hasPermission)
    const Icon = entry.icon

    return (
      <div ref={ref} className="relative" onMouseEnter={open} onMouseLeave={scheduleClose}>
        <button
          className={cn(
            'flex h-11 w-full items-center justify-center rounded-lg transition-colors',
            isActive || mounted
              ? 'bg-white/10 text-white'
              : 'text-v2-sidebar-muted hover:bg-white/6 hover:text-white',
          )}
        >
          <Icon className="h-[22px] w-[22px]" />
        </button>

        {mounted && (
          <div
            className="fixed z-50 pl-2"
            style={{ top: coords.top, left: coords.left }}
            onMouseEnter={open}
            onMouseLeave={scheduleClose}
          >
            <div
              className={cn(
                'w-56 origin-left overflow-hidden rounded-xl border border-white/10 bg-v2-sidebar-2 shadow-2xl ring-1 ring-black/20',
                'transition-all duration-200 ease-out motion-reduce:transition-none',
                entered ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
              )}
            >
              <div className="border-b border-white/8 px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-v2-sidebar-muted">
                {entry.label}
              </div>
              <div className="space-y-0.5 p-1.5">
                {visibleChildren.map((item) => {
                  const childActive = item.exact
                    ? pathname === item.href
                    : pathname === item.href ||
                      pathname.startsWith(item.href + '/') ||
                      pathname.startsWith(item.href + '?')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                        childActive
                          ? 'bg-blue-600/30 text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.22)]'
                          : 'text-slate-300 hover:bg-white/8 hover:text-white',
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0 opacity-85" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-white/10 px-1.5 font-mono text-[11px] tabular-nums text-blue-200">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 单项
  const { href, label, icon: Icon, resource, action } = entry
  if (resource && action && !hasPermission(resource, action)) return null
  const isActive = pathname === href

  return (
    <div ref={ref} className="relative" onMouseEnter={open} onMouseLeave={scheduleClose}>
      <Link
        href={href}
        className={cn(
          'flex h-11 w-full items-center justify-center rounded-lg transition-colors',
          isActive
            ? 'bg-blue-600/30 text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.22)]'
            : 'text-v2-sidebar-muted hover:bg-white/6 hover:text-white',
        )}
      >
        <Icon className="h-[22px] w-[22px]" />
      </Link>
      {mounted && (
        <div className="fixed z-50 pl-2" style={{ top: coords.top + 8, left: coords.left }}>
          <div
            className={cn(
              'origin-left whitespace-nowrap rounded-lg border border-white/10 bg-v2-sidebar-2 px-3 py-1.5 text-sm text-white shadow-2xl ring-1 ring-black/20',
              'transition-all duration-200 ease-out motion-reduce:transition-none',
              entered ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
            )}
          >
            {label}
          </div>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { hasPermission } = usePermission()

  // 默认展开的一级菜单：优先「当前页所属组」，其次「defaultOpen」的组。
  const groups = navItems.filter(isGroup) as NavGroup[]
  const isGroupVisible = (g: NavGroup) =>
    !g.resource || !g.action || hasPermission(g.resource, g.action)
  const initialOpenKey =
    groups.find(g => isGroupVisible(g) && groupActiveChild(g, pathname, hasPermission))?.storageKey ??
    groups.find(g => isGroupVisible(g) && g.defaultOpen)?.storageKey ??
    null

  const [openKey, toggleGroup] = useOpenGroup(initialOpenKey)
  const [collapsed, toggleCollapsed] = useCollapsed()

  // 实际 schema 版本：从后端动态读取 flyway_schema_history 最新成功版本
  const [schemaVersion, setSchemaVersion] = useState<string | null>(null)
  useEffect(() => {
    api.get('/system/info')
      .then(res => setSchemaVersion(res.data?.data?.schema_version ?? null))
      .catch(() => {})
  }, [])

  // 构建期注入：app 版本（package.json）+ commit 短号（CI 传入）
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'
  const gitCommit = (process.env.NEXT_PUBLIC_GIT_COMMIT ?? 'dev').slice(0, 7)

  // 一次性迁移清理：移除旧版（每个一级菜单独立持久化）遗留的 localStorage key。
  // 新版只使用 OPEN_GROUP_KEY 单个 key，这些旧 key 不再被读写。
  // removeItem 对不存在的 key 是安全空操作，且这里不会触及 OPEN_GROUP_KEY。
  useEffect(() => {
    navItems.forEach(entry => {
      if (isGroup(entry)) {
        try {
          localStorage.removeItem(entry.storageKey)
        } catch {}
      }
    })
  }, [])

  return (
    <aside
      className={cn(
        'bg-gradient-to-b from-v2-sidebar to-v2-sidebar-2 text-v2-sidebar-fg border-r border-v2-sidebar-border flex flex-col min-h-screen sticky top-0 h-screen overflow-x-visible transition-[width] duration-200 ease-out motion-reduce:transition-none',
        collapsed ? 'w-[76px]' : 'w-[280px]',
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'h-14 flex items-center border-b border-v2-sidebar-border shrink-0',
          collapsed ? 'justify-center px-2' : 'gap-3 px-5',
        )}
      >
        <div className="w-[34px] h-[34px] rounded-[10px] bg-gradient-to-br from-blue-500 to-teal-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)] shrink-0" />
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold leading-tight tracking-tight whitespace-nowrap">
                CWGSYW 平台
              </div>
              <div className="text-xs text-v2-sidebar-muted mt-0.5 whitespace-nowrap">
                企业运维与 CMDB 工作台
              </div>
            </div>
            <button
              onClick={toggleCollapsed}
              title="收起侧栏"
              className="shrink-0 rounded-md p-1.5 text-v2-sidebar-muted transition-colors hover:bg-white/8 hover:text-white"
            >
              <PanelLeftClose className="h-[18px] w-[18px]" />
            </button>
          </>
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
            if (isGroup(entry) && (!entry.resource || !entry.action || !hasPermission(entry.resource, entry.action))) {
              return null
            }
            return (
              <CollapsedEntry
                key={isGroup(entry) ? entry.label : entry.href}
                entry={entry}
                pathname={pathname}
                hasPermission={hasPermission}
              />
            )
          })}
        </nav>
      ) : (
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
      )}

      {/* Footer: Version Info（折叠态隐藏） */}
      {!collapsed && (
      <div className="px-4 py-3 border-t border-v2-sidebar-border shrink-0 space-y-2">
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
