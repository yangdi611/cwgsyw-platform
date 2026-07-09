export interface CiAttributeVO {
  id: number
  fieldKey: string
  displayName: string
  fieldType: string
  builtIn: boolean
  required: boolean
  searchable: boolean
  unique: boolean
  inList: boolean
  inForm: boolean
  groupId: number | null
  groupName: string | null
  sortOrder: number
  options: string | null
  validation: string | null
}

export interface CiAttributeGroupVO {
  id: number
  modelId: number
  name: string
  sortOrder: number
  collapsed: boolean
}

export interface CiModelVO {
  id: number
  code: string
  displayName: string
  icon: string | null
  groupId: number | null
  groupName: string | null
  parentCode: string | null
  uniqueKey: string | null
}

export const FIELD_TYPES: Record<string, string> = {
  text: '文本',
  textarea: '多行文本',
  number: '数字',
  date: '日期',
  datetime: '日期时间',
  select: '单选',
  multi_select: '多选',
  boolean: '布尔',
  json: 'JSON',
  table: '表格',
}

export const TABLE_SCHEMA_TEMPLATE = JSON.stringify(
  {
    columns: [
      { key: 'col1', label: '列1', type: 'text' },
      { key: 'col2', label: '列2', type: 'text' },
    ],
  },
  null,
  2,
)

export function optionToJson(str: string | null): string {
  if (!str) return '[]'
  const arr = str.split(',').map((s) => s.trim())
  return JSON.stringify(arr, null, 2)
}
