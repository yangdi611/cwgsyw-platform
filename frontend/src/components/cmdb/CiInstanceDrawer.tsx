'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button, NeutralDrawer } from '@/design-system/figma-neutral/components'

interface Props {
  instanceId: number | null
  onClose: () => void
}

export function CiInstanceDrawer({ instanceId, onClose }: Props) {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const { data: inst } = useQuery({
    queryKey: ['cmdb-instance-drawer', instanceId],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}`).then((r) => r.data.data),
    enabled: instanceId !== null,
  })
  const { data: model } = useQuery({
    queryKey: ['cmdb-model', inst?.modelId],
    queryFn: () => api.get(`/cmdb/models/${inst!.modelId}`).then((r) => r.data.data),
    enabled: !!inst?.modelId,
  })
  const drawerColumns = (model?.attributes ?? []).filter((a: { isDrawerShow: boolean }) => a.isDrawerShow)

  return (
    <NeutralDrawer
      open={instanceId !== null}
      onOpenChange={(open) => { if (!open) onClose() }}
      title={inst?.name ?? (instanceId ? `#${instanceId}` : '加载中...')}
      description={inst?.modelId}
    >
      {inst ? (
        <div className="cwgsyw-stack-list">
          {inst.description ? <p className="cwgsyw-type-body-sm">{inst.description}</p> : null}
          <p className="cwgsyw-type-label-sm">实例 ID {inst.id}</p>
          <p className="cwgsyw-type-label-sm">状态 {inst.status ?? '-'}</p>
          <p className="cwgsyw-type-label-sm">负责人 {inst.owner || '-'}</p>
          <p className="cwgsyw-type-label-sm">创建时间 {new Date(inst.createdAt).toLocaleString('zh-CN')}</p>
          {drawerColumns.map((col: { fieldKey: string; name: string }) => {
            const v = inst.fieldsData?.[col.fieldKey]
            const display = v === null || v === undefined || v === '' ? '-' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)
            return <p key={col.fieldKey} className="cwgsyw-type-label-sm">{col.name} {display}</p>
          })}
          <div className="cwgsyw-inline-controls">
            {hasPermission('cmdb_topology', 'read') ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/topology/${inst.id}`)}>查看拓扑</Button>
            ) : null}
            <Button type="button" size="sm" onClick={() => { router.push(`/cmdb/instances/by-model/${inst.modelId}/${inst.id}`); onClose() }}>完整详情</Button>
          </div>
        </div>
      ) : null}
    </NeutralDrawer>
  )
}
