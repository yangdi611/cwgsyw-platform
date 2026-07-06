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
  createdBy: number
  /** 由后端计算：admin/super_admin 或 createdBy == 当前用户，决定能否看到授权入口/重命名 */
  canManageAcl: boolean
  /** 由后端计算：当前用户对该空间是否有 create 权限，侧栏"新建根页面"按钮据此显隐 */
  canCreatePage: boolean
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
  /** 由后端 WikiPageService.toVO 计算，前端按钮显隐直接读取，不再依赖本地 hasPermission() */
  canWrite: boolean
  canDelete: boolean
  canPublish: boolean
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

/** 空间级已天然放行、无法在页面/空间 ACL 弹窗里被收回的权限，reason 供 tooltip 展示原因。 */
export interface WikiAclForcedGrant {
  subjectType: string
  subjectId: number
  subjectName: string
  permissions: string[]
  reason: 'admin_scope' | 'role_permission' | 'creator' | 'space_acl'
}

export interface WikiAcl {
  pageId: number
  inherited: boolean
  entries: WikiAclEntry[]
  /** 仅服务端返回时携带，保存请求体不需要回传。 */
  forcedEntries?: WikiAclForcedGrant[]
  /** 当前处于继承状态时，从最近的自定义祖先页面解析出的有效权限——预填可编辑，不是强制。仅服务端返回时携带。 */
  inheritedEntries?: WikiAclEntry[]
}

/** 空间级 ACL 授权项，动词固定 create/update/delete/publish，不含 read（见 SPEC 3.3 节）。 */
export interface WikiSpaceAclEntry {
  subjectType: string
  subjectId: number
  subjectName: string
  permissions: string[]
}

export interface WikiSpaceAcl {
  spaceId: number
  entries: WikiSpaceAclEntry[]
  /** 仅服务端返回时携带，保存请求体不需要回传。 */
  forcedEntries?: WikiAclForcedGrant[]
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
 * 2026-07-06 起：平台使用手册 / Release Notes 彻底锁定，任何人（含管理员）都不可写，只能评论；
 * Bug 反馈与建议对所有登录用户开放 create/write/update/publish，删除单独用 {@link canDeleteInSpace} 判断。
 * @param space 空间（可能 undefined，加载中视为不可写）
 */
export function canWriteSpace(space: WikiSpace | undefined): boolean {
  if (!space) return false
  switch (space.writeScope) {
    case null:
    case undefined:
      return true // 用户自建空间，由 RBAC + 页面 ACL 控制
    case 'all':
      return true // Bug 反馈：所有登录用户可写
    default:
      return false // 平台手册 / Release Notes（none / super_admin_only）：锁定，只能评论
  }
}

/**
 * 当前用户是否可删除某空间下的页面（前端按钮可见性；后端 ACL 是最终裁判）。
 * Bug 反馈与建议的删除权只保留给 admin/super_admin，防止误删他人反馈；
 * 平台使用手册 / Release Notes 锁定空间不可删除（含管理员）。
 * @param groupScope 当前用户范围：'platform'=超管 / 'tenant'=管理员 / 'group'=普通
 */
export function canDeleteInSpace(
  space: WikiSpace | undefined,
  groupScope: string | null | undefined,
): boolean {
  if (!space) return false
  const isAdmin = groupScope === 'tenant' || groupScope === 'platform'
  switch (space.writeScope) {
    case null:
    case undefined:
      return true // 用户自建空间，由 RBAC + 空间/页面 ACL 控制
    case 'all':
      return isAdmin // Bug 反馈：仅管理员可删除
    default:
      return false // 平台手册 / Release Notes：任何人都不可删除
  }
}
