'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { getApiErrorMessage } from '@/lib/api-error'
import type { CiModelSummary, CiAttributeResponse } from '@/types/cmdb-model'
import '@/design-system/figma-neutral/index.css'
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  DashboardFeedbackPage,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

interface GroupableAttrVO {
  fieldKey: string
  name: string
  fieldType: string
}

interface TwoDimCellVO {
  id: number
  name: string
  status: string
  owner: string
}

interface TwoDimGroupVO {
  groupValue: string
  instances: TwoDimCellVO[]
}

interface TwoDimensionViewVO {
  modelId: string
  modelName: string
  groupBy: string
  groups: TwoDimGroupVO[]
  groupableAttrs: GroupableAttrVO[]
}

const GROUPABLE_FIELD_TYPES = new Set(['singlechar', 'enum'])

function statusMeta(status: string): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  if (status === 'running') return { label: '运行中', tone: 'success' }
  if (status === 'stopped') return { label: '已停用', tone: 'neutral' }
  if (status === 'maintenance') return { label: '维护中', tone: 'warning' }
  return { label: status || '-', tone: 'neutral' }
}

export default function TwoDViewPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const [model, setModel] = useState('')
  const [groupBy, setGroupBy] = useState('')

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: models = [] } = useQuery<CiModelSummary[]>({
    queryKey: ['cmdb-models-all'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models', { params: { size: 100 } })
        return r.data.data.records
      } catch {
        return []
      }
    },
    enabled: typeof window !== 'undefined',
  })

  const selectedModel = models.find((item) => item.modelId === model)
  const { data: modelAttrs = [] } = useQuery<CiAttributeResponse[]>({
    queryKey: ['cmdb-model-attrs', selectedModel?.modelId],
    queryFn: () => api.get(`/cmdb/models/${selectedModel!.modelId}/attributes`).then((r) => r.data.data),
    enabled: !!selectedModel,
  })

  const groupableAttrs: GroupableAttrVO[] = modelAttrs
    .filter((a) => GROUPABLE_FIELD_TYPES.has(a.fieldType))
    .map((a) => ({ fieldKey: a.fieldKey, name: a.name, fieldType: a.fieldType }))

  const effectiveGroupBy = groupBy || groupableAttrs[0]?.fieldKey || ''

  const { data: viewData, isLoading, isError, error, refetch } = useQuery<TwoDimensionViewVO>({
    queryKey: ['cmdb-2d-view', model, effectiveGroupBy],
    queryFn: () => api.get('/cmdb/instances/2d-view', {
      params: { modelId: model, groupBy: effectiveGroupBy },
    }).then((r) => r.data.data),
    enabled: !!model && !!effectiveGroupBy,
  })

  const displayGroupableAttrs = viewData?.groupableAttrs ?? groupableAttrs

  const handleRefresh = () => {
    refetch()
    toast.success('已刷新')
  }

  return (
    <DashboardFeedbackPage className="cwgsyw-cmdb-page"
      header={
        <div className="cwgsyw-cmdb-instance-page">
        <PageHeader
            showEyebrow={false}
          title="2D 视图"
          subtitle="按字段分组查看实例"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/cmdb', label: 'CMDB' },
                { label: '2D 视图' },
              ]}
            />
          }
          actions={
            <Button type="button" variant="secondary" disabled={!model} onClick={handleRefresh}>
              刷新
            </Button>
          }
        />
        </div>
      }
      supporting={
        <div className="cwgsyw-inline-controls">
          <Select size="sm" overlay
            value={model}
            placeholder="选择模型"
            options={models.map((item) => ({ value: item.modelId, label: item.displayName ?? item.modelId }))}
            onChange={(value) => { setModel(value); setGroupBy('') }}
          />
          <Select size="sm" overlay
            value={groupBy}
            placeholder="选择分组字段"
            disabled={displayGroupableAttrs.length === 0}
            options={displayGroupableAttrs.map((item) => ({ value: item.fieldKey, label: item.name }))}
            onChange={setGroupBy}
          />
        </div>
      }
      feedback={
        !model ? (
          <EmptyState title="请选择一个模型以查看 2D 视图" />
        ) : isLoading ? (
          <LoadingState label="加载 2D 视图" />
        ) : isError ? (
          <ErrorState
            title="2D 视图加载失败"
            description={getApiErrorMessage(error, '加载失败，该模型可能未启用 2D 视图')}
            retry={<Button type="button" variant="secondary" onClick={handleRefresh}>重试</Button>}
          />
        ) : !viewData || viewData.groups.length === 0 ? (
          <EmptyState title="该模型下暂无实例数据" />
        ) : (
          <div className="cwgsyw-stack-list">
            {viewData.groups.map((group) => (
              <Card
                key={group.groupValue}
                title={group.groupValue}
                headerAction={<Badge label={`${group.instances.length} 个实例`} />}
              >
                <div className="cwgsyw-stack-list">
                  {group.instances.map((inst) => {
                    const meta = statusMeta(inst.status)
                    return (
                      <Link key={inst.id} href={`/cmdb/instances/by-model/${model}/${inst.id}`} className="cwgsyw-inline-controls">
                        <span className="cwgsyw-type-body-sm">{inst.name}</span>
                        <StatusBadge label={meta.label} status={meta.tone} />
                        {inst.owner ? <span className="cwgsyw-type-label-sm">{inst.owner}</span> : null}
                      </Link>
                    )
                  })}
                </div>
              </Card>
            ))}
          </div>
        )
      }
    />
  )
}
