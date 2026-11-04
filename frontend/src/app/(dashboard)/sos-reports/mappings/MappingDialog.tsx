'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/lib/api-error'
import { sosReportApi, type SaveSosMapping, type SosFactCatalog, type SosFieldMapping } from '@/lib/sos-report-api'
import { AI_VERDICT_LABEL, enumRowsToMap } from '@/lib/sos-report-format'
import { toast } from '@/design-system/figma-neutral/toast'
import { Alert, Button, Field, Input, NeutralDialog, Select } from '@/design-system/figma-neutral/components'

export function MappingDialog({ field, catalog, onClose }: {
  field: SosFieldMapping
  catalog: SosFactCatalog
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const isEnum = field.fieldType === 'enum'
  const [factKey, setFactKey] = useState(field.factKey ?? '')
  const [transform, setTransform] = useState(field.transform ?? (isEnum ? 'enum_map' : 'direct'))
  const [enumRows, setEnumRows] = useState(() => {
    const entries = Object.entries(field.transformArgs?.map ?? {})
    return entries.length > 0
      ? entries.map(([source, target]) => ({ source, target }))
      : [{ source: '', target: '' }]
  })

  const done = (message: string) => {
    toast.success(message)
    queryClient.invalidateQueries({ queryKey: ['sos-report-mappings'] })
    queryClient.invalidateQueries({ queryKey: ['sos-report-cmdb-preview'] })
    onClose()
  }
  const failed = (error: unknown) => toast.error(getApiErrorMessage(error, '保存失败'))

  const save = useMutation({
    mutationFn: (body: SaveSosMapping) => sosReportApi.saveMapping(field.fieldKey, body),
    onSuccess: (_, body) => done(body.status === 'confirmed' ? '规则已确认并生效' : '已标记为无法映射'),
    onError: failed,
  })
  const remove = useMutation({
    mutationFn: () => sosReportApi.removeMapping(field.fieldKey),
    onSuccess: () => done('规则已移除'),
    onError: failed,
  })

  const confirm = () => {
    const usesEnum = transform === 'enum_map'
    save.mutate({
      status: 'confirmed',
      factKey,
      transform,
      ...(usesEnum ? { transformArgs: { map: enumRowsToMap(enumRows) } } : {}),
    })
  }
  const busy = save.isPending || remove.isPending
  const hasRow = ['confirmed', 'stale', 'suggested', 'unmappable'].includes(field.state)

  return (
    <NeutralDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`配置字段：${field.name}`}
      description={`${field.fieldKey} · ${field.fieldType}`}
      size="md"
      footer={
        <div className="cwgsyw-form__actions">
          {hasRow ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => remove.mutate()}>
              移除规则
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => save.mutate({ status: 'unmappable' })}>
            标记无法映射
          </Button>
          <Button type="button" size="sm" loading={save.isPending} disabled={busy || !factKey || !transform} onClick={confirm}>
            确认规则
          </Button>
        </div>
      }
    >
      <div className="cwgsyw-sos-report__stack">
        {field.aiVerdict ? (
          <Alert
            tone="info"
            showDismiss={false}
            title={`AI 判断：${AI_VERDICT_LABEL[field.aiVerdict]}${field.aiConfidence != null ? `，置信度 ${Math.round(field.aiConfidence * 100)}%` : ''}`}
            description={field.aiReason || 'AI 没有给出理由。'}
          />
        ) : null}
        {field.unique ? (
          <Alert tone="warning" showDismiss={false} title="这是唯一字段" description="映射错误会影响查重，也可能让入库失败，请仔细核对。" />
        ) : null}
        {field.state === 'stale' ? (
          <Alert tone="warning" showDismiss={false} title="规则已失效" description="字段类型或选项发生了变化，请重新确认。" />
        ) : null}
        <Field label="来源事实" required>
          <Select
            size="sm"
            placeholder="请选择事实"
            value={factKey}
            options={catalog.facts.map((fact) => ({
              value: fact.key,
              label: `${fact.label}${fact.unit ? `（${fact.unit}）` : ''} · ${fact.key}`,
            }))}
            onChange={setFactKey}
          />
        </Field>
        <Field label="转换方式" required>
          <Select
            size="sm"
            value={transform}
            options={catalog.transforms.map((item) => ({ value: item.code, label: item.label }))}
            onChange={setTransform}
          />
        </Field>
        {transform === 'enum_map' ? (
          <div className="cwgsyw-sos-report__stack">
            <div className="cwgsyw-type-label-xs">报告值与字段选项的对应关系</div>
            {enumRows.map((row, index) => (
              <div key={index} className="cwgsyw-inline-controls">
                <Input
                  size="sm"
                  aria-label={`第 ${index + 1} 行报告值`}
                  placeholder="报告中的值"
                  value={row.source}
                  onChange={(event) =>
                    setEnumRows((rows) => rows.map((item, i) => (i === index ? { ...item, source: event.target.value } : item)))
                  }
                />
                <Select
                  size="sm"
                  aria-label={`第 ${index + 1} 行字段选项`}
                  placeholder="字段选项"
                  value={row.target}
                  options={(field.options ?? []).map((option) => ({ value: option.id, label: option.name }))}
                  onChange={(target) =>
                    setEnumRows((rows) => rows.map((item, i) => (i === index ? { ...item, target } : item)))
                  }
                />
              </div>
            ))}
            <div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEnumRows((rows) => [...rows, { source: '', target: '' }])}>
                添加一行
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </NeutralDialog>
  )
}
