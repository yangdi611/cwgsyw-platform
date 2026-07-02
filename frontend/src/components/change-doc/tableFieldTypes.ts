// 表格字段共享类型定义
// 见 SPEC: docs/plan/changereivew/enhancement1/SPEC.md 第 5、6、13 节

export interface TableColumnConfig {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'checkbox'
  required?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
}

export interface TableFieldConfig {
  tableMode: 'fixedDocxTable'
  allowAddRow: boolean
  allowDeleteRow: boolean
  allowEditColumn: false
  rowKey?: string
  minRows?: number
  maxRows?: number
  columns: TableColumnConfig[]
}

export type TableRow = Record<string, unknown> & { rowId: string }

export interface FieldConfigVO {
  id: number
  fieldKey: string
  label: string
  fieldType: string
  required: boolean
  inForm: boolean
  placeholder: string | null
  sortOrder: number
  config?: TableFieldConfig | Record<string, unknown>
}

export function isTableFieldConfig(config: unknown): config is TableFieldConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    (config as TableFieldConfig).tableMode === 'fixedDocxTable' &&
    Array.isArray((config as TableFieldConfig).columns)
  )
}

export function createBlankRow(config: TableFieldConfig): TableRow {
  const row: TableRow = { rowId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}` }
  for (const col of config.columns) {
    row[col.key] = col.type === 'checkbox' ? false : ''
  }
  return row
}

export function formatCellDisplay(value: unknown, col: TableColumnConfig): string {
  if (value === null || value === undefined || value === '') return ''
  if (col.type === 'checkbox') return value ? '是' : '否'
  if (col.type === 'select' && col.options) {
    const opt = col.options.find((o) => o.value === String(value))
    return opt ? opt.label : String(value)
  }
  return String(value)
}
