/**
 * Shared types for CMDB Admin components
 */

import type { CiModelAdminItem, CiAttributeGroupResponse } from '@/types/cmdb-model'

// Re-export shared types for convenience
export type { CiModelAdminItem, CiAttributeGroupResponse }

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
