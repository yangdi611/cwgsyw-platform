/**
 * CMDB 前端契约类型定义
 *
 * 本文件建立统一的 CMDB 模型、属性、关联类型，消除前端局部类型重复定义。
 * 类型命名遵循场景语义原则，区分列表、详情、表单等不同用途。
 *
 * @see docs/plan/optimizations/cmdb-frontend-contract-and-consistency-spec.md
 */

// ============================================================================
// 基础类型
// ============================================================================

export type CmdbPrimitiveValue = string | number | boolean | null

export type CmdbFieldValue =
  | CmdbPrimitiveValue
  | CmdbPrimitiveValue[]
  | Record<string, unknown>
  | Record<string, unknown>[]

export type CmdbFieldsData = Record<string, CmdbFieldValue>

export type CmdbAttributeOption =
  | { id: string; name: string; isDefault?: boolean }
  | { id: string; name: string; is_default?: boolean }

export interface CmdbTableColumnSchema {
  key: string
  name: string
  type: string
  system?: boolean
  required?: boolean
  options?: CmdbAttributeOption[]
}

export interface CmdbTableSchema {
  schema_version?: number
  row_key?: string
  display_key?: string
  columns: CmdbTableColumnSchema[]
}

export type CmdbAttributeOptionValue =
  | CmdbAttributeOption[]
  | CmdbTableSchema
  | string
  | null

// ============================================================================
// 属性类型
// ============================================================================

/**
 * CMDB 属性响应类型
 * 对应后端 CiAttributeVO
 */
export interface CiAttributeResponse {
  id: number
  modelId?: string
  fieldKey: string
  name: string
  groupId?: string
  groupName?: string
  fieldType: string
  isRequired?: boolean
  isEditable?: boolean
  isUnique?: boolean
  isBuiltIn?: boolean
  isListShow?: boolean
  isDrawerShow?: boolean
  defaultValue?: string | null
  option?: CmdbAttributeOptionValue
  enumOptions?: string | null
  sortOrder?: number
  placeholder?: string
  unit?: string
}

/**
 * CMDB 属性分组响应类型
 * 对应后端 CiAttributeGroupVO
 */
export interface CiAttributeGroupResponse {
  id?: number
  modelId?: string | number
  groupId: string
  name: string
  sortOrder?: number
  collapsed?: boolean
  isBuiltIn?: boolean
  attributeCount?: number
}

/** Attribute group returned by the admin CRUD endpoint. */
export interface CiAttributeGroupAdminItem extends CiAttributeGroupResponse {
  id: number
  attributeCount: number
}

// ============================================================================
// 模型类型
// ============================================================================

/**
 * 模型基础类型
 * 用于只需要模型 id/name/displayName 的选择器场景
 */
export interface CiModelBase {
  id?: number
  modelId: string
  name: string
  displayName?: string
}

/**
 * 模型列表项类型
 * 用于 /cmdb/models 列表记录
 */
export interface CiModelListItem extends CiModelBase {
  group?: string
  groupName?: string
  color?: string | null
  isBuiltIn?: boolean
  enable2dView?: boolean
  instanceCount?: number
  createdAt?: string
  updatedAt?: string
}

/**
 * 模型摘要类型
 * 用于概览、浏览页需要统计和 attributes 的场景
 */
export interface CiModelSummary extends CiModelListItem {
  attributes?: CiAttributeResponse[]
}

/**
 * 带属性的模型类型
 * 用于实例列表、新建实例、基础信息 Tab
 */
export interface CiModelWithAttributes extends CiModelBase {
  attributes: CiAttributeResponse[]
  attributeGroups?: CiAttributeGroupResponse[]
}

/**
 * 模型详情类型
 * 用于模型详情接口完整响应
 */
export interface CiModelDetail extends CiModelWithAttributes {
  group?: string
  groupName?: string
  color?: string | null
  isBuiltIn?: boolean
  enable2dView?: boolean
  instanceCount?: number
  associationDefs?: unknown[]
  createdAt?: string
  updatedAt?: string
}

/**
 * 管理页模型项类型
 * 用于管理页卡片，包含管理相关的兼容字段
 */
export interface CiModelAdminItem extends CiModelListItem {
  id: number
  icon?: string | null
  description?: string | null
  isPaused?: boolean
}

// ============================================================================
// 请求 Payload 类型
// ============================================================================

/**
 * 创建模型请求
 * 对应后端 CreateModelRequest
 */
export interface CreateCiModelPayload {
  modelId: string
  name: string
  groupCode: string
  description?: string
  icon?: string
}

/**
 * 更新模型请求
 * 对应后端 UpdateModelRequest
 */
export interface UpdateCiModelPayload {
  displayName?: string
  group?: string
  description?: string
  color?: string
  enable2dView?: boolean
}

/**
 * 创建属性请求
 * 对应后端 CreateAttributeRequest
 */
export interface CreateCiAttributePayload {
  fieldKey: string
  name: string
  groupId: string
  fieldType: string
  isRequired?: boolean
  isEditable?: boolean
  isUnique?: boolean
  isListShow?: boolean
  isDrawerShow?: boolean
  defaultValue?: string | null
  option?: CmdbAttributeOptionValue
  enumOptions?: string | null
  sortOrder?: number
}

/**
 * 更新属性请求
 * 对应后端 UpdateAttributeRequest
 */
export interface UpdateCiAttributePayload {
  name?: string
  isRequired?: boolean
  isEditable?: boolean
  isListShow?: boolean
  isDrawerShow?: boolean
  defaultValue?: string | null
  option?: CmdbAttributeOptionValue
  enumOptions?: string | null
  sortOrder?: number
}
