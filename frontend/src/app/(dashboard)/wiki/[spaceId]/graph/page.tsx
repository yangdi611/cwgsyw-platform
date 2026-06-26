'use client'

import { useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { wikiApi } from '@/lib/wiki-api'
import { usePermission } from '@/hooks/usePermission'
import { ArrowLeft } from 'lucide-react'
import type { WikiGraph } from '@/types/wiki'

function statusColor(status: string): string {
  return status === 'published' ? '#22c55e' : '#94a3b8'
}

export default function WikiGraphPage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const sid = Number(spaceId)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('wiki', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data, isLoading } = useQuery<WikiGraph>({
    queryKey: ['wiki-graph', sid],
    queryFn: () => wikiApi.getGraph(sid),
  })

  const nodes: Node[] = useMemo(() => {
    return (data?.nodes ?? []).map((n, i) => ({
      id: String(n.id),
      position: { x: (i % 8) * 180, y: Math.floor(i / 8) * 120 },
      data: { label: n.title },
      style: {
        background: statusColor(n.status),
        color: '#0f172a',
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: 8,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        width: 150,
        textAlign: 'center' as const,
      },
    }))
  }, [data])

  const edges: Edge[] = useMemo(() => {
    return (data?.edges ?? []).map((e, i) => ({
      id: `e-${e.source}-${e.target}-${i}`,
      source: String(e.source),
      target: String(e.target),
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#94a3b8' },
    }))
  }, [data])

  return (
    <div className="flex h-full flex-col -m-6">
      <div className="flex shrink-0 items-center gap-3 border-b border-v2-border bg-v2-surface px-4 py-2.5">
        <button
          onClick={() => router.push(`/wiki/${sid}`)}
          className="flex items-center gap-1.5 text-sm text-v2-muted hover:text-v2-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          返回空间
        </button>
        <span className="text-sm font-semibold text-v2-fg">知识图谱</span>
        <span className="text-xs text-v2-muted">
          {nodes.length} 个页面，{edges.length} 条引用
        </span>
      </div>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-v2-muted">加载中…</div>
        ) : nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-v2-muted">
            暂无页面引用关系
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            onNodeClick={(_e, node) => router.push(`/wiki/${sid}/${node.id}`)}
          >
            <Background />
            <Controls />
            <MiniMap nodeColor={(n) => (n.style?.background as string) ?? '#94a3b8'} pannable zoomable />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
