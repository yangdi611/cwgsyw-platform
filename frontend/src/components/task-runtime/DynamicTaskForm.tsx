'use client'

import { useEffect, useMemo, useState } from 'react'
import type { TaskFieldDefinition } from '@/lib/task-template-api'
import type { AggregateReferencePreview, DraftAttachment } from '@/lib/task-runtime-api'
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Icon,
  Input,
  Select,
  Textarea,
} from '@/design-system/figma-neutral/components'

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
  return (
    <div className="cwgsyw-form">
      {fields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={values[field.key]}
          aggregateReference={previews.get(field.key)}
          attachments={attachments.filter((item) => item.fieldKey === field.key || item.fieldKey.startsWith(`${field.key}${TABLE_ATTACHMENT_SEPARATOR}`))}
          feedback={fieldFeedback[field.key] ?? []}
          attachmentFeedback={attachmentFeedback}
          readOnly={readOnly}
          uploading={uploading === field.key}
          onChange={(value) => onChange(field.key, value)}
          onUpload={async (file, key = field.key) => {
            setUploading(key)
            try {
              await onUpload(key, file)
            } finally {
              setUploading(undefined)
            }
          }}
          onDeleteAttachment={onDeleteAttachment}
        />
      ))}
    </div>
  )
}

function FieldRenderer({ field, value, aggregateReference, attachments, feedback, attachmentFeedback, readOnly, uploading, onChange, onUpload, onDeleteAttachment }: {
  field: TaskFieldDefinition; value: unknown; attachments: DraftAttachment[]; readOnly: boolean; uploading: boolean
  aggregateReference?: AggregateReferencePreview
  feedback: Array<{ severity: string; comment: string }>; attachmentFeedback: Record<number, string[]>
  onChange: (value: unknown) => void; onUpload: (file: File, fieldKey?: string) => Promise<void>; onDeleteAttachment: (id: number) => Promise<void>
}) {
  if (field.type === 'section') {
    return (
      <div>
        <h3 className="cwgsyw-type-title-sm">{field.label}</h3>
      </div>
    )
  }
  if (field.type === 'help_text') {
    return <p className="cwgsyw-type-body-sm">{field.label}</p>
  }
  if (field.type === 'formula') {
    return (
      <Field label={field.label} required={field.required} state={readOnly ? 'disabled' : 'default'}>
        <div className="cwgsyw-type-body-sm">{value == null ? '提交时由服务端计算' : String(value)}</div>
      </Field>
    )
  }
  if (field.type === 'aggregate_reference') return <AggregateReferenceField field={field} value={value} preview={aggregateReference} />
  if (field.type === 'table') {
    return (
      <div className="cwgsyw-form">
        <Field label={field.label} required={field.required}>
          <div>
            <RepeatingTable field={field} value={value} attachments={attachments} readOnly={readOnly} uploading={uploading} onChange={onChange} onUpload={onUpload} onDeleteAttachment={onDeleteAttachment} attachmentFeedback={attachmentFeedback} />
          </div>
        </Field>
        <FeedbackList feedback={feedback} />
      </div>
    )
  }
  if (field.type === 'file' || field.type === 'image') {
    return (
      <div className="cwgsyw-form">
        <Field label={field.label} required={field.required} state={readOnly ? 'disabled' : 'default'}>
          <div>
            <AttachmentCell attachments={attachments} readOnly={readOnly} uploading={uploading} accept={field.type === 'image' ? 'image/*' : undefined} attachmentFeedback={attachmentFeedback} onUpload={(file) => onUpload(file)} onDeleteAttachment={onDeleteAttachment} />
          </div>
        </Field>
      </div>
    )
  }

  const display = field.display ?? {}
  const placeholder = typeof display.placeholder === 'string' ? display.placeholder : undefined
  return (
    <div className="cwgsyw-form">
      <Field label={field.label} required={field.required} state={readOnly ? 'disabled' : 'default'}>
        {renderControl(field, value, readOnly, placeholder, onChange)}
      </Field>
      <FeedbackList feedback={feedback} />
    </div>
  )
}

