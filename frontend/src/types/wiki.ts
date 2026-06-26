/**
 * Wiki 模块类型定义
 *
 * 后端 Jackson 全局 SNAKE_CASE，所有 JSON 字段为 snake_case，
 * 前端接口字段必须与之精确匹配。
 */

export type WikiStatus = 'draft' | 'review' | 'published' | 'archived'

export interface WikiSpace {
  id: number
  name: string
  description: string
  page_count: number
  updated_at: string
  created_by_name: string
  read_only: boolean
  /** true = seed 系统空间，前端据此置于「官方手册」层 */
  system: boolean
  /** null=用户空间 / 'none' / 'super_admin_only' / 'all' */
  write_scope: string | null
}

export interface WikiPageTree {
  id: number
  title: string
  slug: string
  status: WikiStatus
  sort_order: number
  space_id: number
  children: WikiPageTree[]
}

export interface WikiPage {
  id: number
  space_id: number
  parent_id: number | null
  title: string
  slug: string
  content: string
  status: WikiStatus
  current_version: number
  acl_custom: boolean
  updated_at: string
  updated_by_name: string
  backlink_count: number
}

export interface WikiBacklink {
  page_id: number
  title: string
  space_id: number
}

export interface WikiVersion {
  version: number
  title: string
  comment: string
  created_by_name: string
  created_at: string
}

export interface WikiSearchResult {
  page_id: number
  space_id: number
  title: string
  highlight: string
  updated_at: string
}

export interface WikiGraphNode {
  id: string
  title: string
  status: string
}

export interface WikiGraphEdge {
  source: string
  target: string
}

export interface WikiGraph {
  nodes: WikiGraphNode[]
  edges: WikiGraphEdge[]
}

export interface WikiAclEntry {
  subject_type: string
  subject_id: number
  subject_name: string
  permissions: string[]
}

export interface WikiAcl {
  page_id: number
  inherited: boolean
  entries: WikiAclEntry[]
}

export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
}

/**
 * 当前用户是否可写某空间（前端按钮可见性；后端 ACL 是最终裁判）。
 * @param space 空间（可能 undefined，加载中视为不可写）
 * @param groupScope 当前用户范围：'platform'=超管 / 'tenant'=管理员 / 'group'=普通
 */
export function canWriteSpace(
  space: WikiSpace | undefined,
  groupScope: string | null | undefined,
): boolean {
  if (!space) return false
  const isSuper = groupScope === 'platform'
  const isAdmin = groupScope === 'tenant' || groupScope === 'platform'
  switch (space.write_scope) {
    case null:
    case undefined:
      return true // 用户自建空间，由 RBAC + 页面 ACL 控制
    case 'all':
      return true // Bug 反馈：所有登录用户可写
    case 'super_admin_only':
      return isSuper // Release Notes：仅超管
    case 'none':
    default:
      return isAdmin // 平台手册：仅管理员
  }
}
