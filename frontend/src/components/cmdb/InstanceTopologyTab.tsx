'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { CiTopologyGraph, TopologyNode, TopologyEdge } from '@/components/cmdb/CiTopologyGraph'
import { usePermission } from '@/hooks/usePermission'
import { Button, EmptyState, LoadingState } from '@/design-system/figma-neutral/components'

interface Props {
  id: string
}

interface TopologyPayload {
  nodes?: Array<{
    id: number
    name: string
    modelId?: string | null
    model_id?: string | null
    modelName?: string | null
    model_name?: string | null
    modelColor?: string | null
    model_color?: string | null
    status?: string | null
    owner?: string | null
    isRoot?: boolean
    is_root?: boolean
    keyAttrs?: Record<string, unknown> | null
    key_attrs?: Record<string, unknown> | null
  }>
  edges?: TopologyEdge[]
}

export function InstanceTopologyTab({ id }: Props) {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const { data: topoData, isLoading } = useQuery<{ nodes: TopologyNode[]; edges: TopologyEdge[] }>({
    queryKey: ['cmdb-topology', id],
    queryFn: async () => {
      const response = await api.get(`/cmdb/topology/${id}`, { params: { depth: 2 } })
      const payload = response.data.data as TopologyPayload
      return {
        nodes: (payload.nodes ?? []).map((node) => ({
          id: node.id,
          name: node.name,
          modelId: node.modelId ?? node.model_id ?? null,
          modelName: node.modelName ?? node.model_name ?? null,
          modelColor: node.modelColor ?? node.model_color ?? null,
          status: node.status ?? null,
          owner: node.owner ?? null,
          isRoot: node.isRoot ?? node.is_root ?? false,
          keyAttrs: node.keyAttrs ?? node.key_attrs ?? null,
        })),
        edges: payload.edges ?? [],
      }
    },
    enabled: isHydrated && hasPermission('cmdb_topology', 'read'),
  })

  return (
    <section className="cwgsyw-cmdb-instance-tab__section cwgsyw-cmdb-instance-tab__topology">
      <div className="cwgsyw-cmdb-instance-tab__head">
        <h2>拓扑图</h2>
        <div className="cwgsyw-inline-controls">
          <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/topology/${id}/compare`)}>
            对比模式
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/topology/${id}`)}>
            全屏展开
          </Button>
        </div>
      </div>
      <div className="cwgsyw-cmdb-instance-tab__body cwgsyw-cmdb-instance-tab__topology-body">
        {isLoading ? (
          <LoadingState label="加载拓扑" />
        ) : !topoData || topoData.nodes.length === 0 ? (
          <EmptyState title="暂无关联数据" />
        ) : (
          <div className="cwgsyw-cmdb-instance-tab__topology-canvas">
            <CiTopologyGraph
              nodes={topoData.nodes}
              edges={topoData.edges}
              rootId={Number(id)}
            />
          </div>
        )}
      </div>
    </section>
  )
}