function RepeatingTable({ field, value, attachments, readOnly, uploading, onChange, onUpload, onDeleteAttachment, attachmentFeedback }: { field: TaskFieldDefinition; value: unknown; attachments: DraftAttachment[]; readOnly: boolean; uploading: boolean; onChange: (value: TableRow[]) => void; onUpload: (file: File, fieldKey?: string) => Promise<void>; onDeleteAttachment: (id: number) => Promise<void>; attachmentFeedback: Record<number, string[]> }) {
  const config = field.validation ?? {}
  const columns = useMemo(() => Array.isArray(config.columns) ? config.columns.filter(isTableColumn) : [], [config.columns])
  const rows = useMemo(() => normalizeRows(value, columns, Number(config.defaultRows ?? 1)), [value, columns, config.defaultRows])
  const minRows = Math.max(0, Number(config.minRows ?? 0))
  const maxRows = Math.max(minRows, Number(config.maxRows ?? 50))
  const requiresRowNormalization = !Array.isArray(value) || rowsNeedNormalization(value)
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
  if (columns.length === 0) {
    return <Alert tone="warning" title="该表格尚未配置列。" description="请先在模板中配置表格列后再填写。" showDismiss={false} />
  }
  return (
    <div className="cwgsyw-form">
      {typeof config.description === 'string' && config.description ? <p className="cwgsyw-type-body-sm">{config.description}</p> : null}
      <div className="cwgsyw-table-wrap">
        <table className="cwgsyw-table cwgsyw-table--compact">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="cwgsyw-th">
                  {column.label}
                  {column.required ? <span className="cwgsyw-field__required" aria-hidden="true">*</span> : null}
                </th>
              ))}
              {!readOnly ? <th className="cwgsyw-th" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.__rowId}>
                {columns.map((column) => (
                  <td key={column.key} className="cwgsyw-td">
                    <TableCell
                      column={column}
                      value={row[column.key]}
                      readOnly={readOnly}
                      attachments={attachments.filter((attachment) => attachment.fieldKey === tableAttachmentKey(field.key, row.__rowId, column.key))}
                      uploading={uploading}
                      attachmentFeedback={attachmentFeedback}
                      onChange={(cell) => replaceRow(rowIndex, { ...row, [column.key]: cell })}
                      onUpload={(file) => onUpload(file, tableAttachmentKey(field.key, row.__rowId, column.key))}
                      onDeleteAttachment={onDeleteAttachment}
                    />
                  </td>
                ))}
                {!readOnly ? (
                  <td className="cwgsyw-td">
                    <div className="cwgsyw-inline-controls">
                      <Button type="button" size="sm" variant="ghost" disabled={rows.length >= maxRows} onClick={() => addRow(row)}>
                        复制
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={rows.length <= minRows} onClick={() => void removeRow(rowIndex)}>
                        <Icon name="trash" size="sm" />
                        删除
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {totals.length > 0 ? (
              <tr>
                {columns.map((column, index) => (
                  <td key={column.key} className="cwgsyw-td">
                    {index === 0 ? '汇总' : totals.find((item) => item.key === column.key)?.text ?? ''}
                  </td>
                ))}
                {!readOnly ? <td className="cwgsyw-td" /> : null}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {!readOnly ? (
        <div className="cwgsyw-inline-controls">
          <Button type="button" size="sm" variant="secondary" disabled={rows.length >= maxRows} onClick={() => addRow()}>
            新增一行
          </Button>
          <span className="cwgsyw-type-label-xs">
            {rows.length}/{maxRows} 行{minRows > 0 ? `，至少 ${minRows} 行` : ''}
          </span>
        </div>
      ) : null}
    </div>
  )
}

function TableCell({ column, value, readOnly, attachments, uploading, attachmentFeedback, onChange, onUpload, onDeleteAttachment }: { column: TableColumn; value: unknown; readOnly: boolean; attachments: DraftAttachment[]; uploading: boolean; attachmentFeedback: Record<number, string[]>; onChange: (value: unknown) => void; onUpload: (file: File) => Promise<void>; onDeleteAttachment: (id: number) => Promise<void> }) {
  if (column.type === 'auto_number') return <span className="cwgsyw-type-label-sm">{String(value ?? '')}</span>
  if (column.type === 'file' || column.type === 'image') {
    return (
      <AttachmentCell
        attachments={attachments}
        readOnly={readOnly}
        uploading={uploading}
        accept={column.type === 'image' ? 'image/*' : undefined}
        compact
        attachmentFeedback={attachmentFeedback}
        onUpload={onUpload}
        onDeleteAttachment={onDeleteAttachment}
      />
    )
  }
  if (column.type === 'textarea') return <Textarea disabled={readOnly} rows={2} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} />
  if (column.type === 'number') {
    return (
      <Input
        disabled={readOnly}
        type="number"
        min={numberSetting(column, 'min')}
        max={numberSetting(column, 'max')}
        step={numberStep(column)}
        value={stringValue(value)}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      />
    )
  }
  if (column.type === 'single_select') {
    const selectOptions = columnOptions(column)
    return (
      <Select
        disabled={readOnly}
        value={stringValue(value) || undefined}
        placeholder="请选择"
        options={selectOptions}
        onChange={onChange}
      />
    )
  }
  if (column.type === 'date' || column.type === 'datetime') {
    return <Input disabled={readOnly} type={column.type === 'date' ? 'date' : 'datetime-local'} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} />
  }
  return <Input disabled={readOnly} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} />
}

