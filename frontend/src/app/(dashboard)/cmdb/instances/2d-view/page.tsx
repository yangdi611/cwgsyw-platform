'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { getApiErrorMessage, isAxiosError } from '@/lib/api-error'
import type { CiModelSummary, CiAttributeResponse } from '@/types/cmdb-model'
import '@/design-system/figma-neutral/index.css'
import {
  Badge,
  Button,
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

function statusMeta(status: string): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (status === 'running') return { label: '运行中', tone: 'success' }
  if (status === 'online') return { label: '在线', tone: 'success' }
  if (status === 'stopped') return { label: '已停用', tone: 'neutral' }
  if (status === 'maintenance') return { label: '维护中', tone: 'warning' }
  if (status === 'fault') return { label: '故障', tone: 'danger' }
  if (status === 'offline') return { label: '离线', tone: 'neutral' }
  return { label: status || '-', tone: 'neutral' }
}

function groupLabel(value: string) {
  return value === '__未分组__' ? '未分组' : value || '未分组'
}

export default function TwoDViewPage() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const [model, setModel] = useState('')
  const [groupBy, setGroupBy] = useState('')

  const canRead = isHydrated && hasPermission('cmdb_instance', 'read')

  useEffect(() => {
    if (!isHydrated) return
    if (!canRead) router.replace('/')
  }, [canRead, isHydrated, router])

  const {
    data: models = [],
    isLoading: isModelsLoading,
    isError: isModelsError,
    error: modelsError,
    refetch: refetchModels,
  } = useQuery<CiModelSummary[], unknown>({
    queryKey: ['cmdb-models-all'],
    queryFn: async () => {
      const response = await api.get('/cmdb/models', { params: { size: 100 } })
      return response.data.data.records
    },
    enabled: typeof window !== 'undefined' && canRead,
  })

  const selectedModel = models.find((item) => item.modelId === model)
  const {
    data: modelAttrs = [],
    isLoading: isAttrsLoading,
    isError: isAttrsError,
    error: attrsError,
    refetch: refetchAttrs,
  } = useQuery<CiAttributeResponse[], unknown>({
    queryKey: ['cmdb-model-attrs', selectedModel?.modelId],
    queryFn: () => api.get(`/cmdb/models/${selectedModel!.modelId}/attributes`).then((response) => response.data.data),
    enabled: canRead && !!selectedModel,
  })

  const groupableAttrs = useMemo<GroupableAttrVO[]>(() => modelAttrs
    .filter((attr) => GROUPABLE_FIELD_TYPES.has(attr.fieldType))
    .map((attr) => ({ fieldKey: attr.fieldKey, name: attr.name, fieldType: attr.fieldType })), [modelAttrs])

  const effectiveGroupBy = groupBy || groupableAttrs[0]?.fieldKey || ''

  const {
    data: viewData,
    isLoading: isViewLoading,
    isError: isViewError,
    error: viewError,
    refetch: refetchView,
    isFetching: isViewFetching,
  } = useQuery<TwoDimensionViewVO, unknown>({
    queryKey: ['cmdb-2d-view', model, effectiveGroupBy],
    queryFn: () => api.get('/cmdb/instances/2d-view', {
      params: { modelId: model, groupBy: effectiveGroupBy },
    }).then((response) => response.data.data),
    enabled: canRead && !!model && !!effectiveGroupBy,
    retry: (failureCount, error: unknown) => {
      if (isAxiosError(error) && [400, 403, 404].includes(error.response?.status ?? 0)) return false
      return failureCount < 2
    },
  })

  const displayGroupableAttrs = viewData?.groupableAttrs ?? groupableAttrs
  const selectedGroup = displayGroupableAttrs.find((item) => item.fieldKey === effectiveGroupBy)
  const totalInstances = viewData?.groups.reduce((total, group) => total + group.instances.length, 0) ?? 0
  const viewStatus = isAxiosError(viewError) ? viewError.response?.status : undefined

  const handleRefresh = async () => {
    const result = await refetchView()
    if (result.isSuccess) toast.success('已刷新')
  }

  const controls = (
    <div className="cwgsyw-cmdb-2d-view__controls">
      <Select
        aria-label="选择模型"
        size="sm"
        overlay
        loading={isModelsLoading}
        disabled={!canRead || isModelsError}
        value={model}
        placeholder="选择模型"
        options={models.map((item) => ({ value: item.modelId, label: item.displayName ?? item.name ?? item.modelId }))}
        onChange={(value) => {
          setModel(value)
          setGroupBy('')
        }}
      />
      <Select
        aria-label="选择分组字段"
        size="sm"
        overlay
        loading={isAttrsLoading}
        value={effectiveGroupBy}
        placeholder="选择分组字段"
        disabled={!canRead || !model || isAttrsError || displayGroupableAttrs.length === 0}
        options={displayGroupableAttrs.map((item) => ({ value: item.fieldKey, label: item.name }))}
        onChange={setGroupBy}
      />
    </div>
  )

  return (
    <DashboardFeedbackPage
      className="cwgsyw-cmdb-page cwgsyw-cmdb-2d-view"
      header={
        <div className="cwgsyw-cmdb-instance-page">
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="2D 视图"
            subtitle={viewData
              ? `${viewData.modelName} · 按${selectedGroup?.name ?? viewData.groupBy}分组 · ${viewData.groups.length} 组 / ${totalInstances} 个实例`
              : '按字段分组查看实例'}
            actions={
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!canRead || !model || !effectiveGroupBy || isViewFetching}
                onClick={() => void handleRefresh()}
              >
                刷新
              </Button>
            }
          />
        </div>
      }
      metrics={controls}
      feedback={
        !isHydrated ? (
          <div className="cwgsyw-cmdb-2d-view__state">
            <LoadingState label="准备 2D 视图" />
          </div>
        ) : !canRead ? (
          <div className="cwgsyw-cmdb-2d-view__state">
            <ErrorState
              title="无权查看 2D 视图"
              description="当前账号缺少 CMDB 实例读取权限。"
              showRetry={false}
            />
          </div>
        ) : isModelsLoading ? (
          <div className="cwgsyw-cmdb-2d-view__state">
            <LoadingState label="加载模型" />
          </div>
        ) : isModelsError ? (
          <div className="cwgsyw-cmdb-2d-view__state">
            <ErrorState
              title="模型加载失败"
              description={getApiErrorMessage(modelsError, '请稍后重试')}
              retry={<Button type="button" size="sm" variant="secondary" onClick={() => void refetchModels()}>重试</Button>}
            />
          </div>
        ) : models.length === 0 ? (
          <div className="cwgsyw-cmdb-2d-view__state">
            <EmptyState title="暂无可选模型" description="请先在模型管理中创建可用模型。" />
          </div>
        ) : !model ? (
          <div className="cwgsyw-cmdb-2d-view__state">
            <EmptyState title="请选择一个模型" description="选择模型和分组字段后查看实例分布。" />
          </div>
        ) : isAttrsLoading ? (
          <div className="cwgsyw-cmdb-2d-view__state">
            <LoadingState label="加载可分组字段" />
          </div>
        ) : isAttrsError ? (
          <div className="cwgsyw-cmdb-2d-view__state">
            <ErrorState
              title="分组字段加载失败"
              description={getApiErrorMessage(attrsError, '请稍后重试')}
              retry={<Button type="button" size="sm" variant="secondary" onClick={() => void refetchAttrs()}>重试</Button>}
            />
          </div>
        ) : displayGroupableAttrs.length === 0 ? (
          <div className="cwgsyw-cmdb-2d-view__state">
            <EmptyState title="暂无可分组字段" description="该模型没有字符串或枚举类型的分组字段。" />
          </div>
        ) : isViewLoading ? (
          <div className="cwgsyw-cmdb-2d-view__state">
            <LoadingState label="加载 2D 视图" />
          </div>
        ) : isViewError ? (
          <div className="cwgsyw-cmdb-2d-view__state">
            <ErrorState
              title="2D 视图加载失败"
              description={getApiErrorMessage(viewError, '加载失败，该模型可能未启用 2D 视图')}
              retry={viewStatus !== 403 ? <Button type="button" size="sm" variant="secondary" onClick={() => void handleRefresh()}>重试</Button> : null}
            />
          </div>
        ) : !viewData || viewData.groups.length === 0 ? (
          <div className="cwgsyw-cmdb-2d-view__state">
            <EmptyState title="暂无实例数据" description="当前模型和分组字段下没有可显示的实例。" />
          </div>
        ) : (
          <div className="cwgsyw-cmdb-2d-view__group-grid">
            {viewData.groups.map((group, index) => {
              const groupTitleId = `cmdb-2d-group-${index}`
              return (
                <section key={group.groupValue} className="cwgsyw-cmdb-2d-view__group" aria-labelledby={groupTitleId}>
                  <header>
                    <h2 id={groupTitleId}>{groupLabel(group.groupValue)}</h2>
                    <Badge label={`${group.instances.length} 个实例`} />
                  </header>
                  <div className="cwgsyw-cmdb-2d-view__instances">
                    {group.instances.map((instance) => {
                      const meta = statusMeta(instance.status)
                      return (
                        <Link
                          key={instance.id}
                          href={`/cmdb/instances/by-model/${model}/${instance.id}`}
                          className="cwgsyw-cmdb-2d-view__instance"
                        >
                          <span className="cwgsyw-cmdb-2d-view__instance-copy">
                            <span className="cwgsyw-cmdb-2d-view__instance-name">{instance.name}</span>
                            {instance.owner ? <span className="cwgsyw-cmdb-2d-view__instance-owner">负责人：{instance.owner}</span> : null}
                          </span>
                          <StatusBadge label={meta.label} status={meta.tone} />
                        </Link>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )
      }
    />
  )
}
