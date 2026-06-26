import {
  LayoutDashboard,
  ServerCog,
  FileText,
  FolderOpen,
  GitBranch,
  BarChart2,
  Shield,
  Settings,
  BookOpen,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface Crumb {
  label: string
  href?: string
  icon?: LucideIcon
  /** 动态名（实例/文档/页面标题），由详情页按顺序注册到 breadcrumb store */
  dynamic?: boolean
  /**
   * 动态段的 href 模板，用 :N 引用 URL 第 N 段（0 基）。
   * 例：wiki 空间段 hrefTemplate='/wiki/:0' → 解析为 /wiki/<spaceId>，可点回空间。
   * 仅对非末段动态槽有意义（末段是当前页，不可点）。
   */
  hrefTemplate?: string
}

/** 模块根面包屑（带侧栏同款图标，宝蓝高亮）。group 类无独立页面 → 不带 href。 */
const ROOT = {
  dashboard: { label: '工作台', href: '/', icon: LayoutDashboard },
  cmdb: { label: 'CMDB', href: '/cmdb', icon: ServerCog },
  changedoc: { label: '变更文档', href: '/change-docs', icon: FileText },
  resource: { label: '资源管理', icon: FolderOpen },
  wiki: { label: '知识库', href: '/wiki', icon: BookOpen },
  workflow: { label: '流程中心', icon: GitBranch },
  reports: { label: '报表分析', icon: BarChart2 },
  identity: { label: '身份与权限', icon: Shield },
  system: { label: '系统管理', icon: Settings },
} satisfies Record<string, Crumb>

const DYN: Crumb = { label: '', dynamic: true }

interface RouteDef {
  /** 段模式，:x 匹配任意单段 */
  pattern: string
  trail: Crumb[]
}

/**
 * 路由 → 面包屑轨迹。最具体的放前面（命中即停）。
 * 末段 DYN 的 label 由详情页注册的真实名字替换，未注册则降级显示 ID/段名。
 * 分组依「侧栏逻辑归属」而非 URL 目录（如 change-doc-templates 归在变更文档下）。
 */
const ROUTES: RouteDef[] = [
  // ── CMDB ──
  { pattern: '/cmdb', trail: [ROOT.cmdb, { label: '概览' }] },
  { pattern: '/cmdb/instances', trail: [ROOT.cmdb, { label: '实例管理', href: '/cmdb/instances' }] },
  { pattern: '/cmdb/instances/2d-view', trail: [ROOT.cmdb, { label: '实例管理', href: '/cmdb/instances' }, { label: '2D 视图' }] },
  { pattern: '/cmdb/instances/by-model/:m/new', trail: [ROOT.cmdb, { label: '实例管理', href: '/cmdb/instances' }, { label: '新建实例' }] },
  { pattern: '/cmdb/instances/by-model/:m/:id/associations/new', trail: [ROOT.cmdb, { label: '实例管理', href: '/cmdb/instances' }, { ...DYN }, { label: '关联管理' }, { label: '新建关联' }] },
  { pattern: '/cmdb/instances/by-model/:m/:id/associations', trail: [ROOT.cmdb, { label: '实例管理', href: '/cmdb/instances' }, { ...DYN }, { label: '关联管理' }] },
  { pattern: '/cmdb/instances/by-model/:m/:id', trail: [ROOT.cmdb, { label: '实例管理', href: '/cmdb/instances' }, { ...DYN }] },
  { pattern: '/cmdb/changes/stats', trail: [ROOT.reports, { label: 'CMDB 统计' }] },
  { pattern: '/cmdb/changes', trail: [ROOT.cmdb, { label: '变更记录' }] },
  { pattern: '/cmdb/alerts', trail: [ROOT.cmdb, { label: '告警中心' }] },
  { pattern: '/cmdb/topology/:id/compare', trail: [ROOT.cmdb, { label: '实例管理', href: '/cmdb/instances' }, { ...DYN }, { label: '拓扑对比' }] },
  { pattern: '/cmdb/topology/:id', trail: [ROOT.cmdb, { label: '实例管理', href: '/cmdb/instances' }, { ...DYN }, { label: '拓扑图' }] },
  { pattern: '/cmdb/impact/:id', trail: [ROOT.cmdb, { label: '实例管理', href: '/cmdb/instances' }, { ...DYN }, { label: '影响分析' }] },
  { pattern: '/cmdb/admin/models/:m', trail: [ROOT.cmdb, { label: '模型管理', href: '/cmdb/admin' }, { ...DYN }] },
  { pattern: '/cmdb/admin', trail: [ROOT.cmdb, { label: '模型管理' }] },

  // ── 变更文档 ──
  { pattern: '/change-docs/new', trail: [ROOT.changedoc, { label: '新建变更' }] },
  { pattern: '/change-docs/:id', trail: [ROOT.changedoc, { label: '文档列表', href: '/change-docs' }, { ...DYN }] },
  { pattern: '/change-docs', trail: [ROOT.changedoc, { label: '文档列表' }] },
  { pattern: '/admin/change-doc-templates/:id', trail: [ROOT.changedoc, { label: '模板管理', href: '/admin/change-doc-templates' }, { ...DYN }] },
  { pattern: '/admin/change-doc-templates', trail: [ROOT.changedoc, { label: '模板管理' }] },

  // ── 资源管理 ──
  { pattern: '/devices/new', trail: [ROOT.resource, { label: '设备密码库', href: '/devices' }, { label: '新建设备' }] },
  { pattern: '/devices/:id', trail: [ROOT.resource, { label: '设备密码库', href: '/devices' }, { ...DYN }] },
  { pattern: '/devices', trail: [ROOT.resource, { label: '设备密码库' }] },
  { pattern: '/ipam/:id', trail: [ROOT.resource, { label: 'IP 地址池', href: '/ipam' }, { ...DYN }] },
  { pattern: '/ipam', trail: [ROOT.resource, { label: 'IP 地址池' }] },
  { pattern: '/files/preview/:id', trail: [ROOT.resource, { label: '共享文档', href: '/files' }, { label: '预览' }] },
  { pattern: '/files', trail: [ROOT.resource, { label: '共享文档' }] },

  // ── 知识库 ──
  // wiki 是唯一两层动态路由：空间段 + 页面段。中间的空间段可点回空间首页（hrefTemplate :1 = spaceId）。
  { pattern: '/wiki/search', trail: [ROOT.wiki, { label: '搜索' }] },
  { pattern: '/wiki/:s/graph', trail: [ROOT.wiki, { ...DYN, hrefTemplate: '/wiki/:1' }, { label: '关系图谱' }] },
  { pattern: '/wiki/:s/:p/edit', trail: [ROOT.wiki, { ...DYN, hrefTemplate: '/wiki/:1' }, { ...DYN, hrefTemplate: '/wiki/:1/:2' }, { label: '编辑' }] },
  { pattern: '/wiki/:s/:p', trail: [ROOT.wiki, { ...DYN, hrefTemplate: '/wiki/:1' }, { ...DYN }] },
  { pattern: '/wiki/:s', trail: [ROOT.wiki, { ...DYN }] },
  { pattern: '/wiki', trail: [ROOT.wiki] },

  // ── 流程中心 ──
  { pattern: '/workflow/tasks', trail: [ROOT.workflow, { label: '我的任务' }] },
  { pattern: '/workflow/instances', trail: [ROOT.workflow, { label: '流程实例' }] },
  { pattern: '/workflow/design/:id', trail: [ROOT.workflow, { label: '流程设计', href: '/workflow/design' }, { ...DYN }] },
  { pattern: '/workflow/design', trail: [ROOT.workflow, { label: '流程设计' }] },
  { pattern: '/workflow/admin', trail: [ROOT.workflow, { label: '流程配置' }] },
  { pattern: '/workflow/stats', trail: [ROOT.reports, { label: '流程统计' }] },
  { pattern: '/daily/new', trail: [ROOT.workflow, { label: '日报审批', href: '/daily' }, { label: '新建日报' }] },
  { pattern: '/daily/:id', trail: [ROOT.workflow, { label: '日报审批', href: '/daily' }, { ...DYN }] },
  { pattern: '/daily', trail: [ROOT.workflow, { label: '日报审批' }] },

  // ── 报表分析 ──
  { pattern: '/reports', trail: [ROOT.reports, { label: '综合报表' }] },

  // ── 身份与权限 ──
  { pattern: '/users', trail: [ROOT.identity, { label: '用户管理' }] },
  { pattern: '/groups', trail: [ROOT.identity, { label: '用户组' }] },
  { pattern: '/rbac/roles', trail: [ROOT.identity, { label: '角色管理' }] },
  { pattern: '/rbac/permissions', trail: [ROOT.identity, { label: '权限配置' }] },

  // ── 系统管理 ──
  { pattern: '/admin/config', trail: [ROOT.system, { label: '系统配置' }] },
  { pattern: '/admin/ai', trail: [ROOT.system, { label: 'AI 配置' }] },
  { pattern: '/admin/audit', trail: [ROOT.system, { label: '审计日志' }] },
  { pattern: '/admin/backup', trail: [ROOT.system, { label: '备份与恢复' }] },
  { pattern: '/notifications', trail: [ROOT.system, { label: '通知中心' }] },

  // ── 工作台 ──
  { pattern: '/', trail: [ROOT.dashboard] },
]

function matchPattern(pattern: string, segs: string[]): boolean {
  const ps = pattern.split('/').filter(Boolean)
  if (ps.length !== segs.length) return false
  return ps.every((p, i) => p.startsWith(':') || p === segs[i])
}

/** 解析 hrefTemplate（:N 引用 URL 第 N 段，0 基）→ 实际路径 */
function resolveHref(template: string, segs: string[]): string {
  return template.replace(/:(\d+)/g, (_, n) => segs[Number(n)] ?? '')
}

/**
 * 解析 pathname → 面包屑轨迹。
 * @param pathname 当前路由
 * @param dynamicLabels 详情页按动态段出现顺序注册的真实名字数组（可空，降级为段名/占位）
 */
export function resolveBreadcrumb(pathname: string, dynamicLabels?: string[]): Crumb[] {
  const clean = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  const segs = clean.split('/').filter(Boolean)

  const def = ROUTES.find((r) => matchPattern(r.pattern, segs))
  if (!def) {
    // 未登记路由：兜底用首段模块名
    return [{ label: segs[0] ?? '工作台' }]
  }

  const trail = def.trail.map((c) => ({ ...c }))
  const names = dynamicLabels ?? []
  const lastIdx = trail.length - 1
  let dynSeen = 0

  trail.forEach((c, i) => {
    if (!c.dynamic) return
    const registered = names[dynSeen]
    if (registered) {
      c.label = registered
    } else if (i === lastIdx) {
      // 末段（当前页）未注册 → 降级显示 #ID
      c.label = `#${segs[segs.length - 1]}`
    } else {
      // 中间动态段未注册（数据加载中）→ 安静占位
      c.label = '…'
    }
    // 中间动态段若带 href 模板 → 解析为可点链接（末段是当前页，不可点）
    if (c.hrefTemplate && i !== lastIdx) {
      c.href = resolveHref(c.hrefTemplate, segs)
    }
    dynSeen += 1
  })

  return trail
}
