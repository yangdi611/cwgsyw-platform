'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Switch } from '@/components/v2/Switch'
import { Textarea } from '@/components/v2/Textarea'
import type { FieldTypeMetadata, TaskFieldDefinition } from '@/lib/task-template-api'
import { formatJson, parseJsonObject } from './designer-utils'

const AGGREGATION_LABELS: Record<string, string> = {
  sum: '合计', avg: '平均值', min: '最小值', max: '最大值', count: '计数',
  distinct_count: '去重计数', weighted_avg: '加权平均值', ratio: '比率',
}

export function FieldPropertyPanel({
  field,
  fieldType,
  readOnly,
  onChange,
}: {
  field?: TaskFieldDefinition
  fieldType?: FieldTypeMetadata
  readOnly: boolean
  onChange: (field: TaskFieldDefinition) => void
}) {
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({})
  const [conditionText, setConditionText] = useState('{}')
  const [formulaText, setFormulaText] = useState('{}')
  const [validationText, setValidationText] = useState('{}')
  useEffect(() => {
    setConditionText(formatJson(field?.condition ?? {}))
    setFormulaText(formatJson(field?.formula ?? {}))
    setValidationText(formatJson(field?.validation ?? {}))
    setJsonErrors({})
  }, [field?.key, field?.condition, field?.formula, field?.validation])
  const aggregationOptions = useMemo(() => fieldType?.aggregations ?? [], [fieldType])

  if (!field) {
    return <aside className="min-h-[680px] border-l border-v2-border bg-v2-surface p-4 text-sm text-v2-muted">选择画布中的字段后配置属性</aside>
  }

  const update = <K extends keyof TaskFieldDefinition>(key: K, value: TaskFieldDefinition[K]) => {
    onChange({ ...field, [key]: value })
  }
  const updateJson = (key: 'condition' | 'formula' | 'validation', text: string) => {
    if (key === 'condition') setConditionText(text)
    if (key === 'formula') setFormulaText(text)
    if (key === 'validation') setValidationText(text)
    try {
      update(key, parseJsonObject(text))
      setJsonErrors((errors) => ({ ...errors, [key]: '' }))
    } catch (error) {
      setJsonErrors((errors) => ({ ...errors, [key]: error instanceof Error ? error.message : 'JSON 格式错误' }))
    }
  }
  const analytics = field.analytics ?? {}

  return (
    <aside className="min-h-[680px] space-y-5 border-l border-v2-border bg-v2-surface p-4">
      <div><h2 className="text-sm font-semibold text-v2-fg">字段配置</h2><p className="mt-1 text-xs text-v2-muted">{fieldType?.label ?? field.type}</p></div>
      <section className="space-y-3">
        <div className="space-y-1"><Label>标题</Label><Input disabled={readOnly} value={field.label} onChange={(event) => update('label', event.target.value)} /></div>
        <div className="space-y-1"><Label>字段编码</Label><Input disabled={readOnly || Boolean(field.id)} value={field.key} onChange={(event) => update('key', event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} /></div>
        <div className="flex items-center justify-between"><Label>必填</Label><Switch disabled={readOnly} checked={field.required} onCheckedChange={(checked) => update('required', checked)} /></div>
        <div className="flex items-center justify-between"><Label>敏感字段</Label><Switch disabled={readOnly || fieldType?.supportsSensitive === false} checked={field.sensitive} onCheckedChange={(checked) => update('sensitive', checked)} /></div>
      </section>

      {field.type === 'table' ? <TableConfigEditor field={field} disabled={readOnly} onChange={(validation) => update('validation', validation)} /> : <JsonEditor label="校验配置" value={validationText} error={jsonErrors.validation} disabled={readOnly} onChange={(value) => updateJson('validation', value)} />}
      <JsonEditor label="条件 AST" value={conditionText} error={jsonErrors.condition} disabled={readOnly} onChange={(value) => updateJson('condition', value)} hint='例：{"visibleWhen":{"op":"eq","left":{"field":"has_exception"},"right":{"literal":true}}}' />
      {(field.type === 'formula' || Object.keys(field.formula ?? {}).length > 0) && (
        <JsonEditor label="公式 AST" value={formulaText} error={jsonErrors.formula} disabled={readOnly} onChange={(value) => updateJson('formula', value)} hint='例：{"op":"DIVIDE","args":[{"field":"normal"},{"field":"total"}],"scale":2}' />
      )}

      <section className="space-y-3 border-t border-v2-border pt-4">
        <div><h3 className="text-sm font-semibold text-v2-fg">统计语义</h3><p className="mt-1 text-xs text-v2-muted">按字段类型只显示合法聚合。</p></div>
        <div className="flex items-center justify-between"><Label>启用统计</Label><Switch disabled={readOnly || field.sensitive || fieldType?.supportsAnalytics === false} checked={analytics.enabled === true} onCheckedChange={(checked) => update('analytics', { ...analytics, enabled: checked })} /></div>
        {analytics.enabled === true && (
          <>
            <div className="space-y-1"><Label>统计角色</Label><select disabled={readOnly} value={String((analytics.role as string[] | undefined)?.[0] ?? 'metric')} onChange={(event) => update('analytics', { ...analytics, role: [event.target.value] })} className="h-9 w-full rounded-v2-md border border-v2-border bg-v2-surface px-3 text-sm"><option value="metric">指标</option>{fieldType?.supportsDimension && <option value="dimension">维度</option>}<option value="filter">筛选</option><option value="detail">明细</option></select></div>
            {aggregationOptions.length > 0 && <div className="space-y-1"><Label>聚合方式</Label><select disabled={readOnly} value={String(analytics.aggregation ?? aggregationOptions[0])} onChange={(event) => update('analytics', { ...analytics, aggregation: event.target.value })} className="h-9 w-full rounded-v2-md border border-v2-border bg-v2-surface px-3 text-sm">{aggregationOptions.map((aggregation) => <option key={aggregation} value={aggregation}>{AGGREGATION_LABELS[aggregation] ?? aggregation}</option>)}</select></div>}
            <div className="space-y-1"><Label>单位</Label><Input disabled={readOnly} value={String(analytics.unit ?? '')} onChange={(event) => update('analytics', { ...analytics, unit: event.target.value })} /></div>
          </>
        )}
        {field.sensitive && <p className="flex gap-2 rounded-v2-md bg-v2-warning-soft p-2 text-xs text-v2-warning"><AlertCircle className="h-4 w-4 shrink-0" />敏感字段强制禁止导出和生成统计事实。</p>}
      </section>
    </aside>
  )
}

type TableColumnType = 'auto_number' | 'text' | 'textarea' | 'date' | 'datetime' | 'number' | 'single_select' | 'file' | 'image'
type TableColumn = {
  key: string
  label: string
  type: TableColumnType
  required: boolean
  validation: Record<string, unknown>
  summary: 'none' | 'sum' | 'avg' | 'min' | 'max'
  analyticsEnabled?: boolean
}

const TABLE_COLUMN_TYPES: Array<{ value: TableColumnType; label: string }> = [
  { value: 'auto_number', label: '自增序号' }, { value: 'text', label: '单行文本' }, { value: 'textarea', label: '多行文本' },
  { value: 'date', label: '日期' }, { value: 'datetime', label: '日期时间' }, { value: 'number', label: '数字' },
  { value: 'single_select', label: '下拉选择' }, { value: 'file', label: '附件' }, { value: 'image', label: '图片' },
]

function TableConfigEditor({ field, disabled, onChange }: { field: TaskFieldDefinition; disabled: boolean; onChange: (validation: Record<string, unknown>) => void }) {
  const validation = field.validation ?? {}
  const columns = Array.isArray(validation.columns) ? validation.columns.filter(isTableColumn) : []
  const update = (next: Partial<Record<'defaultRows' | 'minRows' | 'maxRows', number>> & { description?: string; columns?: TableColumn[] }) => onChange({ ...validation, ...next })
  const updateColumn = (index: number, next: TableColumn) => update({ columns: columns.map((column, current) => current === index ? next : column) })
  const addColumn = () => {
    let index = columns.length + 1
    let key = `column_${index}`
    while (columns.some((column) => column.key === key)) key = `column_${++index}`
    update({ columns: [...columns, { key, label: `列${index}`, type: 'text', required: false, validation: {}, summary: 'none' }] })
  }
  const moveColumn = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= columns.length) return
    const next = [...columns]
    ;[next[index], next[target]] = [next[target], next[index]]
    update({ columns: next })
  }

  return <section className="space-y-3 border-y border-v2-border py-4">
    <div><h3 className="text-sm font-semibold text-v2-fg">自定义表格</h3><p className="mt-1 text-xs text-v2-muted">设计固定列；执行人填写时可按规则增删或复制行。</p></div>
    <div className="space-y-1"><Label>表格说明</Label><Textarea disabled={disabled} rows={2} value={typeof validation.description === 'string' ? validation.description : ''} placeholder="例如：逐项填写本周已完成工作" onChange={(event) => update({ description: event.target.value })} /></div>
    <div className="grid grid-cols-3 gap-2">
      <NumberSetting label="默认行数" value={validation.defaultRows} disabled={disabled} onChange={(value) => update({ defaultRows: value })} />
      <NumberSetting label="最少行数" value={validation.minRows} disabled={disabled} onChange={(value) => update({ minRows: value })} />
      <NumberSetting label="最多行数" value={validation.maxRows} disabled={disabled} onChange={(value) => update({ maxRows: value })} />
    </div>
    <div className="space-y-3">
      {columns.map((column, index) => <TableColumnEditor key={index} column={column} index={index} total={columns.length} disabled={disabled} onChange={(next) => updateColumn(index, next)} onMove={(direction) => moveColumn(index, direction)} onRemove={() => update({ columns: columns.filter((_, current) => current !== index) })} />)}
    </div>
    <button type="button" disabled={disabled} onClick={addColumn} className="flex w-full items-center justify-center gap-1 rounded-v2-md border border-dashed border-v2-primary px-3 py-2 text-sm font-medium text-v2-primary hover:bg-v2-primary-soft disabled:opacity-50"><Plus className="h-4 w-4" />新增列</button>
  </section>
}

