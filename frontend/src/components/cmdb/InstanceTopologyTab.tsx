'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { CiTopologyGraph, TopologyNode, TopologyEdge } from '@/components/cmdb/CiTopologyGraph'
import { GitBranch, GitCompare } from 'lucide-react'

interface Props {
  id: string
}

/**
 * Inline topology preview for the instance detail view. Renders a depth-2 BFS
 * graph with a link to the fullscreen topology page. Self-contained: fetches
 * its own data while mounted.
 */
export function InstanceTopologyTab({ id }: Props) {
  const { data: topoData, isLoading } = useQuery<{ nodes: TopologyNode[]; edges: TopologyEdge[] }>({
    queryKey: ['cmdb-topology', id],
    queryFn: () => api.get(`/cmdb/topology/${id}`, { params: { depth: 2 } }).then(r => r.data.data),
  })

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GitBranch className="h-4 w-4" />
          拓扑图
        </div>
        <div className="flex items-center gap-3">
          {/* AC10 (Issue #64): 对比模式已分离为独立子路由 /cmdb/topology/[id]/compare */}
          <Link href={`/cmdb/topology/${id}/compare`} className="text-xs text-v2-muted hover:text-v2-fg flex items-center gap-1">
            <GitCompare className="h-3 w-3" />对比模式
          </Link>
          <Link href={`/cmdb/topology/${id}`} className="text-xs text-v2-muted hover:text-v2-fg">
            全屏展开 →
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[280px] text-v2-muted text-sm">加载中...</div>
      ) : !topoData || topoData.nodes.length === 0 ? (
        <div className="flex items-center justify-center h-[280px] text-v2-muted text-sm">暂无关联数据</div>
      ) : (
        <CiTopologyGraph
          nodes={topoData.nodes}
          edges={topoData.edges}
          rootId={Number(id)}
          preview={true}
        />
      )}
    </div>
  )
}
