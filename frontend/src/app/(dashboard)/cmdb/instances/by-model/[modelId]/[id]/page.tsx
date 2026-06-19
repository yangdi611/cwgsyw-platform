'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Activity, GitCompare } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { InstanceBasicInfoTab } from '@/components/cmdb/InstanceBasicInfoTab'
import { InstanceAssociationsTab } from '@/components/cmdb/InstanceAssociationsTab'
import { InstanceTopologyTab } from '@/components/cmdb/InstanceTopologyTab'
import { InstanceChangeHistoryTab } from '@/components/cmdb/InstanceChangeHistoryTab'
import { InstanceAlertsTab } from '@/components/cmdb/InstanceAlertsTab'
import { InstanceResourcesTab } from '@/components/cmdb/InstanceResourcesTab'

interface CiAttributeVO {
  id: number; fieldKey: string; name: string; fieldType: string
  isRequired: boolean; isEditable: boolean; option: unknown
  placeholder: string; unit: string; sortOrder: number; groupId: string
}
interface CiInstanceVO {
  id: number; modelId: string; name: string
  fieldsData: Record<string, unknown>
  fieldConfig: CiAttributeVO[]
  createdAt: string; updatedAt: string; createdByName: string
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
  const { modelId, id } = useParams<{ modelId: string; id: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('basic')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: inst, isLoading } = useQuery<CiInstanceVO>({
    queryKey: ['cmdb-instance', modelId, id],
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

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>
  if (!inst) return <p className="text-destructive">实例不存在</p>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/cmdb/instances/by-model/${modelId}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ArrowLeft className="h-4 w-4 mr-1" />返回列表
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{inst.name ?? `#${inst.id}`}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {inst.modelId} · 创建于 {new Date(inst.createdAt).toLocaleString('zh-CN')}
              {inst.createdByName && ` · ${inst.createdByName}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('cmdb_instance', 'impact') && (
            <Link href={`/cmdb/impact/${id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Activity className="h-4 w-4 mr-1" />影响分析
            </Link>
          )}
          {hasPermission('cmdb_instance', 'read') && (
            <Link href={'/cmdb/topology/' + id} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <GitCompare className="h-4 w-4 mr-1" />拓扑对比
            </Link>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'basic' && <InstanceBasicInfoTab modelId={modelId} inst={inst} />}
      {tab === 'associations' && <InstanceAssociationsTab modelId={modelId} id={id} />}
      {tab === 'topology' && <InstanceTopologyTab id={id} />}
      {tab === 'changes' && <InstanceChangeHistoryTab instanceId={id} />}
      {tab === 'alerts' && <InstanceAlertsTab instanceId={id} />}
      {tab === 'resources' && <InstanceResourcesTab instanceId={id} />}
    </div>
  )
}
