'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/v2/Input'
import Link from 'next/link'
import { ArrowLeft, GitCompare, Loader2 } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import {
  CiTopologyGraph, TopologyNode, TopologyEdge, DiffStatus,
} from '@/components/cmdb/CiTopologyGraph'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

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

// AC10 (Issue #64): 拓扑对比从 /cmdb/topology/[instanceId] 的内嵌模式分离为独立子路由，
// 职责单一——仅做两个时间点之间的拓扑差异对比。
export default function TopologyComparePage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()

  const [fromTime, setFromTime] = useState('')
  const [toTime, setToTime] = useState('')
  const [compareDepth, setCompareDepth] = useState(3)
  const [compareNonce, setCompareNonce] = useState(0)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

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
    enabled: compareNonce > 0 && !!fromTime && !!toTime,
  })

  const graphInput = useMemo(() => {
    if (compareQuery.data) return mergeCompare(compareQuery.data)
    return { nodes: [], edges: [], nodeDiffMap: null, edgeDiffMap: null }
  }, [compareQuery.data])

  const rootNode = graphInput.nodes.find(n => n.is_root)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background flex-shrink-0 flex-wrap">
        <Link
          href={`/cmdb/topology/${instanceId}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />返回拓扑图
        </Link>
        <div className="flex-1 min-w-[160px]">
          <span className="font-semibold text-sm">
            {rootNode?.name ?? `#${instanceId}`} 的拓扑对比
          </span>
          <span className="text-xs text-v2-muted ml-2">
            选择起止日期后开始对比
          </span>
        </div>
      </div>

      {/* Compare controls */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 flex-wrap">
        <span className="text-xs text-v2-muted">起始日期</span>
        <Input type="date" value={fromTime} onChange={e => setFromTime(e.target.value)} className="w-40 h-8" />
        <span className="text-xs text-v2-muted">截止日期</span>
        <Input type="date" value={toTime} onChange={e => setToTime(e.target.value)} className="w-40 h-8" />
        <span className="text-xs text-v2-muted">深度</span>
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

      {/* Graph */}
      <div className="flex-1 overflow-hidden relative">
        {compareQuery.isFetching ? (
          <div className="flex items-center justify-center h-full text-v2-muted text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />加载中...
          </div>
        ) : compareQuery.isError ? (
          <div className="flex items-center justify-center h-full text-v2-danger text-sm">
            对比失败，请检查时间范围与深度
          </div>
        ) : !graphInput.nodes.length ? (
          <div className="flex items-center justify-center h-full text-v2-muted text-sm">
            点击「开始对比」生成差异拓扑
          </div>
        ) : (
          <CiTopologyGraph
            nodes={graphInput.nodes}
            edges={graphInput.edges}
            rootId={Number(instanceId)}
            preview={false}
            nodeDiffMap={graphInput.nodeDiffMap}
            edgeDiffMap={graphInput.edgeDiffMap}
          />
        )}
      </div>
    </div>
  )
}
