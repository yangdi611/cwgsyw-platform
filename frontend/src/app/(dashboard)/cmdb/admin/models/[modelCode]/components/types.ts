import type {
  CiAttributeGroupAdminItem,
  CiAttributeResponse,
  CiModelDetail,
  CmdbAttributeOption,
  CmdbAttributeOptionValue,
  CmdbTableSchema,
  CreateCiAttributePayload,
  UpdateCiAttributePayload,
} from '@/types/cmdb-model'

export interface AttributeAdminItem {
  id: number
  fieldKey: string
  name: string
  fieldType: string
  isBuiltIn: boolean
  isRequired: boolean
  isEditable: boolean
  isUnique: boolean
  isListShow: boolean
  isDrawerShow: boolean
  groupId: string
  groupName: string | null
  defaultValue: string | null
  sortOrder: number
  option: CmdbAttributeOptionValue
}

export type AttributeGroupAdminItem = CiAttributeGroupAdminItem
export type AttributeAdminModel = CiModelDetail
export type CreateAttributePayload = CreateCiAttributePayload
export type UpdateAttributePayload = UpdateCiAttributePayload

export const FIELD_TYPES: Record<string, string> = {
  singlechar: '单行文本',
  longchar: '多行文本',
  int: '整数',
  float: '浮点数',
  date: '日期',
  enum: '单选',
  enummulti: '多选',
  bool: '布尔',
  objuser: '用户',
  table: '表格',
}

export const TABLE_SCHEMA_TEMPLATE: CmdbTableSchema = {
  schema_version: 1,
  row_key: 'row_id',
  columns: [
    { key: 'col1', name: '列1', type: 'singlechar' },
    { key: 'col2', name: '列2', type: 'singlechar' },
  ],
}

export function toAttributeAdminItem(attribute: CiAttributeResponse): AttributeAdminItem {
  return {
    id: attribute.id,
    fieldKey: attribute.fieldKey,
    name: attribute.name,
    fieldType: attribute.fieldType,
    isBuiltIn: attribute.isBuiltIn ?? false,
    isRequired: attribute.isRequired ?? false,
    isEditable: attribute.isEditable ?? true,
    isUnique: attribute.isUnique ?? false,
    isListShow: attribute.isListShow ?? false,
    isDrawerShow: attribute.isDrawerShow ?? false,
    groupId: attribute.groupId ?? '',
    groupName: attribute.groupName ?? null,
    defaultValue: attribute.defaultValue ?? null,
    sortOrder: attribute.sortOrder ?? 0,
    option: attribute.option ?? null,
  }
}

export function parseEnumOptions(value: string): CmdbAttributeOption[] {
  return value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ id: name, name }))
}

export function formatEnumOptions(option: CmdbAttributeOptionValue): string {
  if (!Array.isArray(option)) return ''
  return option.map((item) => item.name).join(',')
}
