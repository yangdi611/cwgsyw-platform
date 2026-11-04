'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/lib/api-error'
import { sosReportApi, type SosCmdbDraft, type SosPreviewField } from '@/lib/sos-report-api'
import { REQUEST_STATUS, aiFields, aiNote, fieldSourceLabel, formatDateTime, formatValue, isEditableInDraft, overrideText, toOverrideValue } from '@/lib/sos-report-format'
import { usePermission } from '@/hooks/usePermission'
import { toast } from '@/design-system/figma-neutral/toast'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorState,
  Field,
  Input,
  LoadingState,
  NeutralTooltip,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

const ACTION_LABEL = { create: '新增实例', update: '更新实例', conflict: '存在冲突' } as const
const ACTION_TONE = { create: 'info', update: 'info', conflict: 'danger' } as const
const EMPTY_DRAFT: SosCmdbDraft = { overrides: {}, excludedFields: [] }

function ValueEditor({ field, text, disabled, onChange }: {
  field: SosPreviewField
  text: string
  disabled: boolean
  onChange: (text: string) => void
}) {
  const label = `填写 ${field.name}`
  if (field.fieldType === 'enum' || field.fieldType === 'bool') {
    const options = field.fieldType === 'bool'
      ? [{ value: 'true', label: '是' }, { value: 'false', label: '否' }]
      : (field.options ?? []).map((option) => ({ value: option.id, label: option.name }))
    return (
      <Select size="sm" aria-label={label} disabled={disabled} placeholder="未填写" value={text} options={options} onChange={onChange} />
    )
  }
  return <Input size="sm" aria-label={label} disabled={disabled} placeholder="未填写" value={text} onChange={(event) => onChange(event.target.value)} />
}

