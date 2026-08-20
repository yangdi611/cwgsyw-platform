'use client'

import { useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { wikiApi } from '@/lib/wiki-api'
import { WikiShellHeader } from '@/components/wiki/WikiShellChrome'
import { usePermission } from '@/hooks/usePermission'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import type { WikiGraph } from '@/types/wiki'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DashboardFeedbackPage,
  EmptyState,
  LoadingState,
  PageHeader,
} from '@/design-system/figma-neutral/components'

function statusColor(status: string): string {
  return status === 'published' ? 'var(--cwgsyw-status-success-200)' : 'var(--cwgsyw-bg-surface-subtle)'
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

  const { data: spaces } = useQuery({ queryKey: ['wiki-spaces'], queryFn: wikiApi.listSpaces })
  const spaceName = spaces?.find((space) => space.id === sid)?.name
  useBreadcrumbLabel(spaceName)

  const nodes: Node[] = useMemo(() => {
    return (data?.nodes ?? []).map((node, index) => ({
      id: String(node.id),
      position: { x: (index % 8) * 180, y: Math.floor(index / 8) * 120 },
      data: { label: node.title },
      style: {
        background: statusColor(node.status),
        color: 'var(--cwgsyw-text-primary)',
        border: '1px solid var(--cwgsyw-border-default)',
        borderRadius: 8,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 400,
        width: 150,
        textAlign: 'center' as const,
      },
    }))
  }, [data])

  const edges: Edge[] = useMemo(() => {
    return (data?.edges ?? []).map((edge, index) => ({
      id: `e-${edge.source}-${edge.target}-${index}`,
      source: String(edge.source),
      target: String(edge.target),
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: 'var(--cwgsyw-border-strong)' },
    }))
  }, [data])

  return (
    <>
    <WikiShellHeader>
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title="知识图谱"
          subtitle={`${nodes.length} 个页面，${edges.length} 条引用`}
          actions={
            <Button className="cwgsyw-wiki__header-actions" type="button" variant="secondary" size="sm" onClick={() => router.push(`/wiki/${sid}`)}>
              返回空间
            </Button>
          }
        />
    </WikiShellHeader>
    <DashboardFeedbackPage
      className="cwgsyw-wiki cwgsyw-wiki-graph-page"
      feedback={
        isLoading ? (
          <LoadingState label="正在加载知识图谱…" />
        ) : nodes.length === 0 ? (
          <div className="cwgsyw-neutral-empty">
            {/* Official Figma share-2 glyph; image optimization adds no value here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/figma-icons/wiki-share-2.svg" width={22} height={22} alt="" data-figma-node="6:29351" />
            <EmptyState showIcon={false} title="暂无页面引用关系" description="当前空间还没有可展示的引用关系。" />
          </div>
        ) : (
          <div className="cwgsyw-wiki-graph" style={{ height: 560 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              onNodeClick={(_event, node) => router.push(`/wiki/${sid}/${node.id}`)}
            >
              <Background />
              <Controls />
              <MiniMap nodeColor={(node) => (node.style?.background as string) ?? 'var(--cwgsyw-bg-surface-subtle)'} pannable zoomable />
            </ReactFlow>
          </div>
        )
      }
    />
    </>
  )
}
