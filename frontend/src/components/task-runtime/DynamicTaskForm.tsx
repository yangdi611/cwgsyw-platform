'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, FileUp, Paperclip, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { Textarea } from '@/components/v2/Textarea'
import type { TaskFieldDefinition } from '@/lib/task-template-api'
import type { AggregateReferencePreview, DraftAttachment } from '@/lib/task-runtime-api'

interface DynamicTaskFormProps {
  taskId: number
  fields: TaskFieldDefinition[]
  values: Record<string, unknown>
  aggregateReferences?: AggregateReferencePreview[]
  attachments: DraftAttachment[]
  readOnly: boolean
  onChange: (key: string, value: unknown) => void
  onUpload: (fieldKey: string, file: File) => Promise<void>
  onDeleteAttachment: (attachmentId: number) => Promise<void>
  fieldFeedback?: Record<string, Array<{ severity: string; comment: string }>>
  attachmentFeedback?: Record<number, string[]>
}

const STRUCTURED_TYPES = new Set(['ci_scope', 'relation', 'repeater', 'date_range', 'aggregate_reference'])
const TABLE_ATTACHMENT_SEPARATOR = '~'
type TableColumnType = 'auto_number' | 'text' | 'textarea' | 'date' | 'datetime' | 'number' | 'single_select' | 'file' | 'image'
interface TableColumn { key: string; label: string; type: TableColumnType; required?: boolean; validation?: Record<string, unknown>; summary?: 'none' | 'sum' | 'avg' | 'min' | 'max' }
type TableRow = Record<string, unknown> & { __rowId: string }

export function DynamicTaskForm({ fields, values, aggregateReferences = [], attachments, readOnly, onChange, onUpload, onDeleteAttachment, fieldFeedback = {}, attachmentFeedback = {} }: DynamicTaskFormProps) {
  const [uploading, setUploading] = useState<string>()
  const previews = new Map(aggregateReferences.map((item) => [item.fieldKey, item]))
  return <div className="space-y-4">{fields.map((field) => <FieldRenderer key={field.key} field={field} value={values[field.key]} aggregateReference={previews.get(field.key)} attachments={attachments.filter((item) => item.fieldKey === field.key || item.fieldKey.startsWith(`${field.key}${TABLE_ATTACHMENT_SEPARATOR}`))} feedback={fieldFeedback[field.key] ?? []} attachmentFeedback={attachmentFeedback} readOnly={readOnly} uploading={uploading === field.key} onChange={(value) => onChange(field.key, value)} onUpload={async (file, key = field.key) => { setUploading(key); try { await onUpload(key, file) } finally { setUploading(undefined) } }} onDeleteAttachment={onDeleteAttachment} />)}</div>
}

function FieldRenderer({ field, value, aggregateReference, attachments, feedback, attachmentFeedback, readOnly, uploading, onChange, onUpload, onDeleteAttachment }: {
  field: TaskFieldDefinition; value: unknown; attachments: DraftAttachment[]; readOnly: boolean; uploading: boolean
  aggregateReference?: AggregateReferencePreview
  feedback: Array<{ severity: string; comment: string }>; attachmentFeedback: Record<number, string[]>
  onChange: (value: unknown) => void; onUpload: (file: File, fieldKey?: string) => Promise<void>; onDeleteAttachment: (id: number) => Promise<void>
}) {
  if (field.type === 'section') return <div className="border-b border-v2-border pt-3 pb-2"><h3 className="font-semibold text-v2-fg">{field.label}</h3></div>
  if (field.type === 'help_text') return <div className="rounded-v2-md bg-v2-primary-soft p-3 text-sm text-v2-primary">{field.label}</div>
  if (field.type === 'formula') return <div className="space-y-2"><FieldLabel field={field} /><div className="rounded-v2-md border border-v2-border bg-v2-surface-soft px-3 py-2 font-v2-mono text-sm text-v2-fg">{value == null ? '提交时由服务端计算' : String(value)}</div></div>
  if (field.type === 'aggregate_reference') return <AggregateReferenceField field={field} value={value} preview={aggregateReference} />
  if (field.type === 'table') return <div className="space-y-2"><FieldLabel field={field} /><RepeatingTable field={field} value={value} attachments={attachments} readOnly={readOnly} uploading={uploading} onChange={onChange} onUpload={onUpload} onDeleteAttachment={onDeleteAttachment} attachmentFeedback={attachmentFeedback} /><FeedbackList feedback={feedback} /></div>
  if (field.type === 'file' || field.type === 'image') return <div className="space-y-2"><FieldLabel field={field} /><AttachmentCell attachments={attachments} readOnly={readOnly} uploading={uploading} accept={field.type === 'image' ? 'image/*' : undefined} attachmentFeedback={attachmentFeedback} onUpload={(file) => onUpload(file)} onDeleteAttachment={onDeleteAttachment} /></div>

  const display = field.display ?? {}
  const placeholder = typeof display.placeholder === 'string' ? display.placeholder : undefined
  return <div className="space-y-2"><FieldLabel field={field} />{renderControl(field, value, readOnly, placeholder, onChange)}<FeedbackList feedback={feedback} /></div>
}

