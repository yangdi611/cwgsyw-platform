'use client'

import { useState } from 'react'
import { FileUp, Paperclip, Trash2 } from 'lucide-react'
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

const STRUCTURED_TYPES = new Set(['ci_scope', 'relation', 'table', 'repeater', 'date_range', 'aggregate_reference'])

export function DynamicTaskForm({ fields, values, aggregateReferences = [], attachments, readOnly, onChange, onUpload, onDeleteAttachment, fieldFeedback = {}, attachmentFeedback = {} }: DynamicTaskFormProps) {
  const [uploading, setUploading] = useState<string>()
  const previews = new Map(aggregateReferences.map((item) => [item.fieldKey, item]))
  return <div className="space-y-4">{fields.map((field) => <FieldRenderer key={field.key} field={field} value={values[field.key]} aggregateReference={previews.get(field.key)} attachments={attachments.filter((item) => item.fieldKey === field.key)} feedback={fieldFeedback[field.key] ?? []} attachmentFeedback={attachmentFeedback} readOnly={readOnly} uploading={uploading === field.key} onChange={(value) => onChange(field.key, value)} onUpload={async (file) => { setUploading(field.key); try { await onUpload(field.key, file) } finally { setUploading(undefined) } }} onDeleteAttachment={onDeleteAttachment} />)}</div>
}

function FieldRenderer({ field, value, aggregateReference, attachments, feedback, attachmentFeedback, readOnly, uploading, onChange, onUpload, onDeleteAttachment }: {
  field: TaskFieldDefinition; value: unknown; attachments: DraftAttachment[]; readOnly: boolean; uploading: boolean
  aggregateReference?: AggregateReferencePreview
  feedback: Array<{ severity: string; comment: string }>; attachmentFeedback: Record<number, string[]>
  onChange: (value: unknown) => void; onUpload: (file: File) => Promise<void>; onDeleteAttachment: (id: number) => Promise<void>
}) {
  if (field.type === 'section') return <div className="border-b border-v2-border pt-3 pb-2"><h3 className="font-semibold text-v2-fg">{field.label}</h3></div>
  if (field.type === 'help_text') return <div className="rounded-v2-md bg-v2-primary-soft p-3 text-sm text-v2-primary">{field.label}</div>
  if (field.type === 'formula') return <div className="space-y-2"><FieldLabel field={field} /><div className="rounded-v2-md border border-v2-border bg-v2-surface-soft px-3 py-2 font-v2-mono text-sm text-v2-fg">{value == null ? '提交时由服务端计算' : String(value)}</div></div>
  if (field.type === 'aggregate_reference') return <AggregateReferenceField field={field} value={value} preview={aggregateReference} />
  if (field.type === 'file' || field.type === 'image') return <div className="space-y-2"><FieldLabel field={field} /><div className="rounded-v2-md border border-dashed border-v2-border p-3"><div className="space-y-2">{attachments.map((attachment) => <div key={attachment.id} className="rounded-v2-md bg-v2-surface-soft px-3 py-2 text-sm"><div className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-v2-muted" /><span className="min-w-0 flex-1 truncate text-v2-fg">{attachment.fileName}</span><span className="text-xs text-v2-muted">{formatBytes(attachment.sizeBytes)}</span>{!readOnly && <Button type="button" size="sm" variant="ghost" className="text-v2-danger" title="删除附件" onClick={() => onDeleteAttachment(attachment.id)}><Trash2 className="h-4 w-4" /></Button>}</div>{(attachmentFeedback[attachment.id] ?? []).map((comment, index) => <p key={`${attachment.id}:${index}`} className="mt-2 rounded-v2-sm border border-v2-warning-border bg-v2-warning-soft px-2 py-1.5 text-xs text-v2-warning">附件意见：{comment}</p>)}</div>)}</div>{!readOnly && <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-v2-md border border-v2-border px-3 py-2 text-sm text-v2-fg hover:bg-v2-surface-hover"><FileUp className="h-4 w-4" />{uploading ? '上传中…' : '上传附件'}<input className="hidden" type="file" accept={field.type === 'image' ? 'image/*' : undefined} disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void onUpload(file); event.target.value = '' }} /></label>}</div><FeedbackList feedback={feedback} /></div>

  const display = field.display ?? {}
  const placeholder = typeof display.placeholder === 'string' ? display.placeholder : undefined
  return <div className="space-y-2"><FieldLabel field={field} />{renderControl(field, value, readOnly, placeholder, onChange)}<FeedbackList feedback={feedback} /></div>
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
  if (field.type === 'multi_select' || field.type === 'tags') {
    const selected = Array.isArray(value) ? value.map(String) : []
    return <div className="flex flex-wrap gap-2">{options(field).map((option) => <label key={option.value} className="flex items-center gap-2 rounded-v2-md border border-v2-border px-3 py-2 text-sm"><input disabled={readOnly} type="checkbox" checked={selected.includes(option.value)} onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))} />{option.label}</label>)}</div>
  }
  if (field.type === 'date' || field.type === 'datetime') return <Input disabled={readOnly} type={field.type === 'date' ? 'date' : 'datetime-local'} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} />
  if (['user', 'group', 'role'].includes(field.type)) return <Input disabled={readOnly} type="number" min={1} value={stringValue(value)} placeholder="输入对象 ID" onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} />
  if (STRUCTURED_TYPES.has(field.type)) return <JsonValueEditor disabled={readOnly} value={value} onChange={onChange} placeholder={placeholder} />
  return <Input disabled={readOnly} value={stringValue(value)} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
}

function JsonValueEditor({ value, disabled, onChange, placeholder }: { value: unknown; disabled: boolean; onChange: (value: unknown) => void; placeholder?: string }) {
  const [text, setText] = useState(() => value == null ? '' : JSON.stringify(value, null, 2))
  const [invalid, setInvalid] = useState(false)
  return <div><Textarea disabled={disabled} rows={6} className="font-v2-mono text-xs" value={text} placeholder={placeholder || '输入 JSON 对象或数组'} onChange={(event) => { const next = event.target.value; setText(next); try { onChange(next ? JSON.parse(next) : null); setInvalid(false) } catch { setInvalid(true) } }} />{invalid && <p className="mt-1 text-xs text-v2-danger">JSON 格式无效</p>}</div>
}

function FieldLabel({ field }: { field: TaskFieldDefinition }) { return <Label>{field.label}{field.required && <span className="ml-1 text-v2-danger">*</span>}</Label> }
function FeedbackList({ feedback }: { feedback: Array<{ severity: string; comment: string }> }) { return feedback.length === 0 ? null : <div className="space-y-1.5">{feedback.map((item, index) => <p key={`${item.comment}:${index}`} className={`rounded-v2-sm border px-2 py-1.5 text-xs ${item.severity === 'error' ? 'border-v2-danger-border bg-v2-danger-soft text-v2-danger' : 'border-v2-warning-border bg-v2-warning-soft text-v2-warning'}`}>审批意见：{item.comment}</p>)}</div> }
function stringValue(value: unknown) { return value == null ? '' : String(value) }
function options(field: TaskFieldDefinition) { const value = field.validation?.options; return Array.isArray(value) ? value.filter((item): item is { value: string; label: string } => typeof item === 'object' && item !== null && 'value' in item && 'label' in item).map((item) => ({ value: String(item.value), label: String(item.label) })) : [] }
function formatBytes(size: number) { return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB` }
function formatMetricValue(value: number | undefined) { return value == null ? '-' : String(value) }
function sourceLabel(source: string) { return source === 'manual_report' ? '人工上报为权威来源' : '系统汇总为权威来源' }
