/**
 * CMDB type definitions
 * Covers stable shapes for models, attributes, associations, and instances
 */

/**
 * Dynamic CMDB field value types
 * Keep flexible for custom fields
 */
export type CmdbFieldValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | Record<string, unknown>

export type CmdbFieldsData = Record<string, CmdbFieldValue>

/**
 * CMDB Model
 */
export interface CmdbModel {
  id: number
  tenantId: string
  groupId: number | null
  name: string
  key: string
  icon?: string
  description?: string
  isBuiltIn: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  createdBy: number
  updatedBy: number | null
  deletedAt?: string | null
  deletedBy?: number | null
}

/**
 * CMDB Model Group
 */
export interface CmdbModelGroup {
  id: number
  tenantId: string
  name: string
  displayOrder: number
  isDeleted: boolean
}

/**
 * CMDB Attribute
 */
export interface CmdbAttribute {
  id: number
  tenantId: string
  modelId: number
  groupId: number | null
  fieldKey: string
  fieldLabel: string
  fieldType: string
  isRequired: boolean
  isUnique: boolean
  isBuiltIn: boolean
  isDeleted: boolean
  displayOrder: number
  defaultValue?: string | null
  options?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * CMDB Attribute Group
 */
export interface CmdbAttributeGroup {
  id: number
  tenantId: string
  modelId: number
  name: string
  displayOrder: number
  isDeleted: boolean
}

/**
 * CMDB Association Kind (e.g., "部署于", "包含")
 */
export interface CmdbAssociationKind {
  id: number
  tenantId: string
  name: string
  reverseLabel: string
  isDeleted: boolean
}

/**
 * CMDB Association Definition (link between two models)
 */
export interface CmdbAssociationDefinition {
  id: number
  tenantId: string
  sourceModelId: number
  targetModelId: number
  kindId: number
  isDeleted: boolean
}

/**
 * CMDB Instance (CI record)
 * fieldsData contains dynamic custom fields
 */
export interface CmdbInstance {
  id: number
  tenantId: string
  modelId: number
  fieldsData: CmdbFieldsData
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  createdBy: number
  updatedBy: number | null
  deletedAt?: string | null
  deletedBy?: number | null
}

/**
 * CMDB Instance with model metadata (for list views)
 */
export interface CmdbInstanceWithModel extends CmdbInstance {
  modelName?: string
  modelKey?: string
}
