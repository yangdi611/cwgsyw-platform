/**
 * Shared types for CMDB Admin components
 */

export interface CiModelVO {
  id: number
  modelId: string
  name: string
  displayName?: string
  icon: string
  group: string
  groupName?: string
  description: string
  isBuiltIn: boolean
  isPaused: boolean
}

export interface ModelGroupVO {
  id: number
  code: string
  name: string
  icon: string | null
  sortOrder: number
  isBuiltIn: boolean
  modelCount: number
}

export interface CiAssociationDefVO {
  id: number
  defId: string
  name: string
  kindId: number
  kindName: string
  srcModelId: string
  srcModelName?: string
  dstModelId: string
  dstModelName?: string
  mapping: string
  onDelete: 'none' | 'cascade' | 'restrict'
}

export interface AssociationKindVO {
  id: number
  name: string
  reverseLabel: string
}

export interface AssociationAttrVO {
  id: number
  kindId: number
  name: string
  fieldType: string
  isRequired: boolean
  defaultValue?: string
  enumOptions?: string[]
  sortOrder: number
}

export interface CiAttributeGroupVO {
  id: number
  modelId: string
  name: string
  sortOrder: number
  groupId?: string
  isBuiltIn?: boolean
  attributeCount?: number
}

/**
 * API error type for safer error handling
 */
export type ApiErrorLike = {
  response?: {
    data?: {
      message?: string
    }
  }
  message?: string
}
