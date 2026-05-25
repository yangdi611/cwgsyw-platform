'use client'
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
} from 'lucide-react'

const navItems = [
  { href: '/',               label: '首页',     icon: LayoutDashboard, resource: null,           action: null },
  { href: '/daily',          label: '我的日报', icon: FileText,        resource: 'daily_report', action: 'read' },
  { href: '/workflow/tasks', label: '待审批',   icon: CheckSquare,     resource: 'workflow',     action: 'read' },
  { href: '/devices',        label: '设备密码库', icon: KeyRound,       resource: 'device',       action: 'read' },
  { href: '/notifications',  label: '通知中心',   icon: Bell,           resource: 'notification', action: 'read' },
  { href: '/change-docs',    label: '变更文档',   icon: FileText,       resource: 'change_doc',   action: 'read' },
  { href: '/reports',        label: '报表导出',   icon: BarChart2,      resource: 'daily_report', action: 'export' },
  { href: '/users',          label: '用户管理', icon: Users,           resource: 'user',          action: 'read' },
  { href: '/groups',         label: '组管理',   icon: Building2,       resource: 'group',         action: 'read' },
  { href: '/rbac/roles',     label: '角色权限', icon: Shield,          resource: 'role',          action: 'read' },
  { href: '/admin/change-doc-templates', label: 'AI模板管理', icon: FileCode, resource: 'change_doc_template', action: 'read' },
  { href: '/admin/config',   label: '系统配置',   icon: Settings,       resource: 'notification', action: 'manage' },
  { href: '/admin/audit',    label: '审计日志',   icon: ClipboardList,  resource: 'audit',         action: 'read' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { hasPermission } = usePermission()

  return (
    <aside className="w-56 border-r bg-background flex flex-col min-h-screen">
      <div className="p-4 border-b">
        <span className="font-bold text-lg">IT 运维平台</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon, resource, action }) => {
          if (resource && action && !hasPermission(resource, action)) return null
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                pathname === href
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
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
