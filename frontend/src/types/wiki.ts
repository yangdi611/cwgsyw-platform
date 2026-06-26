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