function AttachmentCell({ attachments, readOnly, uploading, accept, compact = false, attachmentFeedback, onUpload, onDeleteAttachment }: { attachments: DraftAttachment[]; readOnly: boolean; uploading: boolean; accept?: string; compact?: boolean; attachmentFeedback: Record<number, string[]>; onUpload: (file: File) => Promise<void>; onDeleteAttachment: (id: number) => Promise<void> }) {
  return (
    <div className={compact ? 'cwgsyw-form' : 'cwgsyw-form'}>
      <div className="cwgsyw-stack-list">
        {attachments.map((attachment) => (
          <div key={attachment.id}>
            <div className="cwgsyw-inline-controls">
              <span className="cwgsyw-type-body-sm">{attachment.fileName}</span>
              {!readOnly ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => void onDeleteAttachment(attachment.id)}>
                  <Icon name="trash" size="sm" />
                  删除
                </Button>
              ) : null}
            </div>
            {(attachmentFeedback[attachment.id] ?? []).map((comment, index) => (
              <Alert key={`${attachment.id}:${index}`} tone="warning" title="附件意见" description={comment} showDismiss={false} />
            ))}
          </div>
        ))}
      </div>
      {!readOnly ? (
        <label className="cwgsyw-type-label-sm">
          {uploading ? '上传中…' : '上传'}
          <input
            className="cwgsyw-sr-only"
            type="file"
            accept={accept}
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void onUpload(file)
              event.target.value = ''
            }}
          />
        </label>
      ) : null}
    </div>
  )
}

function AggregateReferenceField({ field, value, preview }: { field: TaskFieldDefinition; value: unknown; preview?: AggregateReferencePreview }) {
  const selected = preview?.selectedValue ?? value
  return (
    <Field label={field.label} required={field.required} helperText={preview ? `${preview.from} 至 ${preview.to} · ${preview.sourceTaskCount} 个来源任务 · ${sourceLabel(preview.selectedSourceRole)}` : '提交时由服务端解析'}>
      <div>
        <p className="cwgsyw-type-body-sm">{selected == null ? '暂无可汇总数据' : String(selected)}</p>
        {preview ? (
          <p className="cwgsyw-type-label-xs">
            系统值 {formatMetricValue(preview.systemValue)} · 人工值 {formatMetricValue(preview.manualValue)} · 差异 {formatMetricValue(preview.difference)}
          </p>
        ) : null}
      </div>
    </Field>
  )
}

