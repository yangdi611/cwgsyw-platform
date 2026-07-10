import type { NavEntry } from './types'
import {
  LayoutDashboard,
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
  DatabaseBackup,
  BookOpen,
  CalendarDays,
  LayoutTemplate,
  Link2,
} from 'lucide-react'

// V2 导航架构：8 大模块
export const navItems: NavEntry[] = [
  // 1. 工作台
  {
    href: '/',
    label: '工作台',
    icon: LayoutDashboard,
    resource: null,
    action: null,
    badge: 18,
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
      { href: '/cmdb/admin', label: '模型管理', icon: Box, resource: 'cmdb_model', action: 'read' },
      { href: '/cmdb/alerts', label: '告警中心', icon: Bell, resource: 'cmdb_alert', action: 'read', badge: 7 },
      { href: '/cmdb/instances/2d-view', label: '拓扑', icon: Grid3x3, resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/changes', label: '变更记录', icon: History, resource: 'cmdb_change', action: 'read' },
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
      { href: '/rbac/permissions', label: '权限配置', icon: Shield, resource: 'resource', action: 'assign' },
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