export function CmdbPanel({ reportId }: { reportId: string }) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const canSubmitPermission = hasPermission('sos_report', 'submit')

  const [instanceName, setInstanceName] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [excluded, setExcluded] = useState<string[]>([])
  const [applied, setApplied] = useState<SosCmdbDraft>(EMPTY_DRAFT)

  const preview = useQuery({
    queryKey: ['sos-report-cmdb-preview', reportId, applied],
    queryFn: () => sosReportApi.preview(reportId, applied),
    placeholderData: keepPreviousData,
  })

  const draft = useMemo<SosCmdbDraft>(() => {
    const fieldTypes = new Map((preview.data?.fields ?? []).map((field) => [field.fieldKey, field.fieldType]))
    const values: Record<string, unknown> = {}
    Object.entries(overrides).forEach(([key, text]) => {
      const value = toOverrideValue(fieldTypes.get(key) ?? 'singlechar', text)
      if (value !== undefined && value !== '') values[key] = value
    })
    return { instanceName: instanceName ?? undefined, overrides: values, excludedFields: excluded }
  }, [overrides, excluded, instanceName, preview.data])
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied)

  const applyDraft = () => {
    // 清空的输入框回到规则算出的值，不算人工填写。
    setOverrides((current) => Object.fromEntries(Object.entries(current).filter(([, text]) => text !== '')))
    setApplied(draft)
  }

  const requests = useQuery({
    queryKey: ['sos-report-cmdb-requests', reportId],
    queryFn: () => sosReportApi.requests(reportId),
  })

  const submit = useMutation({
    mutationFn: () => sosReportApi.submit(reportId, applied),
    onSuccess: () => {
      toast.success('已提交审批，通过后才会写入 CMDB')
      queryClient.invalidateQueries({ queryKey: ['sos-report-cmdb-preview', reportId] })
      queryClient.invalidateQueries({ queryKey: ['sos-report-cmdb-requests', reportId] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '提交失败')),
  })

  if (preview.isLoading) return <LoadingState label="正在和 CMDB 现有实例比对" />
  if (preview.isError || !preview.data) {
    return (
      <ErrorState
        description={getApiErrorMessage(preview.error, '无法生成入库预览')}
        retry={<Button type="button" variant="secondary" size="sm" onClick={() => preview.refetch()}>重试</Button>}
      />
    )
  }

  const data = preview.data
  const isUpdate = data.action === 'update'
  const visibleFields = data.fields.filter((field) => field.value != null || field.required || field.problem || field.origin !== 'none' || isEditableInDraft(field.fieldType))

  return (
    <div className="cwgsyw-sos-report__stack">
      <Card title="入库方式">
        <div className="cwgsyw-sos-report__stack">
          <div className="cwgsyw-inline-controls">
            <StatusBadge label={ACTION_LABEL[data.action]} status={ACTION_TONE[data.action]} />
            {data.targetInstanceId ? (
              <Link href={`/cmdb/instances/by-model/${data.modelCode}/${data.targetInstanceId}`}>
                {data.targetInstanceName}（#{data.targetInstanceId}）
              </Link>
            ) : null}
          </div>
          <Field label="实例名称" required>
            <Input
              size="sm"
              value={instanceName ?? data.instanceName ?? ''}
              disabled={!canSubmitPermission}
              onChange={(event) => setInstanceName(event.target.value)}
            />
          </Field>
        </div>
      </Card>

      {data.blockingReasons.map((reason) => (
        <Alert key={reason} tone="danger" showDismiss={false} title="暂时不能提交" description={reason} />
      ))}
      {aiFields(data.fields).length > 0 ? (
        <Alert
          tone="info"
          showDismiss={false}
          title={`${aiFields(data.fields).length} 个字段的映射规则来自 AI 建议`}
          description={`${aiFields(data.fields).map((field) => field.name).join('、')}。这些规则已由管理员确认，提交后审批人也会看到这一标注。`}
        />
      ) : null}
      {data.warnings.map((warning) => (
        <Alert key={warning} tone="warning" showDismiss={false} title="请注意" description={warning} />
      ))}
      {data.pendingMappingCount > 0 ? (
        <div><Link href="/sos-reports/mappings">前往配置字段映射规则</Link></div>
      ) : null}

      <Card title="字段值">
        <Table
          className="cwgsyw-cmdb-table"
          density="compact"
          showSearch={false}
          columns={[
            { key: 'name', label: '字段' },
            { key: 'value', label: isUpdate ? '报告值' : '待写入的值' },
            ...(isUpdate ? [{ key: 'current', label: 'CMDB 现有值' }] : []),
            { key: 'origin', label: '来源' },
            { key: 'note', label: '说明' },
            { key: 'include', label: '写入' },
          ]}
          rows={visibleFields.map((field) => {
            const editable = canSubmitPermission && isEditableInDraft(field.fieldType) && (!isUpdate || field.editable)
            const text = overrides[field.fieldKey] ?? overrideText(field.value)
            return {
              id: field.fieldKey,
              cells: {
                name: `${field.name}${field.required ? ' *' : ''}`,
                value: editable ? (
                  <ValueEditor
                    field={field}
                    text={text}
                    disabled={field.excluded}
                    onChange={(next) => setOverrides((current) => ({ ...current, [field.fieldKey]: next }))}
                  />
                ) : (
                  formatValue(field.value)
                ),
                current: formatValue(field.currentValue),
                origin: field.ruleSource === 'ai' ? (
                  <NeutralTooltip content={aiNote(field)}>
                    <span><Badge label="AI 建议" tone="info" /> {fieldSourceLabel(field)}</span>
                  </NeutralTooltip>
                ) : (
                  fieldSourceLabel(field)
                ),
                note: field.problem ?? (field.changed && isUpdate ? '将更新' : !isEditableInDraft(field.fieldType) ? '请在 CMDB 中维护' : '—'),
                include: (
                  <Checkbox
                    label={`写入 ${field.name}`}
                    showLabel={false}
                    disabled={!canSubmitPermission || field.required}
                    checked={!excluded.includes(field.fieldKey)}
                    onChange={(event) =>
                      setExcluded((current) =>
                        event.target.checked ? current.filter((key) => key !== field.fieldKey) : [...current, field.fieldKey])
                    }
                  />
                ),
              },
            }
          })}
          state="data"
        />
      </Card>

      {canSubmitPermission ? (
        <div className="cwgsyw-inline-controls">
          <Button type="button" variant="secondary" size="sm" disabled={!dirty} onClick={applyDraft}>
            应用修改并重新比对
          </Button>
          <Button
            type="button"
            size="sm"
            loading={submit.isPending}
            disabled={dirty || !data.canSubmit}
            onClick={() => submit.mutate()}
          >
            提交审批
          </Button>
          {dirty ? <span className="cwgsyw-type-body-sm">有未应用的修改，请先重新比对。</span> : null}
        </div>
      ) : null}

      <Card title="入库申请记录">
        <Table
          className="cwgsyw-cmdb-table"
          density="compact"
          showSearch={false}
          columns={[
            { key: 'instanceName', label: '实例' },
            { key: 'action', label: '方式' },
            { key: 'status', label: '状态' },
            { key: 'ai', label: 'AI 参与' },
            { key: 'submitter', label: '提交人' },
            { key: 'createdAt', label: '提交时间' },
            { key: 'result', label: '结果' },
          ]}
          rows={(requests.data ?? []).map((request) => ({
            id: String(request.id),
            cells: {
              instanceName: request.instanceName,
              action: request.action === 'create' ? '新增' : '更新',
              status: <StatusBadge label={REQUEST_STATUS[request.status].label} status={REQUEST_STATUS[request.status].tone} />,
              ai: aiFields(request.fieldDetails).length > 0 ? `${aiFields(request.fieldDetails).length} 个字段` : '无',
              submitter: request.submitterName ?? '—',
              createdAt: formatDateTime(request.createdAt),
              result: request.resultInstanceId ? (
                <Link href={`/cmdb/instances/by-model/${data.modelCode}/${request.resultInstanceId}`}>查看实例 #{request.resultInstanceId}</Link>
              ) : (
                request.failureMessage ?? request.decisionComment ?? '—'
              ),
            },
          }))}
          state={requests.isLoading ? 'loading' : (requests.data ?? []).length === 0 ? 'empty' : 'data'}
          empty="还没有入库申请"
        />
      </Card>
    </div>
  )
}
