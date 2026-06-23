'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import Link from 'next/link'
import { ArrowLeft, Activity, GitCompare } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { InstanceBasicInfoTab } from '@/components/cmdb/InstanceBasicInfoTab'
import { InstanceAssociationsTab } from '@/components/cmdb/InstanceAssociationsTab'
import { InstanceTopologyTab } from '@/components/cmdb/InstanceTopologyTab'
import { InstanceChangeHistoryTab } from '@/components/cmdb/InstanceChangeHistoryTab'
import { InstanceAlertsTab } from '@/components/cmdb/InstanceAlertsTab'
import { InstanceResourcesTab } from '@/components/cmdb/InstanceResourcesTab'
import { ResourcePoolCapacityCard } from '@/components/cmdb/ResourcePoolCapacityCard'
import { cn } from '@/lib/utils'

interface CiAttributeVO {
  id: number
  fieldKey: string
  name: string
  fieldType: string
  isRequired: boolean
  isEditable: boolean
  option: { id: string; name: string; isDefault?: boolean }[] | null
  placeholder: string
  unit: string
  sortOrder: number
  groupId: string
}
interface CiInstanceVO {
  id: number
  modelId: string
  modelCode?: string
  displayName?: string
  name: string
  fieldsData: Record<string, unknown>
  fieldConfig: CiAttributeVO[]
  attributes: CiAttributeVO[]
  createdAt: string
  updatedAt: string
  createdByName: string
}

const TABS = [
  { key: 'basic', label: '基本信息' },
  { key: 'associations', label: '关联关系' },
  { key: 'topology', label: '拓扑图' },
  { key: 'changes', label: '变更历史' },
  { key: 'alerts', label: '告警' },
  { key: 'resources', label: '关联资源' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function InstanceDetailPage() {
  const { modelCode, id } = useParams<{ modelCode: string; id: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('basic')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: inst, isLoading } = useQuery<CiInstanceVO>({
    queryKey: ['cmdb-instance', modelCode, id],
    queryFn: async () => {
      try {
        const r = await api.get(`/cmdb/instances/${id}`)
        return r.data.data
      } catch {
        return undefined
      }
    },
    enabled: typeof window !== 'undefined',
  })

  if (isLoading) return <p className="text-v2-muted">加载中…</p>
  if (!inst) return <p className="text-v2-danger">实例不存在</p>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-v2-border bg-v2-surface-soft px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              href={`/cmdb/instances/by-model/${modelCode}`}
              className="mt-1 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-v2-fg">{inst.name ?? `#${inst.id}`}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-v2-muted">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-v2-border bg-v2-surface font-v2-mono text-v2-fg">
                  {inst.modelId}
                </span>
                <span>·</span>
                <span>创建于 {new Date(inst.createdAt).toLocaleString('zh-CN')}</span>
                {inst.createdByName && (<><span>·</span><span>{inst.createdByName}</span></>)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasPermission('cmdb_instance', 'impact') && (
              <Link
                href={`/cmdb/impact/${id}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md border border-v2-border bg-v2-surface text-v2-fg text-sm font-semibold shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
              >
                <Activity className="h-4 w-4" />
                影响分析
              </Link>
            )}
            {hasPermission('cmdb_instance', 'read') && (
              <Link
                href={`/cmdb/topology/${id}/compare`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md border border-v2-border bg-v2-surface text-v2-fg text-sm font-semibold shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
              >
                <GitCompare className="h-4 w-4" />
                拓扑对比
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap items-center gap-1 border-b border-v2-border">
        {TABS.map((t) => (
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
            <InstanceBasicInfoTab modelCode={modelCode} inst={inst} />
          </>
        )}
        {tab === 'associations' && <InstanceAssociationsTab modelCode={modelCode} id={id} />}
        {tab === 'topology' && <InstanceTopologyTab id={id} />}
        {tab === 'changes' && <InstanceChangeHistoryTab instanceId={id} />}
        {tab === 'alerts' && <InstanceAlertsTab instanceId={id} />}
        {tab === 'resources' && <InstanceResourcesTab instanceId={id} />}
      </div>
    </div>
  )
}