function RepeatingTable({ field, value, attachments, readOnly, uploading, onChange, onUpload, onDeleteAttachment, attachmentFeedback }: { field: TaskFieldDefinition; value: unknown; attachments: DraftAttachment[]; readOnly: boolean; uploading: boolean; onChange: (value: TableRow[]) => void; onUpload: (file: File, fieldKey?: string) => Promise<void>; onDeleteAttachment: (id: number) => Promise<void>; attachmentFeedback: Record<number, string[]> }) {
  const config = field.validation ?? {}
  const columns = useMemo(() => Array.isArray(config.columns) ? config.columns.filter(isTableColumn) : [], [config.columns])
  const rows = useMemo(() => normalizeRows(value, columns, Number(config.defaultRows ?? 1)), [value, columns, config.defaultRows])
  const minRows = Math.max(0, Number(config.minRows ?? 0))
  const maxRows = Math.max(minRows, Number(config.maxRows ?? 50))
  const requiresRowNormalization = !Array.isArray(value) || value.some((row) => !isRow(row) || typeof row.__rowId !== 'string' || !row.__rowId)
  useEffect(() => {
    if (!readOnly && requiresRowNormalization && rows.length > 0) onChange(rows)
  }, [onChange, readOnly, requiresRowNormalization, rows])
  const replaceRow = (index: number, next: TableRow) => onChange(rows.map((row, current) => current === index ? next : row))
  const addRow = (source?: TableRow) => { if (rows.length < maxRows) onChange([...rows, createRow(columns, rows.length, source)]) }
  const removeRow = async (index: number) => {
    if (rows.length <= minRows) return
    const row = rows[index]
    const rowPrefix = `${field.key}${TABLE_ATTACHMENT_SEPARATOR}${row.__rowId}${TABLE_ATTACHMENT_SEPARATOR}`
    await Promise.all(attachments.filter((attachment) => attachment.fieldKey.startsWith(rowPrefix)).map((attachment) => onDeleteAttachment(attachment.id)))
    onChange(rows.filter((_, current) => current !== index).map((currentRow, current) => applyAutoNumbers(currentRow, columns, current)))
  }
  const totals = tableSummaries(rows, columns)
  if (columns.length === 0) return <p className="rounded-v2-md border border-v2-warning-border bg-v2-warning-soft p-3 text-sm text-v2-warning">该表格尚未配置列。</p>
  return <div className="space-y-2"><>{typeof config.description === 'string' && config.description && <p className="text-sm text-v2-muted">{config.description}</p>}</><div className="overflow-x-auto rounded-v2-md border border-v2-border"><table className="min-w-full text-sm"><thead className="bg-v2-surface-soft"><tr>{columns.map((column) => <th key={column.key} className="min-w-32 border-b border-v2-border px-3 py-2 text-left font-semibold text-v2-fg">{column.label}{column.required && <span className="ml-1 text-v2-danger">*</span>}</th>)}{!readOnly && <th className="w-24 border-b border-v2-border px-3 py-2" />}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={row.__rowId} className="border-b border-v2-border last:border-0">{columns.map((column) => <td key={column.key} className="min-w-32 px-2 py-2 align-top"><TableCell column={column} value={row[column.key]} readOnly={readOnly} attachments={attachments.filter((attachment) => attachment.fieldKey === tableAttachmentKey(field.key, row.__rowId, column.key))} uploading={uploading} attachmentFeedback={attachmentFeedback} onChange={(cell) => replaceRow(rowIndex, { ...row, [column.key]: cell })} onUpload={(file) => onUpload(file, tableAttachmentKey(field.key, row.__rowId, column.key))} onDeleteAttachment={onDeleteAttachment} /></td>)}{!readOnly && <td className="px-2 py-2 align-top"><div className="flex gap-1"><Button type="button" size="sm" variant="ghost" title="复制此行" disabled={rows.length >= maxRows} onClick={() => addRow(row)}><Copy className="h-4 w-4" /></Button><Button type="button" size="sm" variant="ghost" title="删除此行" disabled={rows.length <= minRows} className="text-v2-danger" onClick={() => void removeRow(rowIndex)}><Trash2 className="h-4 w-4" /></Button></div></td>}</tr>)}{totals.length > 0 && <tr className="bg-v2-surface-soft">{columns.map((column, index) => <td key={column.key} className="px-3 py-2 font-medium text-v2-fg">{index === 0 ? '汇总' : totals.find((item) => item.key === column.key)?.text ?? ''}</td>)}{!readOnly && <td />}</tr>}</tbody></table>{!readOnly && <div className="border-t border-v2-border p-2"><Button type="button" size="sm" variant="secondary" disabled={rows.length >= maxRows} onClick={() => addRow()}><Plus className="h-4 w-4" />新增一行</Button><span className="ml-3 text-xs text-v2-muted">{rows.length}/{maxRows} 行{minRows > 0 ? `，至少 ${minRows} 行` : ''}</span></div>}</div></div>
}

