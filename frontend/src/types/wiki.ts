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
  pageCount: number
  updatedAt: string
  createdByName: string
  readOnly: boolean
  /** true = seed 系统空间，前端据此置于「官方手册」层 */
  system: boolean
  /** null=用户空间 / 'none' / 'super_admin_only' / 'all' */
  writeScope: string | null
}

export interface WikiPageTree {
  id: number
  title: string
  slug: string
  status: WikiStatus
  sortOrder: number
  spaceId: number
  children: WikiPageTree[]
}

export interface WikiPage {
  id: number
  spaceId: number
  parentId: number | null
  title: string
  slug: string
  content: string
  status: WikiStatus
  currentVersion: number
  aclCustom: boolean
  updatedAt: string
  updatedByName: string
  backlinkCount: number
}

export interface WikiBacklink {
  pageId: number
  title: string
  spaceId: number
}

export interface WikiVersion {
  version: number
  title: string
  comment: string
  createdByName: string
  createdAt: string
}

export interface WikiSearchResult {
  pageId: number
  spaceId: number
  title: string
  highlight: string
  updatedAt: string
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
  subjectType: string
  subjectId: number
  subjectName: string
  permissions: string[]
}

export interface WikiAcl {
  pageId: number
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
 * Wiki 页面评论。
 * 轻量反馈，不进入正文/版本历史/发布审批。内容 ≤ 300 字符。
 * canDelete 由后端按「本人 或 管理员」计算，前端据此显示删除按钮。
 */
export interface WikiComment {
  id: number
  pageId: number
  content: string
  createdBy: number | null
  createdByName: string | null
  createdAt: string
  canDelete: boolean
}

/** 评论内容最大长度（字符），与后端 WikiCommentService.MAX_CONTENT_LENGTH 一致。 */
export const WIKI_COMMENT_MAX_LENGTH = 300

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
  switch (space.writeScope) {
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
