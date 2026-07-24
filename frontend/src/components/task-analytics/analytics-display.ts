const HIDDEN_COLUMNS = new Set([
  'submissionId',
  'submissionVersion',
  'templateVersionId',
  'fields',
])

const TRAILING_COLUMNS = ['businessDate', 'submittedAt']

export function analyticsDisplayColumns(columns: string[]): string[] {
  return [
    ...columns.filter((column) => !HIDDEN_COLUMNS.has(column) && !TRAILING_COLUMNS.includes(column)),
    ...TRAILING_COLUMNS.filter((column) => columns.includes(column)),
  ]
}

export function formatAnalyticsValue(column: string, value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => formatAnalyticsValue(column, item)).join('、')
  if (column === 'submittedAt' && typeof value === 'string') return formatDateTime(value)
  if (value && typeof value === 'object') return JSON.stringify(value)
  return value == null ? '-' : String(value)
}

function formatDateTime(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/)
  return match ? `${match[1]} ${match[2]}` : value
}
