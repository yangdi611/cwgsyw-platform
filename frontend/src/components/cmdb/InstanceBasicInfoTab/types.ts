import type { CiAttributeResponse, CiAttributeGroupResponse, CmdbFieldsData, CmdbTableSchema } from '@/types/cmdb-model'

export interface TableColumn {
  key: string
  name: string
  type: string
  system?: boolean
  required?: boolean
  options?: { id: string; name: string }[]
}

export interface TableSchema {
  schema_version?: number
  row_key?: string
  display_key?: string
  columns: TableColumn[]
}

// Re-export shared types for backward compatibility
export type CiAttributeVO = CiAttributeResponse
export type CiAttributeGroupVO = CiAttributeGroupResponse

export interface CiModelVO {
  attributeGroups: CiAttributeGroupVO[]
}

export interface CiInstanceVO {
  id: number
  modelId: string
  name: string
  fieldsData: CmdbFieldsData
  attributes: CiAttributeVO[]
}

export interface TableCol {
  key: string
  name: string
  type: string
  system?: boolean
  required?: boolean
  options?: { id: string; name: string }[]
}

export function schemaCols(schema: unknown): TableCol[] {
  if (!schema || typeof schema !== 'object') return []
  const s = schema as { columns?: TableCol[] }
  return s.columns ?? []
}

export function rowKeyOf(schema: unknown): string {
  if (!schema || typeof schema !== 'object') return 'id'
  const s = schema as { row_key?: string }
  return s.row_key ?? 'id'
}

export function genRowId(): string {
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