function TableCell({ column, value, readOnly, attachments, uploading, attachmentFeedback, onChange, onUpload, onDeleteAttachment }: { column: TableColumn; value: unknown; readOnly: boolean; attachments: DraftAttachment[]; uploading: boolean; attachmentFeedback: Record<number, string[]>; onChange: (value: unknown) => void; onUpload: (file: File) => Promise<void>; onDeleteAttachment: (id: number) => Promise<void> }) {
  if (column.type === 'auto_number') return <span className="inline-flex h-9 items-center font-v2-mono text-v2-muted">{String(value ?? '')}</span>
  if (column.type === 'file' || column.type === 'image') return <AttachmentCell attachments={attachments} readOnly={readOnly} uploading={uploading} accept={column.type === 'image' ? 'image/*' : undefined} compact attachmentFeedback={attachmentFeedback} onUpload={onUpload} onDeleteAttachment={onDeleteAttachment} />
  if (column.type === 'textarea') return <Textarea disabled={readOnly} rows={2} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} />
  if (column.type === 'number') return <Input disabled={readOnly} type="number" min={numberSetting(column, 'min')} max={numberSetting(column, 'max')} step={numberStep(column)} value={stringValue(value)} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} />
  if (column.type === 'single_select') return <Select disabled={readOnly} value={stringValue(value)} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger><SelectContent>{columnOptions(column).map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
  if (column.type === 'date' || column.type === 'datetime') return <Input disabled={readOnly} type={column.type === 'date' ? 'date' : 'datetime-local'} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} />
  return <Input disabled={readOnly} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} />
}