function renderControl(field: TaskFieldDefinition, value: unknown, readOnly: boolean, placeholder: string | undefined, onChange: (value: unknown) => void) {
  if (['textarea', 'rich_text'].includes(field.type)) {
    return <Textarea disabled={readOnly} rows={field.type === 'rich_text' ? 8 : 4} value={stringValue(value)} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
  }
  if (['number', 'money', 'percentage', 'rating', 'duration'].includes(field.type)) {
    return <Input disabled={readOnly} type="number" value={stringValue(value)} placeholder={placeholder} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} />
  }
  if (field.type === 'boolean') {
    return <Checkbox disabled={readOnly} checked={Boolean(value)} label={Boolean(value) ? '是' : '否'} onChange={(event) => onChange(event.target.checked)} />
  }
  if (field.type === 'single_select') {
    return <Select disabled={readOnly} value={stringValue(value) || undefined} placeholder={placeholder || '请选择'} options={options(field)} onChange={onChange} />
  }
  if (field.type === 'multi_select' || field.type === 'tags') {
    const selected = Array.isArray(value) ? value.map(String) : []
    return (
      <div className="cwgsyw-inline-controls">
        {options(field).map((option) => (
          <Checkbox
            key={option.value}
            disabled={readOnly}
            checked={selected.includes(option.value)}
            label={option.label}
            onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))}
          />
        ))}
      </div>
    )
  }
  if (field.type === 'date' || field.type === 'datetime') {
    return <Input disabled={readOnly} type={field.type === 'date' ? 'date' : 'datetime-local'} value={stringValue(value)} onChange={(event) => onChange(event.target.value)} />
  }
  if (['user', 'group', 'role'].includes(field.type)) {
    return <Input disabled={readOnly} type="number" min={1} value={stringValue(value)} placeholder="输入对象 ID" onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} />
  }
  if (STRUCTURED_TYPES.has(field.type)) return <JsonValueEditor disabled={readOnly} value={value} onChange={onChange} placeholder={placeholder} />
  return <Input disabled={readOnly} value={stringValue(value)} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
}

