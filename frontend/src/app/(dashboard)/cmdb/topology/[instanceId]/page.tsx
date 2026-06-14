'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toPng } from 'html-to-image'
import api from '@/lib/api'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, X, GitCompare, Download, Filter, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import {
  CiTopologyGraph, TopologyNode, TopologyEdge, DiffStatus,
} from '@/components/cmdb/CiTopologyGraph'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface CiTopologyResult {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

interface CompareNodeV2 extends TopologyNode {
  fields_data?: Record<string, unknown> | null
}
interface CompareEdge {
  src: number
  dst: number
  kind: string
  label: string
  status: DiffStatus
}
interface TopologyCompareVO {
  added: CompareNodeV2[]
  removed: CompareNodeV2[]
  modified: CompareNodeV2[]
  unchanged: CompareNodeV2[]
  edges: CompareEdge[]
}

const STATUS_OPTIONS = [
  { value: 'online', label: '在线' },
  { value: 'offline', label: '离线' },
  { value: 'maintenance', label: '维护中' },
]

const DIFF_LEGEND: { status: DiffStatus; label: string; cls: string }[] = [
  { status: 'added', label: '新增', cls: 'bg-green-500/20 text-green-300 border-green-500/40' },
  { status: 'removed', label: '删除', cls: 'bg-red-500/20 text-red-300 border-red-500/40' },
  { status: 'modified', label: '修改', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { status: 'unchanged', label: '未变', cls: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
]

/** Merge a compare VO into the graph's node/edge + diff-map inputs. */
function mergeCompare(vo: TopologyCompareVO) {
  const nodes: TopologyNode[] = []
  const nodeDiffMap = new Map<number, DiffStatus>()
  ;(['added', 'removed', 'modified', 'unchanged'] as DiffStatus[]).forEach(status => {
    vo[status].forEach(n => {
      nodes.push({
        id: n.id, name: n.name, model_id: n.model_id, model_name: n.model_name,
        model_color: n.model_color, status: n.status, owner: n.owner,
        is_root: n.is_root, key_attrs: n.key_attrs,
      })
      nodeDiffMap.set(n.id, status)
    })
  })
  const edges: TopologyEdge[] = vo.edges.map(e => ({
    src: e.src, dst: e.dst, kind: e.kind, label: e.label,
  }))
  const edgeDiffMap = new Map<string, DiffStatus>()
  vo.edges.forEach(e => edgeDiffMap.set(`${e.src}-${e.dst}-${e.kind}`, e.status ?? 'unchanged'))
  return { nodes, edges, nodeDiffMap, edgeDiffMap }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TopologyPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const graphRef = useRef<HTMLDivElement>(null)

  const [depth, setDepth] = useState(2)
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null)

  // compare mode
  const [compareMode, setCompareMode] = useState(false)
  const [fromTime, setFromTime] = useState('')
  const [toTime, setToTime] = useState('')
  const [compareDepth, setCompareDepth] = useState(3)
  const [compareNonce, setCompareNonce] = useState(0)

  // filters
  const [selectedModels, setSelectedModels] = useState<Set<string> | null>(null)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data, isLoading, isError } = useQuery<CiTopologyResult>({
    queryKey: ['cmdb-topology', instanceId, depth],
    queryFn: () => api.get(`/cmdb/topology/${instanceId}`, { params: { depth } }).then(r => r.data.data),
    enabled: !compareMode,
  })

  const compareQuery = useQuery<TopologyCompareVO>({
    queryKey: ['cmdb-topology-compare', instanceId, fromTime, toTime, compareDepth, compareNonce],
    queryFn: () =>
      api
        .get(`/cmdb/topology/${instanceId}/compare`, {
          params: {
            fromTime: fromTime ? `${fromTime}T00:00:00` : undefined,
            toTime: toTime ? `${toTime}T23:59:59` : undefined,
            depth: compareDepth,
          },
        })
        .then(r => r.data.data),
    enabled: compareMode && compareNonce > 0 && !!fromTime && !!toTime,
  })

  // active node/edge source + diff maps (normal vs compare)
  const graphInput = useMemo(() => {
    if (compareMode && compareQuery.data) {
      return mergeCompare(compareQuery.data)
    }
    return {
      nodes: data?.nodes ?? [],
      edges: data?.edges ?? [],
      nodeDiffMap: null,
      edgeDiffMap: null,
    }
  }, [compareMode, compareQuery.data, data])

  // ── derived filter option lists ──
  const modelOptions = useMemo(() => {
    const map = new Map<string, string>()
    graphInput.nodes.forEach(n => {
      if (n.model_id) map.set(n.model_id, n.model_name ?? n.model_id)
    })
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [graphInput.nodes])

  const statusOptions = useMemo(() => {
    const present = new Set<string>()
    graphInput.nodes.forEach(n => { if (n.status) present.add(n.status) })
    return STATUS_OPTIONS.filter(s => present.has(s.value))
  }, [graphInput.nodes])

  // reset filters when the model list changes identity (e.g. toggling compare mode)
  useEffect(() => { setSelectedModels(null); setSelectedStatuses(null) }, [compareMode])

  const filterNodeIds = useMemo(() => {
    if (!graphInput.nodes.length) return null
    if (!selectedModels && !selectedStatuses) return null
    const sm = selectedModels
    const ss = selectedStatuses
    const ids = new Set<number>()
    graphInput.nodes.forEach(n => {
      const modelOk = !sm || sm.has(n.model_id ?? '')
      const statusOk = !ss || !n.status || ss.has(n.status)
      if (modelOk && statusOk) ids.add(n.id)
    })
    return ids
  }, [graphInput.nodes, selectedModels, selectedStatuses])

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

  const rootNode = graphInput.nodes.find(n => n.is_root)

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
          <span className="text-xs text-muted-foreground ml-2">
            {graphInput.nodes.length} 个节点，{graphInput.edges.length} 条关联
          </span>
        </div>

        {/* Compare mode toggle */}
        <Button
          size="sm"
          variant={compareMode ? 'default' : 'outline'}
          onClick={() => setCompareMode(v => !v)}
        >
          <GitCompare className="h-4 w-4 mr-1" />对比模式
        </Button>

        {/* Export PNG */}
        <Button size="sm" variant="outline" onClick={handleExport} disabled={!graphInput.nodes.length}>
          <Download className="h-4 w-4 mr-1" />导出 PNG
        </Button>

        {/* Depth selector (hidden in compare mode) */}
        {!compareMode && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">深度：</span>
            {[1, 2, 3].map(d => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={cn(
                  'w-7 h-7 rounded text-xs font-medium transition-colors',
                  depth === d ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground',
                )}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compare controls */}
      {compareMode && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 flex-wrap">
          <span className="text-xs text-muted-foreground">起始日期</span>
          <Input type="date" value={fromTime} onChange={e => setFromTime(e.target.value)} className="w-40 h-8" />
          <span className="text-xs text-muted-foreground">截止日期</span>
          <Input type="date" value={toTime} onChange={e => setToTime(e.target.value)} className="w-40 h-8" />
          <span className="text-xs text-muted-foreground">深度</span>
          <Input
            type="number"
            min={1}
            max={5}
            value={compareDepth}
            onChange={e => setCompareDepth(Math.min(5, Math.max(1, Number(e.target.value) || 3)))}
            className="w-16 h-8"
          />
          <Button
            size="sm"
            onClick={() => setCompareNonce(n => n + 1)}
            disabled={!fromTime || !toTime || compareQuery.isFetching}
          >
            {compareQuery.isFetching ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" />对比中</>
            ) : (
              <><GitCompare className="h-4 w-4 mr-1" />开始对比</>
            )}
          </Button>
          {compareQuery.data && (
            <div className="flex items-center gap-1.5 ml-2">
              {DIFF_LEGEND.map(l => {
                const count = compareQuery.data[l.status]?.length ?? 0
                return (
                  <span key={l.status} className={cn('text-[11px] px-1.5 py-0.5 rounded border', l.cls)}>
                    {l.label} {count}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Graph + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden relative">
          {isLoading || (compareMode && compareQuery.isFetching) ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />加载中...
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center h-full text-destructive text-sm">加载失败，请刷新重试</div>
          ) : compareMode && compareNonce > 0 && compareQuery.isError ? (
            <div className="flex items-center justify-center h-full text-destructive text-sm">
              对比失败，请检查时间范围与深度
            </div>
          ) : !graphInput.nodes.length ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {compareMode ? '点击「开始对比」生成差异拓扑' : '暂无关联数据'}
            </div>
          ) : (
            <CiTopologyGraph
              ref={graphRef}
              nodes={graphInput.nodes}
              edges={graphInput.edges}
              rootId={Number(instanceId)}
              preview={false}
              onNodeClick={setSelectedNode}
              filterNodeIds={filterNodeIds}
              nodeDiffMap={graphInput.nodeDiffMap}
              edgeDiffMap={graphInput.edgeDiffMap}
            />
          )}
        </div>

        {/* Right sidebar: filters + selected node */}
        <div className="w-72 border-l bg-background flex-shrink-0 overflow-y-auto">
          {/* Filter panel */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">过滤</h3>
              {(selectedModels || selectedStatuses) && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground ml-auto"
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
                <p className="text-xs text-muted-foreground mb-1.5">模型类型</p>
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
                <p className="text-xs text-muted-foreground mb-1.5">状态</p>
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

            <p className="text-[11px] text-muted-foreground mt-3">
              未选中的节点将半透明显示，保持拓扑连通性。
            </p>
          </div>

          {/* Selected node detail */}
          {selectedNode && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">节点详情</h3>
                <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground">
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
                {selectedNode.status && (
                  <div>
                    <p className="text-xs text-muted-foreground">状态</p>
                    <p>{selectedNode.status}</p>
                  </div>
                )}
                {selectedNode.owner && (
                  <div>
                    <p className="text-xs text-muted-foreground">负责人</p>
                    <p>{selectedNode.owner}</p>
                  </div>
                )}
                {selectedNode.key_attrs && Object.keys(selectedNode.key_attrs).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">关键属性</p>
                    <dl className="text-xs space-y-0.5 mt-1">
                      {Object.entries(selectedNode.key_attrs).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt className="text-muted-foreground font-mono">{k}</dt>
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
