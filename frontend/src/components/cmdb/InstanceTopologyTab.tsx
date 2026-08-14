'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { CiTopologyGraph, TopologyNode, TopologyEdge } from '@/components/cmdb/CiTopologyGraph'
import { usePermission } from '@/hooks/usePermission'
import { Button, Card, EmptyState, LoadingState } from '@/design-system/figma-neutral/components'

interface Props {
  id: string
}

export function InstanceTopologyTab({ id }: Props) {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const { data: topoData, isLoading } = useQuery<{ nodes: TopologyNode[]; edges: TopologyEdge[] }>({
    queryKey: ['cmdb-topology', id],
    queryFn: () => api.get(`/cmdb/topology/${id}`, { params: { depth: 2 } }).then((r) => r.data.data),
    enabled: isHydrated && hasPermission('cmdb_topology', 'read'),
  })

  return (
    <Card
      title="拓扑图"
      headerAction={
        <div className="cwgsyw-inline-controls">
          <Button type="button" size="sm" variant="ghost" onClick={() => router.push(`/cmdb/topology/${id}/compare`)}>
            对比模式
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => router.push(`/cmdb/topology/${id}`)}>
            全屏展开
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <LoadingState label="加载拓扑" />
      ) : !topoData || topoData.nodes.length === 0 ? (
        <EmptyState title="暂无关联数据" />
      ) : (
        <div style={{ height: 'calc(100vh - 420px)', minHeight: 480 }}>
          <CiTopologyGraph
            nodes={topoData.nodes}
            edges={topoData.edges}
            rootId={Number(id)}
            preview
          />
        </div>
      )}
    </Card>
  )
}
