'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Alert, Button, Field, Input, Select, Switch, Textarea } from '@/design-system/figma-neutral/components'
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
    return <aside className="cwgsyw-designer__pane cwgsyw-designer__panel"><p className="cwgsyw-type-body-sm">选择画布中的字段后配置属性</p></aside>
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
  const onToggle = (setter: (checked: boolean) => void) => (event: ChangeEvent<HTMLInputElement>) => setter(event.target.checked)

  return (
    <aside className="cwgsyw-designer__pane cwgsyw-designer__panel">
      <div className="cwgsyw-form">
        <div>
          <h2 className="cwgsyw-type-title-sm">字段配置</h2>
          <p className="cwgsyw-type-label-xs">{fieldType?.label ?? field.type}</p>
        </div>
        <Field label="标题">
          <Input disabled={readOnly} value={field.label} onChange={(event) => update('label', event.target.value)} />
        </Field>
        <Field label="字段编码">
          <Input disabled={readOnly || Boolean(field.id)} value={field.key} onChange={(event) => update('key', event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
        </Field>
        <Switch label="必填" disabled={readOnly} checked={field.required} onChange={onToggle((checked) => update('required', checked))} />
        <Switch label="敏感字段" disabled={readOnly || fieldType?.supportsSensitive === false} checked={field.sensitive} onChange={onToggle((checked) => update('sensitive', checked))} />
        {field.type === 'table' ? (
          <TableConfigEditor field={field} disabled={readOnly} onChange={(validation) => update('validation', validation)} />
        ) : (
          <JsonEditor label="校验配置" value={validationText} error={jsonErrors.validation} disabled={readOnly} onChange={(value) => updateJson('validation', value)} />
        )}
        <JsonEditor label="条件 AST" value={conditionText} error={jsonErrors.condition} disabled={readOnly} onChange={(value) => updateJson('condition', value)} hint='例：{"visibleWhen":{"op":"eq","left":{"field":"has_exception"},"right":{"literal":true}}}' />
        {(field.type === 'formula' || Object.keys(field.formula ?? {}).length > 0) ? (
          <JsonEditor label="公式 AST" value={formulaText} error={jsonErrors.formula} disabled={readOnly} onChange={(value) => updateJson('formula', value)} hint='例：{"op":"DIVIDE","args":[{"field":"normal"},{"field":"total"}],"scale":2}' />
        ) : null}
        <section className="cwgsyw-form">
          <div>
            <h3 className="cwgsyw-type-title-sm">统计语义</h3>
            <p className="cwgsyw-type-label-xs">按字段类型只显示合法聚合。</p>
          </div>
          <Switch label="启用统计" disabled={readOnly || field.sensitive || fieldType?.supportsAnalytics === false} checked={analytics.enabled === true} onChange={onToggle((checked) => update('analytics', { ...analytics, enabled: checked }))} />
          {analytics.enabled === true ? (
            <>
              <Field label="统计角色">
                <Select
                  disabled={readOnly}
                  value={String((analytics.role as string[] | undefined)?.[0] ?? 'metric')}
                  onChange={(value) => update('analytics', { ...analytics, role: [value] })}
                  options={[
                    { value: 'metric', label: '指标' },
                    ...(fieldType?.supportsDimension ? [{ value: 'dimension', label: '维度' }] : []),
                    { value: 'filter', label: '筛选' },
                    { value: 'detail', label: '明细' },
                  ]}
                />
              </Field>
              {aggregationOptions.length > 0 ? (
                <Field label="聚合方式">
                  <Select
                    disabled={readOnly}
                    value={String(analytics.aggregation ?? aggregationOptions[0])}
                    onChange={(value) => update('analytics', { ...analytics, aggregation: value })}
                    options={aggregationOptions.map((aggregation) => ({ value: aggregation, label: AGGREGATION_LABELS[aggregation] ?? aggregation }))}
                  />
                </Field>
              ) : null}
              <Field label="单位">
                <Input disabled={readOnly} value={String(analytics.unit ?? '')} onChange={(event) => update('analytics', { ...analytics, unit: event.target.value })} />
              </Field>
            </>
          ) : null}
          {field.sensitive ? (
            <Alert tone="warning" title="敏感字段限制" description="敏感字段强制禁止导出和生成统计事实。" showDismiss={false} />
          ) : null}
        </section>
      </div>
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

  return (
    <section className="cwgsyw-form">
      <div>
        <h3 className="cwgsyw-type-title-sm">自定义表格</h3>
        <p className="cwgsyw-type-label-xs">设计固定列；执行人填写时可按规则增删或复制行。</p>
      </div>
      <Field label="表格说明">
        <Textarea disabled={disabled} rows={2} value={typeof validation.description === 'string' ? validation.description : ''} placeholder="例如：逐项填写本周已完成工作" onChange={(event) => update({ description: event.target.value })} />
      </Field>
      <NumberSetting label="默认行数" value={validation.defaultRows} disabled={disabled} onChange={(value) => update({ defaultRows: value })} />
      <NumberSetting label="最少行数" value={validation.minRows} disabled={disabled} onChange={(value) => update({ minRows: value })} />
      <NumberSetting label="最多行数" value={validation.maxRows} disabled={disabled} onChange={(value) => update({ maxRows: value })} />
      {columns.map((column, index) => (
        <TableColumnEditor
          key={index}
          column={column}
          index={index}
          total={columns.length}
          disabled={disabled}
          onChange={(next) => updateColumn(index, next)}
          onMove={(direction) => moveColumn(index, direction)}
          onRemove={() => update({ columns: columns.filter((_, current) => current !== index) })}
        />
      ))}
      <Button type="button" variant="outline" disabled={disabled} onClick={addColumn}>新增列</Button>
    </section>
  )
}

function TableColumnEditor({ column, index, total, disabled, onChange, onMove, onRemove }: { column: TableColumn; index: number; total: number; disabled: boolean; onChange: (column: TableColumn) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  const update = (next: Partial<TableColumn>) => onChange({ ...column, ...next })
  const validation = column.validation ?? {}
  const updateValidation = (next: Record<string, unknown>) => update({ validation: { ...validation, ...next } })
  const numeric = column.type === 'number'
  const attachment = column.type === 'file' || column.type === 'image'
  return (
    <div className="cwgsyw-designer__table-col">
      <div className="cwgsyw-designer__inline">
        <span className="cwgsyw-type-label-xs">{index + 1}</span>
        <Input disabled={disabled} value={column.label} onChange={(event) => update({ label: event.target.value })} placeholder="中文表头" />
        <Select
          disabled={disabled}
          value={column.type}
          onChange={(value) => update({ type: value as TableColumnType, validation: defaultColumnValidation(value as TableColumnType), summary: 'none' })}
          options={TABLE_COLUMN_TYPES}
        />
        <Button type="button" variant="ghost" size="sm" disabled={disabled || index === 0} onClick={() => onMove(-1)}>上移</Button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled || index === total - 1} onClick={() => onMove(1)}>下移</Button>
        <Button type="button" variant="destructive" size="sm" disabled={disabled} onClick={onRemove}>删除列</Button>
      </div>
      <Field label="列编码">
        <Input disabled={disabled} value={column.key} onChange={(event) => update({ key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
      </Field>
      <Switch label="必填" disabled={disabled || column.type === 'auto_number'} checked={column.required} onChange={(event) => update({ required: event.target.checked })} />
      {column.type === 'auto_number' ? (
        <>
          <NumberSetting label="起始值" value={validation.start} disabled={disabled} min={1} onChange={(start) => updateValidation({ start })} />
          <NumberSetting label="步长" value={validation.step} disabled={disabled} min={1} onChange={(step) => updateValidation({ step })} />
        </>
      ) : null}
      {numeric ? (
        <>
          <NumberSetting label="最小值" value={validation.min} disabled={disabled} step="any" onChange={(min) => updateValidation({ min })} />
          <NumberSetting label="最大值" value={validation.max} disabled={disabled} step="any" onChange={(max) => updateValidation({ max })} />
          <NumberSetting label="小数位" value={validation.scale} disabled={disabled} min={0} onChange={(scale) => updateValidation({ scale })} />
          <Field label="汇总">
            <Select
              disabled={disabled}
              value={column.summary}
              onChange={(value) => update({ summary: value as TableColumn['summary'] })}
              options={[
                { value: 'none', label: '不汇总' },
                { value: 'sum', label: '合计' },
                { value: 'avg', label: '平均值' },
                { value: 'min', label: '最小值' },
                { value: 'max', label: '最大值' },
              ]}
            />
          </Field>
        </>
      ) : null}
      {column.type !== 'auto_number' ? (
        <Switch label="在任务统计中提供此列" disabled={disabled} checked={column.analyticsEnabled === true} onChange={(event) => update({ analyticsEnabled: event.target.checked })} />
      ) : null}
      {column.type === 'single_select' ? (
        <OptionEditor options={Array.isArray(validation.options) ? validation.options : []} disabled={disabled} onChange={(options) => updateValidation({ options })} />
      ) : null}
      {attachment ? (
        <>
          <NumberSetting label="最少附件" value={validation.minCount} disabled={disabled} min={0} onChange={(minCount) => updateValidation({ minCount })} />
          <NumberSetting label="最多附件" value={validation.maxCount} disabled={disabled} min={0} onChange={(maxCount) => updateValidation({ maxCount })} />
          <NumberSetting label="单文件字节上限" value={validation.maxSize} disabled={disabled} min={0} onChange={(maxSize) => updateValidation({ maxSize })} />
        </>
      ) : null}
    </div>
  )
}

function NumberSetting({ label, value, disabled, min, step, onChange }: { label: string; value: unknown; disabled: boolean; min?: number; step?: string; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <Input disabled={disabled} type="number" min={min} step={step} value={value == null ? '' : String(value)} onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))} />
    </Field>
  )
}

function OptionEditor({ options, disabled, onChange }: { options: unknown[]; disabled: boolean; onChange: (options: Array<{ value: string; label: string }>) => void }) {
  const normalized = options.filter((option): option is { value: string; label: string } => typeof option === 'object' && option !== null && 'value' in option && 'label' in option).map((option) => ({ value: String(option.value), label: String(option.label) }))
  return (
    <div className="cwgsyw-form">
      <div className="cwgsyw-designer__inline">
        <span className="cwgsyw-type-label-sm">下拉选项</span>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([...normalized, { value: `option_${normalized.length + 1}`, label: `选项${normalized.length + 1}` }])}>新增选项</Button>
      </div>
      {normalized.map((option, index) => (
        <div key={`${option.value}:${index}`} className="cwgsyw-designer__inline">
          <Input disabled={disabled} value={option.label} onChange={(event) => onChange(normalized.map((item, current) => current === index ? { ...item, label: event.target.value } : item))} />
          <Input disabled={disabled} value={option.value} onChange={(event) => onChange(normalized.map((item, current) => current === index ? { ...item, value: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') } : item))} />
          <Button type="button" variant="destructive" size="sm" disabled={disabled || normalized.length === 1} onClick={() => onChange(normalized.filter((_, current) => current !== index))}>删除</Button>
        </div>
      ))}
    </div>
  )
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
    <Field label={label} state={error ? 'error' : 'default'} errorText={error} showError={Boolean(error)} helperText={!error ? hint : undefined}>
      <Textarea disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} rows={6} />
    </Field>
  )
}
