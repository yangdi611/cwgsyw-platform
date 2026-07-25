import type { FieldTypeMetadata, TaskFieldDefinition } from '@/lib/task-template-api'

export function createTaskField(type: FieldTypeMetadata, existing: TaskFieldDefinition[]): TaskFieldDefinition {
  const base = type.type.replace(/[^a-z0-9_]/g, '_') || 'field'
  let suffix = existing.length + 1
  let key = `${base}_${suffix}`
  while (existing.some((field) => field.key === key)) key = `${base}_${++suffix}`
  return {
    key,
    label: type.label,
    type: type.type,
    sortOrder: existing.length,
    required: false,
    validation: type.type === 'single_select' || type.type === 'multi_select'
      ? { options: [{ value: 'option_1', label: '选项一' }] }
      : type.type === 'table'
        ? {
            description: '',
            defaultRows: 1,
            minRows: 0,
            maxRows: 50,
            columns: [
              { key: 'sequence', label: '序号', type: 'auto_number', required: false, validation: { start: 1, step: 1 }, summary: 'none' },
              { key: 'item', label: '事项', type: 'text', required: false, validation: {}, summary: 'none' },
            ],
          }
        : type.type === 'repeater'
          ? { columns: [{ key: 'column_1', label: '列一', type: 'text', required: false }] }
        : {},
    display: { width: 12 },
    visibility: { executor: 'read_write', approver: 'read', copied: 'read', analytics: true, export: true },
    condition: {},
    formula: {},
    analytics: { enabled: false },
    sensitive: false,
  }
}

export function normalizeFieldOrder(fields: TaskFieldDefinition[]) {
  return fields.map((field, index) => ({ ...field, sortOrder: index }))
}

export function formatJson(value: Record<string, unknown>) {
  return JSON.stringify(value ?? {}, null, 2)
}

export function parseJsonObject(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value || '{}')
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('配置必须是 JSON 对象')
  }
  return parsed as Record<string, unknown>
}
