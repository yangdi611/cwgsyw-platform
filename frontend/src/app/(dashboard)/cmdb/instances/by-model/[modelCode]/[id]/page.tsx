'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import { InstanceBasicInfoTab } from '@/components/cmdb/InstanceBasicInfoTab'
import { InstanceAssociationsTab } from '@/components/cmdb/InstanceAssociationsTab'
import { InstanceTopologyTab } from '@/components/cmdb/InstanceTopologyTab'
import { InstanceChangeHistoryTab } from '@/components/cmdb/InstanceChangeHistoryTab'
import { InstanceAlertsTab } from '@/components/cmdb/InstanceAlertsTab'
import { InstanceResourcesTab } from '@/components/cmdb/InstanceResourcesTab'
import { ResourcePoolCapacityCard } from '@/components/cmdb/ResourcePoolCapacityCard'
import { RackElevationView } from '@/components/cmdb/RackElevationView'
import { RackAssignmentCard } from '@/components/cmdb/RackAssignmentCard'
import { EndpointLinksCard } from '@/components/cmdb/EndpointLinksCard'
import { getApiErrorMessage, isAxiosError } from '@/lib/api-error'
import type { CiAttributeResponse, CmdbFieldsData } from '@/types/cmdb-model'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DetailDrawerPage,
  ErrorState,
  Icon,
  LoadingState,
  Tabs,
} from '@/design-system/figma-neutral/components'

interface CiInstanceVO {
  id: number
  modelId: string
  modelCode?: string
  displayName?: string
  name: string
  fieldsData: CmdbFieldsData
  fieldConfig: CiAttributeResponse[]
  attributes: CiAttributeResponse[]
  createdAt: string
  updatedAt: string
  createdByName: string
}

const BASE_TABS = [
  { key: 'basic', label: '基本信息' },
  { key: 'rack', label: '机柜视图' },
  { key: 'associations', label: '关联关系' },
  { key: 'topology', label: '拓扑图' },
  { key: 'changes', label: '变更历史' },
  { key: 'alerts', label: '告警' },
  { key: 'resources', label: '关联资源' },
] as const
type TabKey = (typeof BASE_TABS)[number]['key']

export default function InstanceDetailPage() {
  const { modelCode, id } = useParams<{ modelCode: string; id: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('basic')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: inst, isLoading, isError, error, refetch } = useQuery<CiInstanceVO, unknown>({
    queryKey: ['cmdb-instance', modelCode, id],
    queryFn: async () => {
      const r = await api.get(`/cmdb/instances/${id}`)
      return r.data.data
    },
    enabled: typeof window !== 'undefined',
    retry: (failureCount, err: unknown) => {
      if (isAxiosError(err) && err.response?.status === 404) return false
      return failureCount < 2
    },
  })

  useBreadcrumbLabel(inst?.name ?? inst?.displayName)

  if (isLoading) return <LoadingState label="加载实例" />
  if (isError) {
    const status = isAxiosError(error) ? error.response?.status : undefined
    if (status === 404) return <ErrorState title="实例不存在" description="无法找到该实例。" showRetry={false} />
    return (
      <ErrorState
        title="加载实例失败"
        description={`${status ? `（${status}）` : ''}${getApiErrorMessage(error, '未知错误')}`}
        retry={<Button type="button" variant="secondary" onClick={() => void refetch()}>重试</Button>}
      />
    )
  }
  if (!inst) return <ErrorState title="实例不存在" description="无法找到该实例。" showRetry={false} />

  const isRack = inst.modelId === 'rack'
  const tabs = BASE_TABS.filter((item) => (item.key !== 'rack' || isRack)
    && (item.key !== 'topology' || hasPermission('cmdb_topology', 'read')))

  const renderPanel = (key: TabKey) => {
    if (tab !== key) return null
    if (key === 'basic') {
      return (
        <div className="cwgsyw-cmdb-instance-detail__basic">
          {inst.modelId === 'resource_pool' && <ResourcePoolCapacityCard fieldsData={inst.fieldsData ?? {}} />}
          {!isRack && <RackAssignmentCard instanceId={id} />}
          {!isRack && <EndpointLinksCard instanceId={id} />}
          <InstanceBasicInfoTab modelCode={modelCode} inst={inst} />
        </div>
      )
    }
    if (key === 'rack' && isRack) return <RackElevationView rackId={id} />
    if (key === 'associations') return <InstanceAssociationsTab modelCode={modelCode} id={id} />
    if (key === 'topology') return <InstanceTopologyTab id={id} />
    if (key === 'changes') return <InstanceChangeHistoryTab instanceId={id} />
    if (key === 'alerts') return <InstanceAlertsTab instanceId={id} />
    if (key === 'resources') return <InstanceResourcesTab instanceId={id} />
    return null
  }

  return (
    <DetailDrawerPage
      className="cwgsyw-cmdb-page cwgsyw-cmdb-instance-detail"
      embedded
      header={
        <header className="cwgsyw-cmdb-instance-detail__header">
          <div className="cwgsyw-cmdb-instance-detail__identity">
            <div className="cwgsyw-cmdb-overview__catalog-title">
              <h1>{inst.name ?? `#${inst.id}`}</h1>
              <span className="cwgsyw-cmdb-overview__catalog-note">
                <Icon name="chevron-next" size="sm" aria-hidden="true" />
                <span>{modelCode} · #{inst.id}</span>
                <Icon name="chevron-previous" size="sm" aria-hidden="true" />
              </span>
            </div>
            <p>
              创建于 {new Date(inst.createdAt).toLocaleString('zh-CN')}
              {inst.createdByName ? ` · ${inst.createdByName}` : ''}
            </p>
          </div>
          <div className="cwgsyw-inline-controls cwgsyw-cmdb-instance-detail__actions">
              {hasPermission('cmdb_impact', 'read') && (
                <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/impact/${id}`)}>
                  影响分析
                </Button>
              )}
              {hasPermission('cmdb_topology', 'read') && (
                <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/topology/${id}/compare`)}>
                  拓扑对比
                </Button>
              )}
          </div>
        </header>
      }
      content={
        <Tabs
          style="cmdb"
          size="sm"
          value={tab}
          onChange={(next) => setTab(next as TabKey)}
          items={tabs.map((item) => ({
            id: item.key,
            label: item.label,
            panel: <div className="cwgsyw-cmdb-instance-detail__panel">{renderPanel(item.key)}</div>,
          }))}
        />
      }
    />
  )
}
