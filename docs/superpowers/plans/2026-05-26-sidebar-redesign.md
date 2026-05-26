# 侧边栏重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将侧边栏 14 个顶层条目整理为 3 个语义分组（日常工作 / IT运维工具 / 配置），日常工作和 IT运维工具默认展开，配置默认折叠，风格与现有 CMDB 分组完全一致。

**Architecture:** 复用现有 `NavGroup` / `NavGroupItem` / `usePersistState` 机制，扩展 `NavGroup.children` 类型以支持嵌套 `NavGroup`（CMDB 作为 IT运维工具的子分组），修改 `sidebarEntries` 数组结构。`NavGroupItem` 的 `visibleChildren.length === 0` 逻辑已自动处理权限守卫，父级 resource/action 只需取子项中最基础的权限。

**Tech Stack:** Next.js 15, React 19, TypeScript, lucide-react, localStorage (usePersistState)

---

## File Map

**修改（1 个文件）：**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

---

## Task 1: 重构 Sidebar.tsx

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: 读取现有文件，理解结构**

```bash
cat frontend/src/components/layout/Sidebar.tsx
```

确认以下内容存在：
- `NavItem` / `NavGroup` / `SidebarEntry` 类型定义
- `usePersistState` hook
- `NavGroupItem` 组件
- `sidebarEntries` 数组

- [ ] **Step 2: 完整替换 Sidebar.tsx**

用以下内容完整替换 `frontend/src/components/layout/Sidebar.tsx`：

```tsx
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
  Wrench, ClipboardCheck,
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
  defaultOpen?: boolean
  children: (NavItem | NavGroup)[]
}

type SidebarEntry = NavItem | NavGroup

function isGroup(entry: SidebarEntry | NavItem | NavGroup): entry is NavGroup {
  return 'children' in entry
}

// CMDB sub-group (reused inside IT运维工具)
const cmdbGroup: NavGroup = {
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
}

const sidebarEntries: SidebarEntry[] = [
  { href: '/', label: '首页', icon: LayoutDashboard, resource: null, action: null },
  {
    label: '日常工作',
    icon: ClipboardCheck,
    resource: 'daily_report',
    action: 'read',
    storageKey: 'sidebar_daily_open',
    defaultOpen: true,
    children: [
      { href: '/daily',          label: '我的日报', icon: FileText,    resource: 'daily_report', action: 'read' },
      { href: '/workflow/tasks', label: '待审批',   icon: CheckSquare, resource: 'workflow',     action: 'read' },
      { href: '/notifications',  label: '通知中心', icon: Bell,        resource: 'notification', action: 'read' },
    ],
  },
  {
    label: 'IT 运维工具',
    icon: Wrench,
    resource: 'device',
    action: 'read',
    storageKey: 'sidebar_ops_open',
    defaultOpen: true,
    children: [
      cmdbGroup,
      { href: '/devices',      label: '设备密码库', icon: KeyRound,  resource: 'device',       action: 'read' },
      { href: '/change-docs',  label: '变更文档',   icon: FileText,  resource: 'change_doc',   action: 'read' },
      { href: '/reports',      label: '报表导出',   icon: BarChart2, resource: 'daily_report', action: 'export' },
    ],
  },
  {
    label: '配置',
    icon: Settings,
    resource: 'user',
    action: 'read',
    storageKey: 'sidebar_config_open',
    defaultOpen: false,
    children: [
      { href: '/users',                      label: '用户管理', icon: Users,        resource: 'user',                action: 'read' },
      { href: '/groups',                     label: '组管理',   icon: Building2,    resource: 'group',               action: 'read' },
      { href: '/rbac/roles',                 label: '角色权限', icon: Shield,       resource: 'role',                action: 'read' },
      { href: '/admin/change-doc-templates', label: '变更模板', icon: FileCode,     resource: 'change_doc_template', action: 'read' },
      { href: '/admin/config',               label: '系统配置', icon: Settings,     resource: 'notification',        action: 'manage' },
      { href: '/admin/audit',                label: '审计日志', icon: ClipboardList, resource: 'audit',              action: 'read' },
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

function NavGroupItem({ group, pathname, hasPermission, depth = 0 }: {
  group: NavGroup
  pathname: string
  hasPermission: (r: string, a: string) => boolean
  depth?: number
}) {
  const visibleChildren = group.children.filter(c => {
    if (isGroup(c)) return !c.resource || !c.action || hasPermission(c.resource, c.action)
    return !c.resource || !c.action || hasPermission(c.resource, c.action)
  })
  if (visibleChildren.length === 0) return null

  const isAnyChildActive = visibleChildren.some(c => {
    if (isGroup(c)) return pathname.startsWith('/' + c.children.map((ch: NavItem | NavGroup) => isGroup(ch) ? '' : ch.href).filter(Boolean)[0]?.split('/')[1] ?? '__')
    const href = (c as NavItem).href
    return href === '/cmdb' ? pathname === '/cmdb' : pathname.startsWith(href)
  })

  const [open, setOpen] = usePersistState(group.storageKey, group.defaultOpen ?? isAnyChildActive)

  const indent = depth > 0

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-3 rounded-md text-sm transition-colors',
          indent ? 'px-3 py-1.5' : 'px-3 py-2',
          isAnyChildActive ? 'text-foreground font-medium' : 'hover:bg-muted text-muted-foreground'
        )}
      >
        <group.icon className={cn('shrink-0', indent ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        <span className="flex-1 text-left">{group.label}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {open && (
        <div className="ml-3 pl-3 border-l space-y-0.5 mt-0.5">
          {visibleChildren.map((child, i) => {
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
              : pathname.startsWith(item.href)
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
        {sidebarEntries.map((entry) => {
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
```

