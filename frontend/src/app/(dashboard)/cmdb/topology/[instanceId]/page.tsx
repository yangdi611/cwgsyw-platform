'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toPng } from 'html-to-image'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { CiTopologyGraph, TopologyNode, TopologyEdge } from '@/components/cmdb/CiTopologyGraph'
import '@/design-system/figma-neutral/index.css'
import { CANVAS_NEUTRAL } from '@/design-system/figma-neutral/canvas-tokens'
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Chip,
  DetailDrawerPage,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/design-system/figma-neutral/components'

interface CiTopologyResult {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

const STATUS_OPTIONS = [
  { value: 'online', label: '在线' },
  { value: 'offline', label: '离线' },
  { value: 'maintenance', label: '维护中' },
]

export default function TopologyPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const graphRef = useRef<HTMLDivElement>(null)

  const [depth, setDepth] = useState(2)
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null)
  const [selectedModels, setSelectedModels] = useState<Set<string> | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read') || !hasPermission('cmdb_topology', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data, isLoading, isError } = useQuery<CiTopologyResult>({
    queryKey: ['cmdb-topology', instanceId, depth],
    queryFn: async () => {
      try {
        const r = await api.get(`/cmdb/topology/${instanceId}`, { params: { depth } })
        return r.data.data
      } catch {
        return { nodes: [], edges: [] }
      }
    },
    enabled: typeof window !== 'undefined' && isHydrated
      && hasPermission('cmdb_instance', 'read') && hasPermission('cmdb_topology', 'read'),
  })

  const nodes = data?.nodes ?? []
  const edges = data?.edges ?? []

  const modelOptions = useMemo(() => {
    const map = new Map<string, string>()
    nodes.forEach((n) => {
      if (n.modelId) map.set(n.modelId, n.modelName ?? n.modelId)
    })
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [nodes])

  const statusOptions = useMemo(() => {
    const present = new Set<string>()
    nodes.forEach((n) => { if (n.status) present.add(n.status) })
    return STATUS_OPTIONS.filter((s) => present.has(s.value))
  }, [nodes])

  const filterNodeIds = useMemo(() => {
    if (!nodes.length) return null
    if (!selectedModels && !selectedStatuses) return null
    const sm = selectedModels
    const ss = selectedStatuses
    const ids = new Set<number>()
    nodes.forEach((n) => {
      const modelOk = !sm || sm.has(n.modelId ?? '')
      const statusOk = !ss || !n.status || ss.has(n.status)
      if (modelOk && statusOk) ids.add(n.id)
    })
    return ids
  }, [nodes, selectedModels, selectedStatuses])

  const toggleModel = (id: string) =>
    setSelectedModels((prev) => {
      const base = prev ?? new Set(modelOptions.map((m) => m.id))
      const next = new Set(base)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  const toggleStatus = (id: string) =>
    setSelectedStatuses((prev) => {
      const base = prev ?? new Set(statusOptions.map((s) => s.value))
      const next = new Set(base)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const rootNode = nodes.find((n) => n.isRoot)

  const handleExport = async () => {
    if (!graphRef.current) return
    const el = graphRef.current
    const pixelRatio = Math.max(2, Math.ceil(1920 / Math.max(el.offsetWidth, 1)))
    toast.info('正在生成图片…')
    try {
      const dataUrl = await toPng(el, {
        pixelRatio,
        backgroundColor: CANVAS_NEUTRAL[900],
        cacheBust: true,
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `topology-${instanceId}-${Date.now()}.png`
      a.click()
      toast.success('已导出 PNG')
    } catch {
      toast.error('导出失败，请重试')
    }
  }

  return (
    <DetailDrawerPage
      header={
        <PageHeader
          eyebrow="CMDB"
          title={`${rootNode?.name ?? `#${instanceId}`} 的拓扑图`}
          subtitle={`${nodes.length} 个节点，${edges.length} 条关联`}
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/cmdb', label: 'CMDB' },
                { label: '拓扑图' },
              ]}
            />
          }
          actions={
            <div className="cwgsyw-inline-controls">
              <Button
                type="button"
                variant="secondary"
                disabled={!rootNode}
                onClick={() => rootNode && router.push(`/cmdb/instances/by-model/${rootNode.modelId}/${instanceId}`)}
              >
                返回实例
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push(`/cmdb/topology/${instanceId}/compare`)}>
                拓扑对比
              </Button>
              <Button type="button" variant="secondary" disabled={!nodes.length} onClick={() => void handleExport()}>
                导出 PNG
              </Button>
            </div>
          }
        />
      }
      workspaceToolbar={
        <div className="cwgsyw-inline-controls">
          <span className="cwgsyw-type-label-sm">深度</span>
          {[1, 2, 3].map((d) => (
            <Chip key={d} label={String(d)} selected={depth === d} onClick={() => setDepth(d)} />
          ))}
        </div>
      }
      content={
        isLoading ? (
          <LoadingState label="加载拓扑" />
        ) : isError ? (
          <ErrorState title="拓扑加载失败" description="请刷新重试。" showRetry={false} />
        ) : !nodes.length ? (
          <EmptyState title="暂无关联数据" />
        ) : (
          <CiTopologyGraph
            ref={graphRef}
            nodes={nodes}
            edges={edges}
            rootId={Number(instanceId)}
            preview={false}
            onNodeClick={setSelectedNode}
            filterNodeIds={filterNodeIds}
          />
        )
      }
      drawer={
        <Card
          title="过滤"
          headerAction={(selectedModels || selectedStatuses) ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => { setSelectedModels(null); setSelectedStatuses(null) }}>
              重置
            </Button>
          ) : null}
        >
          {selectedNode ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/instances/by-model/${selectedNode.modelId}/${selectedNode.id}`)}>
              访问实例
            </Button>
          ) : null}
          {modelOptions.length > 0 ? (
            <div className="cwgsyw-stack-list">
              <p className="cwgsyw-type-label-sm">模型类型</p>
              {modelOptions.map((m) => {
                const checked = (selectedModels ?? new Set(modelOptions.map((x) => x.id))).has(m.id)
                return <Checkbox key={m.id} label={m.name} checked={checked} onChange={() => toggleModel(m.id)} />
              })}
            </div>
          ) : null}
          {statusOptions.length > 0 ? (
            <div className="cwgsyw-stack-list">
              <p className="cwgsyw-type-label-sm">状态</p>
              {statusOptions.map((s) => {
                const checked = (selectedStatuses ?? new Set(statusOptions.map((x) => x.value))).has(s.value)
                return <Checkbox key={s.value} label={s.label} checked={checked} onChange={() => toggleStatus(s.value)} />
              })}
            </div>
          ) : null}
          <p className="cwgsyw-type-label-sm">未选中的节点将半透明显示，保持拓扑连通性。</p>
          {selectedNode ? (
            <div className="cwgsyw-stack-list">
              <div className="cwgsyw-inline-controls">
                <h3 className="cwgsyw-type-title-sm">节点详情</h3>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedNode(null)}>关闭</Button>
              </div>
              <p className="cwgsyw-type-body-sm">{selectedNode.name}</p>
              <p className="cwgsyw-type-label-sm">{selectedNode.modelName ?? selectedNode.modelId ?? '—'}</p>
              {selectedNode.status ? <p className="cwgsyw-type-label-sm">状态 {selectedNode.status}</p> : null}
              {selectedNode.owner ? <p className="cwgsyw-type-label-sm">负责人 {selectedNode.owner}</p> : null}
              {selectedNode.keyAttrs && Object.keys(selectedNode.keyAttrs).length > 0 ? (
                <dl className="cwgsyw-stack-list">
                  {Object.entries(selectedNode.keyAttrs).map(([k, v]) => (
                    <div key={k} className="cwgsyw-inline-controls">
                      <dt className="cwgsyw-type-label-sm">{k}</dt>
                      <dd className="cwgsyw-type-body-sm">{String(v ?? '—')}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {selectedNode.isRoot ? <Badge label="当前根节点" /> : null}
            </div>
          ) : null}
        </Card>
      }
    />
  )
}
