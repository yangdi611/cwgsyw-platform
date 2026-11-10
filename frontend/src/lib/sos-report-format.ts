import type { SosFacts, SosMappingState, SosReportStatus, SosRequestStatus } from './sos-report-api'

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024
export const ACCEPTED_SUFFIXES = ['.tar.xz', '.txz', '.tar.gz', '.tgz']

export function formatDuration(seconds: number): string {
  if (seconds < 60) return '不到 1 分钟'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `约 ${minutes} 分钟`
  return `约 ${(minutes / 60).toFixed(1)} 小时`
}

export const REPORT_STATUS: Record<SosReportStatus, { label: string; tone: Tone }> = {
  pending: { label: '排队中', tone: 'neutral' },
  parsing: { label: '解析中', tone: 'info' },
  parsed: { label: '解析成功', tone: 'success' },
  failed: { label: '解析失败', tone: 'danger' },
}

export const REQUEST_STATUS: Record<SosRequestStatus, { label: string; tone: Tone }> = {
  pending_approval: { label: '审批中', tone: 'info' },
  applied: { label: '已入库', tone: 'success' },
  rejected: { label: '已驳回', tone: 'neutral' },
  apply_failed: { label: '写入失败', tone: 'danger' },
}

export const MAPPING_STATE: Record<SosMappingState, { label: string; tone: Tone }> = {
  preset: { label: '预置', tone: 'neutral' },
  confirmed: { label: '已确认', tone: 'success' },
  stale: { label: '已失效', tone: 'warning' },
  suggested: { label: 'AI 建议待确认', tone: 'info' },
  unmappable: { label: '无法映射', tone: 'neutral' },
  pending: { label: '待配置', tone: 'warning' },
  manual_only: { label: '人工填写', tone: 'neutral' },
}

export const ORIGIN_LABEL: Record<string, string> = {
  preset: '预置规则',
  confirmed: '映射规则',
  manual: '人工填写',
  none: '—',
}

/** 字段值的来源说明。AI 只建议“取哪项数据”，值本身来自报告。 */
export function fieldSourceLabel(field: { origin: string; ruleSource?: string; factLabel?: string }): string {
  const base = field.ruleSource === 'ai'
    ? 'AI 建议的规则（已人工确认）'
    : ORIGIN_LABEL[field.origin] ?? '—'
  return field.factLabel && field.origin !== 'manual' ? `${base} · ${field.factLabel}` : base
}

export function aiNote(field: { ruleSource?: string; aiConfidence?: number; aiReason?: string }): string {
  if (field.ruleSource !== 'ai') return '—'
  const confidence = field.aiConfidence != null ? `置信度 ${Math.round(Number(field.aiConfidence) * 100)}%` : '未给出置信度'
  return field.aiReason ? `${confidence}：${field.aiReason}` : confidence
}

export function aiFields<T extends { ruleSource?: string }>(fields: T[] | undefined): T[] {
  return (fields ?? []).filter((field) => field.ruleSource === 'ai')
}

export const AI_VERDICT_LABEL: Record<string, string> = {
  mapped: '有对应事实',
  ambiguous: '有歧义',
  unmappable: '报告中没有',
}

export function isFinished(status: SosReportStatus): boolean {
  return status === 'parsed' || status === 'failed'
}

export function hasAcceptedSuffix(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return ACCEPTED_SUFFIXES.some((suffix) => lower.endsWith(suffix))
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

export function formatValue(value: unknown, unit?: string): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.join('、')
  if (typeof value === 'object') return JSON.stringify(value)
  return unit ? `${String(value)} ${unit}` : String(value)
}

/**
 * 报告事实的展示文本。与 {@link formatValue} 相同，另外把布尔值显示为“是/否”，
 * 并按 labels 把枚举值换成中文。只用于结构化数据页，CMDB 字段值仍用 formatValue。
 */
export function formatFactValue(value: unknown, unit?: string, labels?: Record<string, string>): string {
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'string' && labels?.[value]) return labels[value]
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const parts = Object.values(value as Record<string, unknown>).filter((part) => part !== null && part !== undefined && part !== '')
    return parts.length === 0 ? '—' : parts.map(String).join(' / ')
  }
  return formatValue(value, unit)
}

/** 解析器把没有安装部件的插槽、托架标为 installed: false。 */
export function isEmptySlot(row: Record<string, unknown>): boolean {
  return row.installed === false
}

export function fact(facts: SosFacts | undefined, key: string): unknown {
  return facts?.[key]
}

export function factRows(facts: SosFacts | undefined, key: string): Record<string, unknown>[] {
  const value = facts?.[key]
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === 'object') as Record<string, unknown>[]) : []
}

export function factStrings(facts: SosFacts | undefined, key: string): string[] {
  const value = facts?.[key]
  return Array.isArray(value) ? value.map(String) : []
}

/** 把表单里的文本转换成字段需要的类型；数字保持文本，由后端校验。 */
export function toOverrideValue(fieldType: string, text: string): unknown {
  if (fieldType === 'bool') {
    if (text === 'true') return true
    if (text === 'false') return false
    return undefined
  }
  return text
}

export function overrideText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/** 这些字段类型不能在入库确认页填写，要到 CMDB 里维护。 */
export function isEditableInDraft(fieldType: string): boolean {
  return !['table', 'enummulti', 'objuser'].includes(fieldType)
}

/** 枚举映射的编辑行转换为接口参数。空行被丢弃。 */
export function enumRowsToMap(rows: { source: string; target: string }[]): Record<string, string> {
  const map: Record<string, string> = {}
  rows.forEach(({ source, target }) => {
    const key = source.trim()
    if (key && target) map[key] = target
  })
  return map
}
