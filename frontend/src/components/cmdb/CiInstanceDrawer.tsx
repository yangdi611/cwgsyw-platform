'use client'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { DetailDrawer } from '@/components/shared/DetailDrawer'
import { Button } from '@/components/v2/Button'
import { GitBranch, FileText, ArrowRight } from 'lucide-react'

interface Props {
  instanceId: number | null
  onClose: () => void
}

export function CiInstanceDrawer({ instanceId, onClose }: Props) {
  const router = useRouter()

  const { data: inst } = useQuery({
    queryKey: ['cmdb-instance-drawer', instanceId],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}`).then(r => r.data.data),
    enabled: instanceId !== null,
  })

  const { data: model } = useQuery({
    queryKey: ['cmdb-model', inst?.modelId],
    queryFn: () => api.get(`/cmdb/models/${inst!.modelId}`).then(r => r.data.data),
    enabled: !!inst?.modelId,
  })

  const drawerColumns = (model?.attributes ?? []).filter(
    (a: { isDrawerShow: boolean }) => a.isDrawerShow
  )

  return (
    <DetailDrawer
      open={instanceId !== null}
      onClose={onClose}
      width={640}
      title={inst?.name ?? (instanceId ? `#${instanceId}` : '加载中...')}
      subtitle={inst && <span className="text-xs text-v2-muted font-mono">{inst.modelId}</span>}
      footer={inst && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm"
            onClick={() => router.push(`/cmdb/topology/${inst.id}`)}>
            <GitBranch className="h-4 w-4" />
            查看拓扑
          </Button>
          <Button variant="primary" size="sm"
            onClick={() => { router.push(`/cmdb/instances/by-model/${inst.modelId}/${inst.id}`); onClose() }}>
            <FileText className="h-4 w-4" />
            完整详情
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    >
      {inst && (
        <div className="space-y-5">
          {inst.description && (
            <div className="rounded-v2-md border border-v2-border bg-v2-surface-soft p-3">
              <div className="text-xs font-semibold text-v2-muted mb-1">描述</div>
              <p className="text-sm text-v2-fg leading-relaxed">{inst.description}</p>
            </div>
          )}
          <div>
            <div className="mb-3 text-xs font-bold uppercase tracking-wider text-v2-muted">基本信息</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <InfoItem label="实例 ID" value={String(inst.id)} mono />
              <InfoItem label="状态" value={inst.status ?? '-'} />
              <InfoItem label="负责人" value={inst.owner || '-'} />
              <InfoItem label="创建时间" value={new Date(inst.createdAt).toLocaleString('zh-CN')} />
              {inst.updatedAt && (
                <InfoItem label="更新时间" value={new Date(inst.updatedAt).toLocaleString('zh-CN')} />
              )}
            </dl>
          </div>
          {drawerColumns.length > 0 && (
            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-v2-muted">关键属性</div>
              <dl className="space-y-2.5">
                {drawerColumns.map((col: { fieldKey: string; name: string }) => {
                  const v = inst.fieldsData?.[col.fieldKey]
                  const display = v === null || v === undefined || v === ''
                    ? '-'
                    : Array.isArray(v) ? v.join(', ')
                    : typeof v === 'object' ? JSON.stringify(v)
                    : String(v)
                  return (
                    <div key={col.fieldKey} className="flex items-start justify-between gap-3 text-sm">
                      <dt className="shrink-0 text-v2-muted">{col.name}</dt>
                      <dd className="text-right break-all text-v2-fg">{display}</dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          )}
        </div>
      )}
    </DetailDrawer>
  )
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-v2-muted mb-0.5">{label}</dt>
      <dd className={`text-sm text-v2-fg ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}
