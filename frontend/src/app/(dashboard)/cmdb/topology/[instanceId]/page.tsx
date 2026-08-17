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
  Button,
  Checkbox,
  DetailDrawerPage,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PaginationPageItem,
} from '@/design-system/figma-neutral/components'

interface CiTopologyResult {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

interface CiTopologyPayload {
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
  const [isFullscreen, setIsFullscreen] = useState(false)

  const canReadTopology = isHydrated
    && hasPermission('cmdb_instance', 'read')
    && hasPermission('cmdb_topology', 'read')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read') || !hasPermission('cmdb_topology', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  useEffect(() => {
    if (!isFullscreen) return
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false)
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen])

  const { data, isLoading, isError, refetch } = useQuery<CiTopologyResult>({
    queryKey: ['cmdb-topology', instanceId, depth],
    queryFn: async () => {
      const r = await api.get(`/cmdb/topology/${instanceId}`, { params: { depth } })
      const payload = r.data.data as CiTopologyPayload
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
    enabled: typeof window !== 'undefined' && canReadTopology,
  })

  const nodes = useMemo(() => data?.nodes ?? [], [data?.nodes])
  const edges = useMemo(() => data?.edges ?? [], [data?.edges])

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
    <DetailDrawerPage className="cwgsyw-cmdb-page cwgsyw-cmdb-topology"
      header={
        <div className="cwgsyw-cmdb-instance-page">
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title={`${rootNode?.name ?? `#${instanceId}`} 的拓扑图`}
            subtitle={`拓扑节点 ${nodes.length} 个 · 关联 ${edges.length} 条`}
            actions={
              <div className="cwgsyw-inline-controls cwgsyw-cmdb-topology__header-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!rootNode}
                  onClick={() => rootNode && router.push(`/cmdb/instances/by-model/${rootNode.modelId}/${instanceId}`)}
                >
                  返回实例
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/topology/${instanceId}/compare`)}>
                  拓扑对比
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={!nodes.length} onClick={() => void handleExport()}>
                  导出 PNG
                </Button>
              </div>
            }
          />
        </div>
      }
      workspaceToolbar={
        <div className="cwgsyw-cmdb-topology__toolbar" role="group" aria-label="拓扑深度">
          <span className="cwgsyw-type-label-sm">查看深度</span>
          <div className="cwgsyw-cmdb-topology__depth-pages">
            {[1, 2, 3].map((d) => (
              <PaginationPageItem
                key={d}
                current={depth === d}
                label={`查看 ${d} 层拓扑`}
                onClick={() => setDepth(d)}
              >
                {d}
              </PaginationPageItem>
            ))}
          </div>
        </div>
      }
      content={
        !isHydrated ? (
          <div className="cwgsyw-cmdb-topology__state"><LoadingState label="正在准备拓扑" /></div>
        ) : !canReadTopology ? (
          <div className="cwgsyw-cmdb-topology__state">
            <ErrorState title="没有查看拓扑的权限" description="正在返回工作台。" showRetry={false} />
          </div>
        ) : isLoading ? (
          <div className="cwgsyw-cmdb-topology__state"><LoadingState label="加载拓扑" /></div>
        ) : isError ? (
          <div className="cwgsyw-cmdb-topology__state">
            <ErrorState
              title="拓扑加载失败"
              description="请检查网络后重试。"
              retry={<Button type="button" size="sm" variant="secondary" onClick={() => void refetch()}>重新加载</Button>}
            />
          </div>
        ) : !nodes.length ? (
          <div className="cwgsyw-cmdb-topology__state">
            <EmptyState title="暂无关联数据" description="当前实例没有可展示的拓扑节点。" />
          </div>
        ) : (
          <div className={`cwgsyw-cmdb-topology__workspace${isFullscreen ? ' is-fullscreen' : ''}`}>
            <div className="cwgsyw-cmdb-topology__canvas-header">
              <div>
                <h2>拓扑画布</h2>
                <p>选择节点查看详情；点击有关联的节点可折叠或展开。</p>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={() => setIsFullscreen((value) => !value)}>
                {isFullscreen ? '退出全屏' : '全屏查看'}
              </Button>
            </div>
            <div className="cwgsyw-cmdb-topology__canvas">
              <CiTopologyGraph
                ref={graphRef}
                nodes={nodes}
                edges={edges}
                rootId={Number(instanceId)}
                preview={false}
                onNodeClick={setSelectedNode}
                filterNodeIds={filterNodeIds}
              />
            </div>
          </div>
        )
      }
      drawer={
        <div className="cwgsyw-cmdb-topology__side-panel">
          <div className="cwgsyw-cmdb-topology__side-header">
            <h2>筛选与详情</h2>
            {(selectedModels || selectedStatuses) ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => { setSelectedModels(null); setSelectedStatuses(null) }}>
                重置筛选
              </Button>
            ) : null}
          </div>
          {modelOptions.length > 0 ? (
            <section className="cwgsyw-cmdb-topology__filter-group" aria-labelledby="topology-model-filter-title">
              <h3 id="topology-model-filter-title">模型类型</h3>
              {modelOptions.map((m) => {
                const checked = (selectedModels ?? new Set(modelOptions.map((x) => x.id))).has(m.id)
                return <Checkbox key={m.id} label={m.name} checked={checked} onChange={() => toggleModel(m.id)} />
              })}
            </section>
          ) : null}
          {statusOptions.length > 0 ? (
            <section className="cwgsyw-cmdb-topology__filter-group" aria-labelledby="topology-status-filter-title">
              <h3 id="topology-status-filter-title">状态</h3>
              {statusOptions.map((s) => {
                const checked = (selectedStatuses ?? new Set(statusOptions.map((x) => x.value))).has(s.value)
                return <Checkbox key={s.value} label={s.label} checked={checked} onChange={() => toggleStatus(s.value)} />
              })}
            </section>
          ) : null}
          <p className="cwgsyw-cmdb-topology__filter-note">未选中的节点保持在画布中并降低透明度，以保留拓扑连通性。</p>
          {selectedNode ? (
            <section className="cwgsyw-cmdb-topology__node-detail" aria-labelledby="topology-node-detail-title">
              <div className="cwgsyw-cmdb-topology__node-detail-header">
                <h3 id="topology-node-detail-title">节点详情</h3>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedNode(null)}>关闭</Button>
              </div>
              <dl className="cwgsyw-cmdb-topology__definition-list">
                <div><dt>实例</dt><dd>{selectedNode.name}</dd></div>
                <div><dt>模型</dt><dd>{selectedNode.modelName ?? selectedNode.modelId ?? '—'}</dd></div>
                {selectedNode.status ? <div><dt>状态</dt><dd>{STATUS_OPTIONS.find((item) => item.value === selectedNode.status)?.label ?? selectedNode.status}</dd></div> : null}
                {selectedNode.owner ? <div><dt>负责人</dt><dd>{selectedNode.owner}</dd></div> : null}
              </dl>
              {selectedNode.keyAttrs && Object.keys(selectedNode.keyAttrs).length > 0 ? (
                <dl className="cwgsyw-cmdb-topology__definition-list">
                  {Object.entries(selectedNode.keyAttrs).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{String(v ?? '—')}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {selectedNode.isRoot ? <Badge label="当前根节点" /> : null}
              <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/instances/by-model/${selectedNode.modelId}/${selectedNode.id}`)}>
                访问实例
              </Button>
            </section>
          ) : null}
        </div>
      }
    />
  )
}