function AttachmentCell({ attachments, readOnly, uploading, accept, compact = false, attachmentFeedback, onUpload, onDeleteAttachment }: { attachments: DraftAttachment[]; readOnly: boolean; uploading: boolean; accept?: string; compact?: boolean; attachmentFeedback: Record<number, string[]>; onUpload: (file: File) => Promise<void>; onDeleteAttachment: (id: number) => Promise<void> }) {
  return <div className={compact ? 'space-y-1' : 'rounded-v2-md border border-dashed border-v2-border p-3'}><div className="space-y-1">{attachments.map((attachment) => <div key={attachment.id} className="rounded-v2-sm bg-v2-surface-soft px-2 py-1.5 text-xs"><div className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5 text-v2-muted" /><span className="min-w-0 flex-1 truncate text-v2-fg">{attachment.fileName}</span>{!readOnly && <Button type="button" size="sm" variant="ghost" className="h-6 w-6 px-0 text-v2-danger" title="删除附件" onClick={() => void onDeleteAttachment(attachment.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}</div>{(attachmentFeedback[attachment.id] ?? []).map((comment, index) => <p key={`${attachment.id}:${index}`} className="mt-1 rounded border border-v2-warning-border bg-v2-warning-soft px-1.5 py-1 text-v2-warning">附件意见：{comment}</p>)}</div>)}</div>{!readOnly && <label className="inline-flex cursor-pointer items-center gap-1 rounded-v2-md border border-v2-border px-2 py-1.5 text-xs text-v2-fg hover:bg-v2-surface-hover"><FileUp className="h-3.5 w-3.5" />{uploading ? '上传中…' : '上传'}<input className="hidden" type="file" accept={accept} disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(file); event.target.value = '' }} /></label>}</div>
}

function AggregateReferenceField({ field, value, preview }: { field: TaskFieldDefinition; value: unknown; preview?: AggregateReferencePreview }) {
  const selected = preview?.selectedValue ?? value
  return <div className="space-y-2"><FieldLabel field={field} /><div className="rounded-v2-md border border-v2-border bg-v2-surface-soft px-3 py-2"><p className="font-v2-mono text-sm text-v2-fg">{selected == null ? '暂无可汇总数据' : String(selected)}</p><p className="mt-1 text-xs text-v2-muted">{preview ? `${preview.from} 至 ${preview.to} · ${preview.sourceTaskCount} 个来源任务 · ${sourceLabel(preview.selectedSourceRole)}` : '提交时由服务端解析'}</p>{preview && <p className="mt-1 text-xs text-v2-muted">系统值 {formatMetricValue(preview.systemValue)} · 人工值 {formatMetricValue(preview.manualValue)} · 差异 {formatMetricValue(preview.difference)}</p>}</div></div>
}

function renderControl(field: TaskFieldDefinition, value: unknown, readOnly: boolean, placeholder: string | undefined, onChange: (value: unknown) => void) {
  if (['textarea', 'rich_text'].includes(field.type)) return <Textarea disabled={readOnly} rows={field.type === 'rich_text' ? 8 : 4} value={stringValue(value)} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
  if (['number', 'money', 'percentage', 'rating', 'duration'].includes(field.type)) return <Input disabled={readOnly} type="number" value={stringValue(value)} placeholder={placeholder} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} />
  if (field.type === 'boolean') return <label className="flex h-10 items-center gap-2"><input disabled={readOnly} type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} /><span className="text-sm text-v2-muted">{Boolean(value) ? '是' : '否'}</span></label>
  if (field.type === 'single_select') return <Select disabled={readOnly} value={stringValue(value)} onValueChange={onChange}><SelectTrigger><SelectValue placeholder={placeholder || '请选择'} /></SelectTrigger><SelectContent>{options(field).map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
  if (field.type === 'multi_select' || field.type === 'tags') { const selected = Array.isArray(value) ? value.map(String) : []; return <div className="flex flex-wrap gap-2">{options(field).map((option) => <label key={option.value} className="flex items-center gap-2 rounded-v2-md border border-v2-border px-3 py-2 text-sm"><input disabled={readOnly} type="checkbox" checked={selected.includes(option.value)} onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))} />{option.label}</label>)}</div> }
  if (field.type === 'date' || field.type === 'datetime') return <Input disabled={readOnly} type={field.type === 'date' ? 'date' : 'datetime-local'} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} />
  if (['user', 'group', 'role'].includes(field.type)) return <Input disabled={readOnly} type="number" min={1} value={stringValue(value)} placeholder="输入对象 ID" onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} />
  if (STRUCTURED_TYPES.has(field.type)) return <JsonValueEditor disabled={readOnly} value={value} onChange={onChange} placeholder={placeholder} />
  return <Input disabled={readOnly} value={stringValue(value)} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
}

