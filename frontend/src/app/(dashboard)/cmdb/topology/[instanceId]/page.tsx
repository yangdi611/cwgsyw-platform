'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, X } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { CiTopologyGraph, TopologyNode, TopologyEdge } from '@/components/cmdb/CiTopologyGraph'
import { cn } from '@/lib/utils'

interface CiTopologyResult {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

export default function TopologyPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [depth, setDepth] = useState(2)
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data, isLoading, isError } = useQuery<CiTopologyResult>({
    queryKey: ['cmdb-topology', instanceId, depth],
    queryFn: () => api.get(`/cmdb/topology/${instanceId}`, { params: { depth } }).then(r => r.data.data),
  })

  const rootNode = data?.nodes.find(n => n.is_root)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background flex-shrink-0">
        {rootNode ? (
          <Link
            href={`/cmdb/instances/by-model/${rootNode.model_id}/${instanceId}`}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />返回实例
          </Link>
        ) : (
          <button className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'opacity-50 cursor-not-allowed')} disabled>
            <ArrowLeft className="h-4 w-4 mr-1" />返回实例
          </button>
        )}
        <div className="flex-1">
          <span className="font-semibold text-sm">
            {rootNode?.name ?? `#${instanceId}`} 的拓扑图
          </span>
          <span className="text-xs text-muted-foreground ml-2">
            {data?.nodes.length ?? 0} 个节点，{data?.edges.length ?? 0} 条关联
          </span>
        </div>
        {/* 深度选择器 */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">深度：</span>
          {[1, 2, 3].map(d => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={cn(
                'w-7 h-7 rounded text-xs font-medium transition-colors',
                depth === d
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* 图区域 + 右侧节点信息面板 */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>
          ) : isError ? (
            <div className="flex items-center justify-center h-full text-destructive text-sm">加载失败，请刷新重试</div>
          ) : !data || data.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">暂无关联数据</div>
          ) : (
            <CiTopologyGraph
              nodes={data.nodes}
              edges={data.edges}
              rootId={Number(instanceId)}
              preview={false}
              onNodeClick={setSelectedNode}
            />
          )}
        </div>

        {/* 右侧节点详情面板 */}
        {selectedNode && (
          <div className="w-64 border-l bg-background flex-shrink-0 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">节点详情</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">名称</p>
                <p className="font-medium">{selectedNode.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">模型</p>
                <p>{selectedNode.model_name ?? selectedNode.model_id ?? '—'}</p>
              </div>
              {selectedNode.is_root && (
                <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-600 dark:text-amber-400">
                  当前根节点
                </div>
              )}
              <Link
                href={`/cmdb/instances/by-model/${selectedNode.model_id}/${selectedNode.id}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full mt-2')}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />访问实例
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