- [ ] **Step 3: TypeScript 检查**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors

- [ ] **Step 4: 构建前端**

```bash
cd /Volumes/Work/AI/cwgsyw-platform && docker compose build frontend 2>&1 | tail -3
```

Expected: `Image cwgsyw-platform-frontend Built`

- [ ] **Step 5: 部署并 smoke test**

```bash
docker compose up -d frontend && sleep 15
/usr/bin/curl -s -o /dev/null -w "%{http_code}" http://localhost/ && echo ""
/usr/bin/curl -s -o /dev/null -w "%{http_code}" http://localhost/cmdb && echo ""
/usr/bin/curl -s -o /dev/null -w "%{http_code}" http://localhost/daily && echo ""
```

Expected: 全部 `200`

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: sidebar - reorganize into 3 groups (daily/ops/config) with collapsible sections"
```

---

## Self-Review

### Spec coverage

| 规格要求 | 覆盖 |
|---------|------|
| 首页顶层平铺 | ✅ `sidebarEntries[0]` 是 NavItem |
| 日常工作分组（日报/待审批/通知） | ✅ `sidebar_daily_open` storageKey |
| IT运维工具分组（CMDB/设备/变更/报表） | ✅ `sidebar_ops_open` storageKey |
| 配置分组（用户/组/角色/模板/配置/审计） | ✅ `sidebar_config_open` storageKey |
| 日常工作默认展开 | ✅ `defaultOpen: true` |
| IT运维工具默认展开 | ✅ `defaultOpen: true` |
| 配置默认折叠 | ✅ `defaultOpen: false` |
| CMDB 保持子分组 | ✅ `cmdbGroup` 嵌套在 IT运维工具 children 中 |
| 风格与现有 CMDB 分组一致 | ✅ 复用 `NavGroupItem` + `border-l` + chevron |
| localStorage 记忆展开状态 | ✅ `usePersistState` |

### Placeholder scan

无 TBD/TODO。

### Type consistency

- `NavGroup.children` 类型扩展为 `(NavItem | NavGroup)[]` — `NavGroupItem` 内部用 `isGroup()` 区分，递归渲染嵌套分组
- `depth` prop 控制嵌套层级的图标大小和 padding，CMDB 子项（depth=1）用 `h-3.5 w-3.5` 与现有行为一致
- `defaultOpen` 可选字段，未设置时 fallback 到 `isAnyChildActive`（与现有 CMDB 行为一致）