function TableColumnEditor({ column, index, total, disabled, onChange, onMove, onRemove }: { column: TableColumn; index: number; total: number; disabled: boolean; onChange: (column: TableColumn) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  const update = (next: Partial<TableColumn>) => onChange({ ...column, ...next })
  const validation = column.validation ?? {}
  const updateValidation = (next: Record<string, unknown>) => update({ validation: { ...validation, ...next } })
  const numeric = column.type === 'number'
  const attachment = column.type === 'file' || column.type === 'image'
  return <div className="space-y-3 rounded-v2-md border border-v2-border bg-v2-surface-soft p-3">
    <div className="flex items-center gap-2"><span className="w-5 text-xs text-v2-muted">{index + 1}</span><Input disabled={disabled} value={column.label} onChange={(event) => update({ label: event.target.value })} placeholder="中文表头" /><select disabled={disabled} value={column.type} onChange={(event) => update({ type: event.target.value as TableColumnType, validation: defaultColumnValidation(event.target.value as TableColumnType), summary: 'none' })} className="h-9 w-32 rounded-v2-md border border-v2-border bg-v2-surface px-2 text-sm">{TABLE_COLUMN_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button type="button" disabled={disabled || index === 0} title="上移" onClick={() => onMove(-1)} className="rounded p-1 text-v2-muted hover:bg-v2-surface"><ChevronUp className="h-4 w-4" /></button><button type="button" disabled={disabled || index === total - 1} title="下移" onClick={() => onMove(1)} className="rounded p-1 text-v2-muted hover:bg-v2-surface"><ChevronDown className="h-4 w-4" /></button><button type="button" disabled={disabled} title="删除列" onClick={onRemove} className="rounded p-1 text-v2-danger hover:bg-v2-danger-soft"><Trash2 className="h-4 w-4" /></button></div>
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><div className="space-y-1"><Label>列编码</Label><Input disabled={disabled} value={column.key} onChange={(event) => update({ key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} /></div><div className="mt-5 flex items-center gap-2"><Switch disabled={disabled || column.type === 'auto_number'} checked={column.required} onCheckedChange={(required) => update({ required })} /><Label>必填</Label></div></div>
    {column.type === 'auto_number' && <div className="grid grid-cols-2 gap-2"><NumberSetting label="起始值" value={validation.start} disabled={disabled} min={1} onChange={(start) => updateValidation({ start })} /><NumberSetting label="步长" value={validation.step} disabled={disabled} min={1} onChange={(step) => updateValidation({ step })} /></div>}
    {numeric && <div className="grid grid-cols-4 gap-2"><NumberSetting label="最小值" value={validation.min} disabled={disabled} step="any" onChange={(min) => updateValidation({ min })} /><NumberSetting label="最大值" value={validation.max} disabled={disabled} step="any" onChange={(max) => updateValidation({ max })} /><NumberSetting label="小数位" value={validation.scale} disabled={disabled} min={0} onChange={(scale) => updateValidation({ scale })} /><label className="space-y-1 text-xs"><span>汇总</span><select disabled={disabled} value={column.summary} onChange={(event) => update({ summary: event.target.value as TableColumn['summary'] })} className="h-9 w-full rounded-v2-md border border-v2-border bg-v2-surface px-2 text-sm"><option value="none">不汇总</option><option value="sum">合计</option><option value="avg">平均值</option><option value="min">最小值</option><option value="max">最大值</option></select></label></div>}
    {column.type !== 'auto_number' && <div className="flex items-center gap-2"><Switch disabled={disabled} checked={column.analyticsEnabled === true} onCheckedChange={(analyticsEnabled) => update({ analyticsEnabled })} /><Label>在任务统计中提供此列</Label></div>}
    {column.type === 'single_select' && <OptionEditor options={Array.isArray(validation.options) ? validation.options : []} disabled={disabled} onChange={(options) => updateValidation({ options })} />}
    {attachment && <div className="grid grid-cols-3 gap-2"><NumberSetting label="最少附件" value={validation.minCount} disabled={disabled} min={0} onChange={(minCount) => updateValidation({ minCount })} /><NumberSetting label="最多附件" value={validation.maxCount} disabled={disabled} min={0} onChange={(maxCount) => updateValidation({ maxCount })} /><NumberSetting label="单文件字节上限" value={validation.maxSize} disabled={disabled} min={0} onChange={(maxSize) => updateValidation({ maxSize })} /></div>}
  </div>
}

function NumberSetting({ label, value, disabled, min, step, onChange }: { label: string; value: unknown; disabled: boolean; min?: number; step?: string; onChange: (value: number) => void }) {
  return <label className="space-y-1 text-xs"><span>{label}</span><Input disabled={disabled} type="number" min={min} step={step} value={value == null ? '' : String(value)} onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))} /></label>
}

function OptionEditor({ options, disabled, onChange }: { options: unknown[]; disabled: boolean; onChange: (options: Array<{ value: string; label: string }>) => void }) {
  const normalized = options.filter((option): option is { value: string; label: string } => typeof option === 'object' && option !== null && 'value' in option && 'label' in option).map((option) => ({ value: String(option.value), label: String(option.label) }))
  return <div className="space-y-2"><div className="flex items-center justify-between"><Label>下拉选项</Label><button type="button" disabled={disabled} onClick={() => onChange([...normalized, { value: `option_${normalized.length + 1}`, label: `选项${normalized.length + 1}` }])} className="text-xs text-v2-primary">新增选项</button></div>{normalized.map((option, index) => <div key={`${option.value}:${index}`} className="flex gap-2"><Input disabled={disabled} value={option.label} onChange={(event) => onChange(normalized.map((item, current) => current === index ? { ...item, label: event.target.value } : item))} /><Input disabled={disabled} value={option.value} onChange={(event) => onChange(normalized.map((item, current) => current === index ? { ...item, value: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') } : item))} /><button type="button" disabled={disabled || normalized.length === 1} title="删除选项" onClick={() => onChange(normalized.filter((_, current) => current !== index))} className="text-v2-danger"><Trash2 className="h-4 w-4" /></button></div>)}</div>
}

function isTableColumn(value: unknown): value is TableColumn {
  return typeof value === 'object' && value !== null && 'key' in value && 'label' in value && 'type' in value
}

function defaultColumnValidation(type: TableColumnType): Record<string, unknown> {
  if (type === 'auto_number') return { start: 1, step: 1 }
  if (type === 'single_select') return { options: [{ value: 'option_1', label: '选项一' }] }
  return {}
}

function JsonEditor({ label, value, error, disabled, hint, onChange }: {
  label: string
  value: string
  error?: string
  disabled: boolean
  hint?: string
  onChange: (value: string) => void
}) {
  return (
    <section className="space-y-1">
      <Label>{label}</Label>
      <Textarea disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} rows={6} className="font-v2-mono text-xs" />
      {error ? <p className="text-xs text-v2-danger">{error}</p> : hint ? <p className="break-all text-[10px] text-v2-muted">{hint}</p> : null}
    </section>
  )
}