function normalizeRows(value: unknown, columns: TableColumn[], defaultRows: number): TableRow[] {
  if (Array.isArray(value)) return value.filter(isRow).map((row, index) => applyAutoNumbers({ ...row, __rowId: row.__rowId || rowId() }, columns, index))
  return Array.from({ length: Math.max(0, defaultRows) }, (_, index) => createRow(columns, index))
}
function createRow(columns: TableColumn[], index: number, source?: TableRow): TableRow { return applyAutoNumbers({ ...(source ?? {}), __rowId: rowId() }, columns, index) }
function applyAutoNumbers(row: TableRow, columns: TableColumn[], index: number): TableRow { const next = { ...row }; columns.filter((column) => column.type === 'auto_number').forEach((column) => { const config = column.validation ?? {}; next[column.key] = Number(config.start ?? 1) + index * Number(config.step ?? 1) }); return next }
function rowId() { return globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 16) ?? `row${Date.now()}${Math.random().toString(36).slice(2, 8)}` }
function tableAttachmentKey(tableKey: string, rowId: string, columnKey: string) { return `${tableKey}${TABLE_ATTACHMENT_SEPARATOR}${rowId}${TABLE_ATTACHMENT_SEPARATOR}${columnKey}` }
function tableSummaries(rows: TableRow[], columns: TableColumn[]) { return columns.filter((column) => column.type === 'number' && column.summary && column.summary !== 'none').map((column) => { const values = rows.map((row) => Number(row[column.key])).filter(Number.isFinite); if (values.length === 0) return { key: column.key, text: '-' }; const summary = column.summary === 'sum' ? values.reduce((total, item) => total + item, 0) : column.summary === 'avg' ? values.reduce((total, item) => total + item, 0) / values.length : column.summary === 'min' ? Math.min(...values) : Math.max(...values); return { key: column.key, text: `${summaryLabel(column.summary)}：${summary}` } }) }
function summaryLabel(summary: TableColumn['summary']) { const labels: Record<NonNullable<TableColumn['summary']>, string> = { none: '', sum: '合计', avg: '平均', min: '最小', max: '最大' }; return labels[summary ?? 'none'] }
function numberSetting(column: TableColumn, key: 'min' | 'max') { const value = column.validation?.[key]; return typeof value === 'number' || typeof value === 'string' ? Number(value) : undefined }
function numberStep(column: TableColumn) { const scale = Number(column.validation?.scale); return Number.isInteger(scale) && scale >= 0 ? 1 / (10 ** scale) : 'any' }
function columnOptions(column: TableColumn) { const options = column.validation?.options; return Array.isArray(options) ? options.filter((item): item is { value: string; label: string } => typeof item === 'object' && item !== null && 'value' in item && 'label' in item).map((item) => ({ value: String(item.value), label: String(item.label) })) : [] }
function isTableColumn(value: unknown): value is TableColumn { return typeof value === 'object' && value !== null && 'key' in value && 'label' in value && 'type' in value }
function isRow(value: unknown): value is TableRow { return typeof value === 'object' && value !== null }

function JsonValueEditor({ value, disabled, onChange, placeholder }: { value: unknown; disabled: boolean; onChange: (value: unknown) => void; placeholder?: string }) { const [text, setText] = useState(() => value == null ? '' : JSON.stringify(value, null, 2)); const [invalid, setInvalid] = useState(false); return <div><Textarea disabled={disabled} rows={6} className="font-v2-mono text-xs" value={text} placeholder={placeholder || '输入 JSON 对象或数组'} onChange={(event) => { const next = event.target.value; setText(next); try { onChange(next ? JSON.parse(next) : null); setInvalid(false) } catch { setInvalid(true) } }} />{invalid && <p className="mt-1 text-xs text-v2-danger">JSON 格式无效</p>}</div> }
function FieldLabel({ field }: { field: TaskFieldDefinition }) { return <Label>{field.label}{field.required && <span className="ml-1 text-v2-danger">*</span>}</Label> }
function FeedbackList({ feedback }: { feedback: Array<{ severity: string; comment: string }> }) { return feedback.length === 0 ? null : <div className="space-y-1.5">{feedback.map((item, index) => <p key={`${item.comment}:${index}`} className={`rounded-v2-sm border px-2 py-1.5 text-xs ${item.severity === 'error' ? 'border-v2-danger-border bg-v2-danger-soft text-v2-danger' : 'border-v2-warning-border bg-v2-warning-soft text-v2-warning'}`}>审批意见：{item.comment}</p>)}</div> }
function stringValue(value: unknown) { return value == null ? '' : String(value) }
function options(field: TaskFieldDefinition) { const value = field.validation?.options; return Array.isArray(value) ? value.filter((item): item is { value: string; label: string } => typeof item === 'object' && item !== null && 'value' in item && 'label' in item).map((item) => ({ value: String(item.value), label: String(item.label) })) : [] }
function formatMetricValue(value: number | undefined) { return value == null ? '-' : String(value) }
function sourceLabel(source: string) { return source === 'manual_report' ? '人工上报为权威来源' : '系统汇总为权威来源' }
