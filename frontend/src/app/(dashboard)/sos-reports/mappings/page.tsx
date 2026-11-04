'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/lib/api-error'
import { sosReportApi, type SosFieldMapping } from '@/lib/sos-report-api'
import { AI_VERDICT_LABEL, MAPPING_STATE } from '@/lib/sos-report-format'
import { usePermission } from '@/hooks/usePermission'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import {
  Alert,
  Button,
  DataManagementPage,
  ErrorState,
  PageHeader,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'
import { MappingDialog } from './MappingDialog'

export default function SosMappingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission, isHydrated } = usePermission()
  const canRead = hasPermission('sos_report', 'read')
  const canManage = hasPermission('sos_report', 'manage_mapping')
  const [editing, setEditing] = useState<SosFieldMapping | null>(null)
  const [rejected, setRejected] = useState<{ fieldKey: string; reason: string }[]>([])

  useEffect(() => {
    if (isHydrated && !canRead) router.replace('/')
  }, [isHydrated, canRead, router])

  const overview = useQuery({ queryKey: ['sos-report-mappings'], queryFn: sosReportApi.mappings, enabled: canRead })
  const catalog = useQuery({ queryKey: ['sos-report-fact-catalog'], queryFn: sosReportApi.catalog, enabled: canRead })

  const suggest = useMutation({
    mutationFn: sosReportApi.suggest,
    onSuccess: (result) => {
      setRejected(result.rejected)
      queryClient.invalidateQueries({ queryKey: ['sos-report-mappings'] })
      const summary = `AI 给出 ${result.suggested} 条建议，${result.ambiguous} 个字段有歧义，${result.unmappable} 个字段报告中没有`
      toast.success(result.remaining > 0 ? `${summary}。还有 ${result.remaining} 个字段，可再次生成。` : `${summary}。请逐条确认。`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'AI 建议生成失败，手动配置不受影响')),
  })

  const data = overview.data
  const rows = data?.fields ?? []

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-sos-report"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="字段映射规则"
            subtitle="决定报告里的哪项数据写入 CMDB 主机模型的哪个字段。内置字段使用预置规则；新增字段需要配置，AI 只提供建议，确认后才生效。"
            actions={
              canManage ? (
                <Button
                  type="button"
                  size="sm"
                  loading={suggest.isPending}
                  disabled={!data?.aiAvailable}
                  onClick={() => suggest.mutate()}
                >
                  AI 生成建议
                </Button>
              ) : null
            }
          />
        }
        content={
          <div className="cwgsyw-sos-report__stack">
            {data && canManage && !data.aiAvailable ? (
              <Alert tone="info" showDismiss={false} title="AI 服务未启用" description="可以手动配置规则。需要 AI 建议时，请在系统配置中启用 AI 提供商。" />
            ) : null}
            {data && canManage && data.aiAvailable ? (
              <Alert tone="info" showDismiss={false} title="发给 AI 的内容" description="只发送字段定义（字段名、类型、选项）和事实目录，不发送任何主机的数据。" />
            ) : null}
            {data && data.pendingCount > 0 ? (
              <Alert tone="warning" showDismiss={false} title="有待处理的字段" description={`${data.pendingCount} 个字段还没有生效的规则，这些字段入库时需要人工填写。`} />
            ) : null}
            {rejected.length > 0 ? (
              <Alert
                tone="warning"
                title={`${rejected.length} 条 AI 建议未通过校验，已丢弃`}
                description={rejected.map((item) => `${item.fieldKey}：${item.reason}`).join('；')}
                onDismiss={() => setRejected([])}
              />
            ) : null}
            {overview.isError ? (
              <ErrorState
                description={getApiErrorMessage(overview.error, '无法加载映射规则')}
                retry={<Button type="button" variant="secondary" size="sm" onClick={() => overview.refetch()}>重试</Button>}
              />
            ) : (
              <Table
                className="cwgsyw-cmdb-table"
                density="compact"
                showSearch={false}
                columns={[
                  { key: 'field', label: '字段' },
                  { key: 'type', label: '类型' },
                  { key: 'state', label: '状态' },
                  { key: 'fact', label: '来源事实' },
                  { key: 'transform', label: '转换' },
                  { key: 'ai', label: 'AI 判断' },
                  { key: 'actions', label: <span className="cwgsyw-sr-only">操作</span>, align: 'right' },
                ]}
                rows={rows.map((field) => {
                  const state = MAPPING_STATE[field.state]
                  const editable = canManage && field.state !== 'preset' && field.supported
                  return {
                    id: field.fieldKey,
                    cells: {
                      field: `${field.name}（${field.fieldKey}）${field.unique ? ' · 唯一' : ''}`,
                      type: field.fieldType,
                      state: <StatusBadge label={state.label} status={state.tone} />,
                      fact: field.factLabel ?? '—',
                      transform: field.transform ?? '—',
                      ai: field.aiVerdict
                        ? `${AI_VERDICT_LABEL[field.aiVerdict]}${field.aiConfidence != null ? `（${Math.round(field.aiConfidence * 100)}%）` : ''}${field.aiReason ? `：${field.aiReason}` : ''}`
                        : '—',
                      actions: editable ? (
                        <Button type="button" variant="ghost" size="sm" aria-label={`配置 ${field.name}`} onClick={() => setEditing(field)}>
                          {field.state === 'suggested' ? '审核' : '配置'}
                        </Button>
                      ) : null,
                    },
                  }
                })}
                state={overview.isLoading ? 'loading' : rows.length === 0 ? 'empty' : 'data'}
                empty="主机模型没有字段"
              />
            )}
          </div>
        }
      />
      {editing && catalog.data ? (
        <MappingDialog field={editing} catalog={catalog.data} onClose={() => setEditing(null)} />
      ) : null}
    </>
  )
}
