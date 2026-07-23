'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Switch } from '@/components/v2/Switch'
import { Textarea } from '@/components/v2/Textarea'
import type { FieldTypeMetadata, TaskFieldDefinition } from '@/lib/task-template-api'
import { formatJson, parseJsonObject } from './designer-utils'

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

      <JsonEditor label="校验配置" value={validationText} error={jsonErrors.validation} disabled={readOnly} onChange={(value) => updateJson('validation', value)} />
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
            {aggregationOptions.length > 0 && <div className="space-y-1"><Label>聚合方式</Label><select disabled={readOnly} value={String(analytics.aggregation ?? aggregationOptions[0])} onChange={(event) => update('analytics', { ...analytics, aggregation: event.target.value })} className="h-9 w-full rounded-v2-md border border-v2-border bg-v2-surface px-3 text-sm">{aggregationOptions.map((aggregation) => <option key={aggregation} value={aggregation}>{aggregation}</option>)}</select></div>}
            <div className="space-y-1"><Label>单位</Label><Input disabled={readOnly} value={String(analytics.unit ?? '')} onChange={(event) => update('analytics', { ...analytics, unit: event.target.value })} /></div>
          </>
        )}
        {field.sensitive && <p className="flex gap-2 rounded-v2-md bg-v2-warning-soft p-2 text-xs text-v2-warning"><AlertCircle className="h-4 w-4 shrink-0" />敏感字段强制禁止导出和生成统计事实。</p>}
      </section>
    </aside>
  )
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
