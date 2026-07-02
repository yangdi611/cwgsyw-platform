'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buttonVariants } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, AlertTriangle, ChevronDown, ChevronRight, Layers } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/lib/utils'

type Direction = 'bidirectional' | 'upstream' | 'downstream'

interface ImpactNode {
  id: number
  name: string
  modelId: string
  modelName?: string
  status?: string
  businessLevel?: string
}
interface ImpactLayer { depth: number; nodes: ImpactNode[] }
interface ImpactEdge { src: number; dst: number; kind: string; label?: string }
interface ImpactResult {
  rootId: number
  rootName: string
  rootModelId: string
  direction: string
  maxDepth: number
  truncated: boolean
  layers: ImpactLayer[]
  edges: ImpactEdge[]
}

const STATUS_LABELS: Record<string, string> = {
  running: '运行中',
  stopped: '已停止',
  maintenance: '维护中',
  fault: '故障',
  offline: '离线',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  running: 'default',
  stopped: 'secondary',
  maintenance: 'secondary',
  fault: 'destructive',
  offline: 'outline',
}

const BIZ_LEVEL_LABELS: Record<string, string> = {
  core: '核心',
  important: '重要',
  normal: '一般',
}

export default function ImpactAnalysisPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [direction, setDirection] = useState<Direction>('bidirectional')
  const [maxDepth, setMaxDepth] = useState(3)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read') || !hasPermission('cmdb_instance', 'impact')) {
      router.replace('/')
    }
  }, [isHydrated, hasPermission, router])

  const { data, isLoading, isError } = useQuery<ImpactResult>({
    queryKey: ['cmdb-impact', instanceId, direction, maxDepth],
    queryFn: async () => {
      try {
        const r = await api.post(`/cmdb/instances/${instanceId}/impact`, {
          direction,
          maxDepth: maxDepth,
        })
        return r.data.data
      } catch {
        return { nodes: [], edges: [] }
      }
    },
    enabled: typeof window !== 'undefined',
  })

  // depth map: node id → depth
  const depthMap = useMemo(() => {
    const m = new Map<number, number>()
    data?.layers.forEach(l => l.nodes.forEach(n => m.set(n.id, l.depth)))
    return m
  }, [data])

  // For each node, the edge labels connecting it to a shallower node (how it was reached)
  const incomingByNode = useMemo(() => {
    const m = new Map<number, ImpactEdge[]>()
    const rootId = data?.rootId
    data?.edges.forEach(e => {
      // edges touching root are attributed to the non-root endpoint
      if (e.src === rootId || e.dst === rootId) {
        const otherId = e.src === rootId ? e.dst : e.src
        if (otherId != null && otherId !== rootId) pushEdge(m, otherId, e)
        return
      }
      const sd = depthMap.get(e.src)
      const dd = depthMap.get(e.dst)
      // count edges bridging this node to a strictly shallower node
      if (sd != null && dd != null) {
        if (dd > sd) pushEdge(m, e.dst, e)
        if (sd > dd) pushEdge(m, e.src, e)
      }
    })
    return m
  }, [data, depthMap])

  const totalNodes = useMemo(() => {
    const ids = new Set<number>()
    data?.layers.forEach(l => l.nodes.forEach(n => { if (n.id != null) ids.add(n.id) }))
    return ids.size
  }, [data])

  const toggleCollapse = (depth: number) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(depth)) next.delete(depth)
      else next.add(depth)
      return next
    })

  return (
    <div className="space-y-6">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3">
        <Link
          href={data ? `/cmdb/instances/by-model/${data.rootModelId}/${instanceId}` : `/cmdb/instances/by-model/_/${instanceId}`}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回实例
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-v2-fg">
            {data?.rootName ?? `#${instanceId}`}
            <span className="ml-2 text-sm font-normal text-v2-muted">影响分析</span>
          </h1>
          <p className="mt-0.5 text-xs text-v2-muted">
            共 {totalNodes} 个节点，{data?.edges.length ?? 0} 条关联
          </p>
        </div>
        {/* 方向选择器 */}
        <Select value={direction} onValueChange={v => setDirection((v as Direction) ?? 'bidirectional')}>
          <SelectTrigger className="w-36">
            <SelectValue>
              {(v: string) =>
                ({ bidirectional: '双向', upstream: '上游（被影响）', downstream: '下游（影响对象）' } as Record<string, string>)[v] ?? v
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bidirectional">双向</SelectItem>
            <SelectItem value="upstream">上游（被影响）</SelectItem>
            <SelectItem value="downstream">下游（影响对象）</SelectItem>
          </SelectContent>
        </Select>
        {/* 深度选择器 */}
        <Select value={String(maxDepth)} onValueChange={v => setMaxDepth(Number(v) || 3)}>
          <SelectTrigger className="w-28">
            <SelectValue>{(v: string) => `深度 ${v}`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map(d => (
              <SelectItem key={d} value={String(d)}>深度 {d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">分析中...</p>
      ) : isError ? (
        <p className="text-destructive text-sm">加载失败，请刷新重试</p>
      ) : !data || data.layers.length === 0 ? (
        <p className="text-muted-foreground text-sm">暂无影响数据</p>
      ) : (
        <div className="space-y-4">
          {/* truncated 提示 */}
          {data.truncated && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
              <AlertTriangle className="h-4 w-4" />
              结果已被截断，仅展示部分影响范围。如需查看更多节点，请减小分析深度。
            </div>
          )}

          {/* 第 0 层：根节点 */}
          <ImpactRootCard data={data} />

          {/* 其余层（过滤掉根节点自身，跳过剩余节点为空的层） */}
          {data.layers.map(layer => {
            const nodes = layer.nodes.filter(n => n.id !== data.rootId)
            if (nodes.length === 0) return null
            const isCollapsed = collapsed.has(layer.depth)
            const dirLabel = direction === 'upstream' ? '上游' : direction === 'downstream' ? '下游' : '关联'
            return (
              <div key={layer.depth}>
                {/* 层分隔标识 */}
                <div className="flex items-center gap-2 my-2 pl-1">
                  <div className="h-px flex-1 bg-border" />
                  <Badge variant="outline" className="text-xs">第 {layer.depth} 层 · {dirLabel}</Badge>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {/* 层头（可收起） */}
                <button
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => toggleCollapse(layer.depth)}
                >
                  <span className="flex items-center gap-1">
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {nodes.length} 个节点
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {nodes.map(node => (
                      <ImpactNodeCard
                        key={node.id}
                        node={node}
                        edges={incomingByNode.get(node.id) ?? []}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function pushEdge(m: Map<number, ImpactEdge[]>, nodeId: number, e: ImpactEdge) {
  const arr = m.get(nodeId)
  if (arr) {
    if (!arr.some(x => x.src === e.src && x.dst === e.dst && x.kind === e.kind)) arr.push(e)
  } else {
    m.set(nodeId, [e])
  }
}

function ImpactRootCard({ data }: { data: ImpactResult }) {
  return (
    <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Layers className="h-4 w-4 text-primary" />
        <Badge variant="default">根节点</Badge>
        {data.rootModelId && <Badge variant="secondary">{data.rootModelId}</Badge>}
      </div>
      <div className="flex items-center justify-between">
        <Link
          href={`/cmdb/instances/by-model/${data.rootModelId}/${data.rootId}`}
          className="text-lg font-semibold hover:underline"
        >
          {data.rootName}
        </Link>
        <Link
          href={`/cmdb/instances/by-model/${data.rootModelId}/${data.rootId}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1" />查看详情
        </Link>
      </div>
    </div>
  )
}

function ImpactNodeCard({ node, edges }: { node: ImpactNode; edges: ImpactEdge[] }) {
  const statusKey = node.status?.toLowerCase()
  return (
    <div className="rounded-lg border bg-card p-3 hover:shadow-sm transition-shadow">
      {/* 入边标签：关联种类 */}
      {edges.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {edges.map((e, i) => (
            <Badge key={i} variant="outline" className="text-[10px]">
              {e.label ?? e.kind}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/cmdb/instances/by-model/${node.modelId}/${node.id}`}
          className="font-medium text-sm hover:underline truncate"
        >
          {node.name}
        </Link>
        {node.status && (
          <Badge variant={STATUS_VARIANT[statusKey ?? ''] ?? 'secondary'} className="text-[10px]">
            {STATUS_LABELS[statusKey ?? ''] ?? node.status}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {node.modelName && <Badge variant="secondary" className="text-[10px]">{node.modelName}</Badge>}
        {node.businessLevel && BIZ_LEVEL_LABELS[node.businessLevel] && (
          <Badge
            variant={node.businessLevel === 'core' ? 'destructive' : node.businessLevel === 'important' ? 'default' : 'outline'}
            className="text-[10px]"
          >
            {BIZ_LEVEL_LABELS[node.businessLevel]}
          </Badge>
        )}
      </div>
    </div>
  )
}