function normalizeRows(value: unknown, columns: TableColumn[], defaultRows: number): TableRow[] {
  if (Array.isArray(value)) {
    const used = new Set<string>()
    return value.filter(isRow).map((row, index) => {
      const candidate = typeof row.__rowId === 'string' && isValidRowId(row.__rowId) && !used.has(row.__rowId) ? row.__rowId : rowId()
      used.add(candidate)
      return applyAutoNumbers({ ...row, __rowId: candidate }, columns, index)
    })
  }
  return Array.from({ length: Math.max(0, defaultRows) }, (_, index) => createRow(columns, index))
}
function createRow(columns: TableColumn[], index: number, source?: TableRow): TableRow { return applyAutoNumbers({ ...(source ?? {}), __rowId: rowId() }, columns, index) }
function applyAutoNumbers(row: TableRow, columns: TableColumn[], index: number): TableRow {
  const next = { ...row }
  columns.filter((column) => column.type === 'auto_number').forEach((column) => {
    const config = column.validation ?? {}
    next[column.key] = Number(config.start ?? 1) + index * Number(config.step ?? 1)
  })
  return next
}
function rowId() { return globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 16) ?? `r${Date.now().toString(36).slice(-8)}${Math.random().toString(36).slice(2, 12)}` }
function isValidRowId(value: string) { return /^[a-zA-Z0-9_-]{8,32}$/.test(value) }
function rowsNeedNormalization(value: unknown) {
  if (!Array.isArray(value)) return true
  const used = new Set<string>()
  return value.some((row) => {
    if (!isRow(row) || typeof row.__rowId !== 'string' || !isValidRowId(row.__rowId) || used.has(row.__rowId)) return true
    used.add(row.__rowId)
    return false
  })
}
function tableAttachmentKey(tableKey: string, rowId: string, columnKey: string) { return `${tableKey}${TABLE_ATTACHMENT_SEPARATOR}${rowId}${TABLE_ATTACHMENT_SEPARATOR}${columnKey}` }
function tableSummaries(rows: TableRow[], columns: TableColumn[]) {
  return columns.filter((column) => column.type === 'number' && column.summary && column.summary !== 'none').map((column) => {
    const values = rows.map((row) => Number(row[column.key])).filter(Number.isFinite)
    if (values.length === 0) return { key: column.key, text: '-' }
    const summary = column.summary === 'sum' ? values.reduce((total, item) => total + item, 0) : column.summary === 'avg' ? values.reduce((total, item) => total + item, 0) / values.length : column.summary === 'min' ? Math.min(...values) : Math.max(...values)
    return { key: column.key, text: `${summaryLabel(column.summary)}：${summary}` }
  })
}
function summaryLabel(summary: TableColumn['summary']) {
  const labels: Record<NonNullable<TableColumn['summary']>, string> = { none: '', sum: '合计', avg: '平均', min: '最小', max: '最大' }
  return labels[summary ?? 'none']
}
function numberSetting(column: TableColumn, key: 'min' | 'max') {
  const value = column.validation?.[key]
  return typeof value === 'number' || typeof value === 'string' ? Number(value) : undefined
}
function numberStep(column: TableColumn) {
  const scale = Number(column.validation?.scale)
  return Number.isInteger(scale) && scale >= 0 ? 1 / (10 ** scale) : 'any'
}
function columnOptions(column: TableColumn) {
  const options = column.validation?.options
  return Array.isArray(options) ? options.filter((item): item is { value: string; label: string } => typeof item === 'object' && item !== null && 'value' in item && 'label' in item).map((item) => ({ value: String(item.value), label: String(item.label) })) : []
}
function isTableColumn(value: unknown): value is TableColumn { return typeof value === 'object' && value !== null && 'key' in value && 'label' in value && 'type' in value }
function isRow(value: unknown): value is TableRow { return typeof value === 'object' && value !== null }

function JsonValueEditor({ value, disabled, onChange, placeholder }: { value: unknown; disabled: boolean; onChange: (value: unknown) => void; placeholder?: string }) {
  const [text, setText] = useState(() => value == null ? '' : JSON.stringify(value, null, 2))
  const [invalid, setInvalid] = useState(false)
  return (
    <div className="cwgsyw-form">
      <Textarea
        disabled={disabled}
        rows={6}
        value={text}
        placeholder={placeholder || '输入 JSON 对象或数组'}
        error={invalid}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          try {
            onChange(next ? JSON.parse(next) : null)
            setInvalid(false)
          } catch {
            setInvalid(true)
          }
        }}
      />
      {invalid ? <p className="cwgsyw-field__error cwgsyw-type-label-xs" role="alert">JSON 格式无效</p> : null}
    </div>
  )
}

function FeedbackList({ feedback }: { feedback: Array<{ severity: string; comment: string }> }) {
  if (feedback.length === 0) return null
  return (
    <div className="cwgsyw-form">
      {feedback.map((item, index) => (
        <Alert
          key={`${item.comment}:${index}`}
          tone={item.severity === 'error' ? 'danger' : 'warning'}
          title="审批意见"
          description={item.comment}
          showDismiss={false}
        />
      ))}
    </div>
  )
}

function stringValue(value: unknown) { return value == null ? '' : String(value) }
function options(field: TaskFieldDefinition) {
  const value = field.validation?.options
  return Array.isArray(value) ? value.filter((item): item is { value: string; label: string } => typeof item === 'object' && item !== null && 'value' in item && 'label' in item).map((item) => ({ value: String(item.value), label: String(item.label) })) : []
}
function formatMetricValue(value: number | undefined) { return value == null ? '-' : String(value) }
function sourceLabel(source: string) { return source === 'manual_report' ? '人工上报为权威来源' : '系统汇总为权威来源' }
