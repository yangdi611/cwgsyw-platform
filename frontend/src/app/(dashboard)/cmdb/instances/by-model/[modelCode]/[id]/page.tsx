'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import Link from 'next/link'
import { Activity, GitCompare } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { getApiErrorMessage, isAxiosError } from '@/lib/api-error'
import { DetailHeader, PageShell } from '@/components/shared'
import type { CiAttributeResponse, CmdbFieldsData } from '@/types/cmdb-model'

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
      // 404 视为实例真不存在，不重试；其余（超时/5xx/网络）重试 2 次
      if (isAxiosError(err) && err.response?.status === 404) return false
      return failureCount < 2
    },
  })

  useBreadcrumbLabel(inst?.name ?? inst?.displayName)

  if (isLoading) return <p className="text-v2-muted">加载中…</p>
  if (isError) {
    const status = isAxiosError(error) ? error.response?.status : undefined
    if (status === 404) return <p className="text-v2-danger">实例不存在</p>
    const msg = getApiErrorMessage(error, '未知错误')
    return (
      <div className="space-y-3">
        <p className="text-v2-danger">加载实例失败{status ? `（${status}）` : ''}：{msg}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-md border border-v2-border px-3 py-1.5 text-sm hover:bg-v2-surface-soft"
        >
          重试
        </button>
      </div>
    )
  }
  if (!inst) return <p className="text-v2-danger">实例不存在</p>

  const isRack = inst.modelId === 'rack'
  const tabs = BASE_TABS.filter((t) => (t.key !== 'rack' || isRack)
    && (t.key !== 'topology' || hasPermission('cmdb_topology', 'read')))

  return (
    <PageShell width="wide" density="comfortable">
      <DetailHeader
        backHref={`/cmdb/instances/by-model/${modelCode}`}
        title={inst.name ?? `#${inst.id}`}
        eyebrow={inst.modelId}
        meta={
          <>
            <span>创建于 {new Date(inst.createdAt).toLocaleString('zh-CN')}</span>
            {inst.createdByName && <span>{inst.createdByName}</span>}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {hasPermission('cmdb_impact', 'read') && (
              <Link
                href={`/cmdb/impact/${id}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md border border-v2-border bg-v2-surface text-v2-fg text-sm font-semibold shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
              >
                <Activity className="h-4 w-4" />
                影响分析
              </Link>
            )}
            {hasPermission('cmdb_topology', 'read') && (
              <Link
                href={`/cmdb/topology/${id}/compare`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md border border-v2-border bg-v2-surface text-v2-fg text-sm font-semibold shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
              >
                <GitCompare className="h-4 w-4" />
                拓扑对比
              </Link>
            )}
          </div>
        }
      />

      {/* Tab navigation */}
      <div className="flex flex-wrap items-center gap-1 border-b border-v2-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors',
              tab === t.key
                ? 'border-v2-primary text-v2-primary'
                : 'border-transparent text-v2-muted hover:text-v2-fg',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {tab === 'basic' && (
          <>
            {inst.modelId === 'resource_pool' && (
              <ResourcePoolCapacityCard fieldsData={inst.fieldsData ?? {}} />
            )}
            {!isRack && <RackAssignmentCard instanceId={id} />}
            {!isRack && <EndpointLinksCard instanceId={id} />}
            <InstanceBasicInfoTab modelCode={modelCode} inst={inst} />
          </>
        )}
        {tab === 'rack' && isRack && <RackElevationView rackId={id} />}
        {tab === 'associations' && <InstanceAssociationsTab modelCode={modelCode} id={id} />}
        {tab === 'topology' && <InstanceTopologyTab id={id} />}
        {tab === 'changes' && <InstanceChangeHistoryTab instanceId={id} />}
        {tab === 'alerts' && <InstanceAlertsTab instanceId={id} />}
        {tab === 'resources' && <InstanceResourcesTab instanceId={id} />}
      </div>
    </PageShell>
  )
}
