'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { CmdbInstancePreview } from '@/components/cmdb/CmdbInstancePreview'
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
      className="cwgsyw-cmdb-preview-drawer"
      showClose
      title={inst?.name ?? (instanceId ? `#${instanceId}` : '加载中...')}
      description={inst?.modelId}
    >
      {inst ? (
        <CmdbInstancePreview
          description={inst.description}
          fields={[
            { label: '实例 ID', value: inst.id },
            { label: '状态', value: inst.status ?? '-' },
            { label: '负责人', value: inst.owner || '-' },
            { label: '创建时间', value: new Date(inst.createdAt).toLocaleString('zh-CN') },
          ]}
          extraFields={drawerColumns.map((col: { fieldKey: string; name: string }) => {
            const v = inst.fieldsData?.[col.fieldKey]
            const display = v === null || v === undefined || v === '' ? '-' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)
            return { label: col.name, value: display }
          })}
          actions={
            <>
              {hasPermission('cmdb_topology', 'read') ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/topology/${inst.id}`)}>查看拓扑</Button>
              ) : null}
              <Button type="button" size="sm" onClick={() => { router.push(`/cmdb/instances/by-model/${inst.modelId}/${inst.id}`); onClose() }}>完整详情</Button>
            </>
          }
        />
      ) : null}
    </NeutralDrawer>
  )
}
