'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toPng } from 'html-to-image'
import api from '@/lib/api'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, X, GitCompare, Download, Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import {
  CiTopologyGraph, TopologyNode, TopologyEdge,
} from '@/components/cmdb/CiTopologyGraph'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface CiTopologyResult {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

const STATUS_OPTIONS = [
  { value: 'online', label: '在线' },
  { value: 'offline', label: '离线' },
  { value: 'maintenance', label: '维护中' },
]

// NOTE (AC10, Issue #64): 拓扑对比模式已分离为独立子路由
// /cmdb/topology/[instanceId]/compare，本页只负责常规拓扑浏览。

// ── Page ─────────────────────────────────────────────────────────────────────

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
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
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
    enabled: typeof window !== 'undefined',
  })

  const nodes = data?.nodes ?? []
  const edges = data?.edges ?? []

  // ── derived filter option lists ──
  const modelOptions = useMemo(() => {
    const map = new Map<string, string>()
    nodes.forEach(n => {
      if (n.model_id) map.set(n.model_id, n.model_name ?? n.model_id)
    })
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [nodes])

  const statusOptions = useMemo(() => {
    const present = new Set<string>()
    nodes.forEach(n => { if (n.status) present.add(n.status) })
    return STATUS_OPTIONS.filter(s => present.has(s.value))
  }, [nodes])

  const filterNodeIds = useMemo(() => {
    if (!nodes.length) return null
    if (!selectedModels && !selectedStatuses) return null
    const sm = selectedModels
    const ss = selectedStatuses
    const ids = new Set<number>()
    nodes.forEach(n => {
      const modelOk = !sm || sm.has(n.model_id ?? '')
      const statusOk = !ss || !n.status || ss.has(n.status)
      if (modelOk && statusOk) ids.add(n.id)
    })
    return ids
  }, [nodes, selectedModels, selectedStatuses])

  const toggleModel = (id: string) =>
    setSelectedModels(prev => {
      const base = prev ?? new Set(modelOptions.map(m => m.id))
      const next = new Set(base)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  const toggleStatus = (id: string) =>
    setSelectedStatuses(prev => {
      const base = prev ?? new Set(statusOptions.map(s => s.value))
      const next = new Set(base)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const rootNode = nodes.find(n => n.is_root)

  const handleExport = async () => {
    if (!graphRef.current) return
    const el = graphRef.current
    const pixelRatio = Math.max(2, Math.ceil(1920 / Math.max(el.offsetWidth, 1)))
    toast.info('正在生成图片…')
    try {
      const dataUrl = await toPng(el, {
        pixelRatio,
        backgroundColor: '#0f172a',
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
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background flex-shrink-0 flex-wrap">
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
        <div className="flex-1 min-w-[160px]">
          <span className="font-semibold text-sm">
            {rootNode?.name ?? `#${instanceId}`} 的拓扑图
          </span>
          <span className="text-xs text-v2-muted ml-2">
            {nodes.length} 个节点，{edges.length} 条关联
          </span>
        </div>

        {/* Topology compare — dedicated sub-route (AC10) */}
        <Link
          href={`/cmdb/topology/${instanceId}/compare`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <GitCompare className="h-4 w-4 mr-1" />拓扑对比
        </Link>

        {/* Export PNG */}
        <Button size="sm" variant="outline" onClick={handleExport} disabled={!nodes.length}>
          <Download className="h-4 w-4 mr-1" />导出 PNG
        </Button>

        {/* Depth selector */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-v2-muted mr-1">深度：</span>
          {[1, 2, 3].map(d => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={cn(
                'w-7 h-7 rounded text-xs font-medium transition-colors',
                depth === d ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-v2-muted',
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Graph + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-v2-muted text-sm">
              加载中...
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center h-full text-v2-danger text-sm">加载失败，请刷新重试</div>
          ) : !nodes.length ? (
            <div className="flex items-center justify-center h-full text-v2-muted text-sm">
              暂无关联数据
            </div>
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
          )}
        </div>

        {/* Right sidebar: filters + selected node */}
        <div className="w-72 border-l bg-background flex-shrink-0 overflow-y-auto">
          {/* Filter panel */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-v2-muted" />
              <h3 className="font-semibold text-sm">过滤</h3>
              {(selectedModels || selectedStatuses) && (
                <button
                  className="text-xs text-v2-muted hover:text-v2-fg ml-auto"
                  onClick={() => { setSelectedModels(null); setSelectedStatuses(null) }}
                >
                  重置
                </button>
              )}
            </div>

            {selectedNode && (
              <Link
                href={`/cmdb/instances/by-model/${selectedNode.model_id}/${selectedNode.id}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full mt-2')}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />访问实例
              </Link>
            )}

            {modelOptions.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-v2-muted mb-1.5">模型类型</p>
                <div className="space-y-1">
                  {modelOptions.map(m => {
                    const checked = (selectedModels ?? new Set(modelOptions.map(x => x.id))).has(m.id)
                    return (
                      <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => toggleModel(m.id)} />
                        <span className="truncate">{m.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {statusOptions.length > 0 && (
              <div>
                <p className="text-xs text-v2-muted mb-1.5">状态</p>
                <div className="space-y-1">
                  {statusOptions.map(s => {
                    const checked = (selectedStatuses ?? new Set(statusOptions.map(x => x.value))).has(s.value)
                    return (
                      <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={checked} onChange={() => toggleStatus(s.value)} />
                        <span>{s.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            <p className="text-[11px] text-v2-muted mt-3">
              未选中的节点将半透明显示，保持拓扑连通性。
            </p>
          </div>

          {/* Selected node detail */}
          {selectedNode && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">节点详情</h3>
                <button onClick={() => setSelectedNode(null)} className="text-v2-muted hover:text-v2-fg">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-v2-muted">名称</p>
                  <p className="font-medium">{selectedNode.name}</p>
                </div>
                <div>
                  <p className="text-xs text-v2-muted">模型</p>
                  <p>{selectedNode.model_name ?? selectedNode.model_id ?? '—'}</p>
                </div>
                {selectedNode.status && (
                  <div>
                    <p className="text-xs text-v2-muted">状态</p>
                    <p>{selectedNode.status}</p>
                  </div>
                )}
                {selectedNode.owner && (
                  <div>
                    <p className="text-xs text-v2-muted">负责人</p>
                    <p>{selectedNode.owner}</p>
                  </div>
                )}
                {selectedNode.key_attrs && Object.keys(selectedNode.key_attrs).length > 0 && (
                  <div>
                    <p className="text-xs text-v2-muted">关键属性</p>
                    <dl className="text-xs space-y-0.5 mt-1">
                      {Object.entries(selectedNode.key_attrs).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt className="text-v2-muted font-mono">{k}</dt>
                          <dd className="truncate">{String(v ?? '—')}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
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
    </div>
  )
}
