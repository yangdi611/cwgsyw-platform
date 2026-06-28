'use client'
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
  Handle, Position, NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ── Types ───────────────────────────────────────────────────────────────────

export type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged'

/**
 * Backend `TopologyNodeVO` (serialised via global SNAKE_CASE strategy).
 * `model_color` / `status` / `owner` / `key_attrs` are the Tier 3 additions.
 */
export interface TopologyNode {
  id: number
  name: string
  modelId: string | null
  modelName: string | null
  modelColor: string | null
  status: string | null
  owner: string | null
  isRoot: boolean
  keyAttrs: Record<string, unknown> | null
}

/** Backend `TopologyEdgeVO`: directed `src → dst` with a semantic `kind`. */
export interface TopologyEdge {
  src: number
  dst: number
  kind: string
  label: string
}

interface TopologyNodeData extends Record<string, unknown> {
  name: string
  modelId: string | null
  modelName: string | null
  modelColor: string | null
  status: string | null
  owner: string | null
  isRoot: boolean
  keyAttrs: Record<string, unknown> | null
  collapsed: boolean
  hasDownstream: boolean
  dimmed: boolean
  diffStatus: DiffStatus | null
  preview: boolean
}

// ── Colour helpers ───────────────────────────────────────────────────────────

function normalizeHex(c: string | null): string | null {
  if (!c) return null
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : null
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function mixHex(a: string, b: string, ratio: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio)
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255)
}

/** Deterministic colour derived from a seed string (model id / name). */
function hashHex(seed: string): string {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const hue = (h >>> 0) % 360
  return hslToHex(hue, 62, 58)
}

interface Palette { border: string; bg: string; text: string }

function resolvePalette(color: string | null, seed: string | null): Palette {
  const base = normalizeHex(color) ?? hashHex(seed ?? 'default')
  return {
    border: base,
    bg: mixHex(base, '#0f172a', 0.80),
    text: mixHex(base, '#ffffff', 0.30),
  }
}

// ── Status border + diff styling ─────────────────────────────────────────────

const STATUS_BORDER: Record<string, { border: string; style: string }> = {
  online:      { border: '#22c55e', style: 'solid' },
  running:     { border: '#22c55e', style: 'solid' },
  active:      { border: '#22c55e', style: 'solid' },
  offline:     { border: '#ef4444', style: 'dashed' },
  stopped:     { border: '#ef4444', style: 'dashed' },
  error:       { border: '#ef4444', style: 'dashed' },
  maintenance: { border: '#eab308', style: 'dashed' },
}

const STATUS_LABEL: Record<string, string> = {
  online: '在线', running: '运行中', active: '活跃', offline: '离线',
  stopped: '已停止', error: '异常', maintenance: '维护中',
}

const STATUS_DOT: Record<string, string> = {
  online: '#22c55e', running: '#22c55e', active: '#22c55e',
  offline: '#ef4444', stopped: '#ef4444', error: '#ef4444',
  maintenance: '#eab308',
}

const DIFF_NODE: Record<DiffStatus, { bg: string; border: string; borderStyle: string }> = {
  added:      { bg: '#14532d', border: '#22c55e', borderStyle: 'solid' },
  removed:    { bg: '#451a1f', border: '#ef4444', borderStyle: 'dashed' },
  modified:   { bg: '#45190f', border: '#eab308', borderStyle: 'solid' },
  unchanged:  { bg: '#1e293b', border: '#475569', borderStyle: 'solid' },
}

const DIFF_EDGE: Record<DiffStatus, { stroke: string; dashed: boolean }> = {
  added:     { stroke: '#22c55e', dashed: false },
  removed:   { stroke: '#ef4444', dashed: true },
  modified:  { stroke: '#eab308', dashed: false },
  unchanged: { stroke: '#475569', dashed: false },
}

const DIFF_BADGE: Record<DiffStatus, { label: string; cls: string }> = {
  added:     { label: '新增', cls: 'bg-green-500/20 text-green-300 border-green-500/40' },
  removed:   { label: '删除', cls: 'bg-red-500/20 text-red-300 border-red-500/40' },
  modified:  { label: '修改', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  unchanged: { label: '未变', cls: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
}

// ── Custom CI node ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color = STATUS_DOT[status]
  if (!color) return null
  return (
    <span
      title={STATUS_LABEL[status] ?? status}
      style={{ width: 7, height: 7, borderRadius: 999, background: color, display: 'inline-block' }}
    />
  )
}

function NodeTooltip({ d, palette }: { d: TopologyNodeData; palette: Palette }) {
  const statusLabel = d.status ? (STATUS_LABEL[d.status] ?? d.status) : null
  const keyAttrEntries = d.keyAttrs ? Object.entries(d.keyAttrs).slice(0, 6) : []
  return (
    <div className="hidden group-hover:block absolute z-50 left-0 top-full mt-2 pointer-events-none w-64 rounded-lg border bg-popover text-popover-foreground shadow-xl backdrop-blur p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: palette.border }} />
        <span className="font-semibold text-sm truncate">{d.name}</span>
      </div>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-v2-muted">模型</dt>
          <dd className="font-medium truncate">{d.modelName ?? d.modelId ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-v2-muted">状态</dt>
          <dd className="flex items-center gap-1.5 font-medium">
            {d.status && <StatusDot status={d.status} />}
            {statusLabel ?? '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-v2-muted">负责人</dt>
          <dd className="font-medium truncate">{d.owner ?? '—'}</dd>
        </div>
        {d.isRoot && (
          <div className="flex justify-between gap-2">
            <dt className="text-v2-muted">根节点</dt>
            <dd className="font-medium text-amber-500">是</dd>
          </div>
        )}
      </dl>
      {keyAttrEntries.length > 0 && (
        <div className="mt-2 pt-2 border-t">
          <p className="text-[11px] text-v2-muted mb-1">关键属性</p>
          <div className="grid grid-cols-1 gap-0.5 text-xs">
            {keyAttrEntries.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-v2-muted font-mono text-[11px]">{k}</span>
                <span className="font-medium truncate">{String(v ?? '—')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {d.diffStatus && (
        <div className={`mt-2 pt-2 border-t text-[11px] font-medium px-1.5 py-0.5 rounded border inline-block ${DIFF_BADGE[d.diffStatus].cls}`}>
          {DIFF_BADGE[d.diffStatus].label}
        </div>
      )}
    </div>
  )
}

function CiNode({ data }: NodeProps) {
  const d = data as TopologyNodeData
  const palette = resolvePalette(d.modelColor, d.modelId)

  const diffStyle = d.diffStatus ? DIFF_NODE[d.diffStatus] : null
  const statusStyle = d.status ? STATUS_BORDER[d.status] : null

  const borderColor = diffStyle?.border ?? statusStyle?.border ?? palette.border
  const borderStyle = diffStyle?.borderStyle ?? statusStyle?.style ?? 'solid'
  const bg = diffStyle?.bg ?? palette.bg
  const textColor = palette.text

  return (
    <div className="group relative" style={{ opacity: d.dimmed ? 0.25 : 1, transition: 'opacity 0.2s' }}>
      <div
        style={{
          background: bg,
          border: `2px ${borderStyle} ${borderColor}`,
          borderRadius: 8,
          padding: '6px 12px',
          minWidth: 130,
          boxShadow: d.isRoot ? `0 0 0 3px ${borderColor}55` : '0 1px 3px rgba(0,0,0,0.4)',
        }}
      >
        <Handle type="target" position={Position.Left} style={{ background: borderColor }} />
        <div className="flex items-center gap-1.5">
          {d.hasDownstream && (
            <span
              className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[11px] font-bold leading-none"
              style={{ background: borderColor, color: bg }}
              title={d.collapsed ? '点击展开下游' : '点击折叠下游'}
            >
              {d.collapsed ? '+' : '−'}
            </span>
          )}
          <span style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }} className="truncate max-w-[140px]">
            {d.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          {d.modelName && (
            <span
              style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: palette.border + '33', color: textColor, display: 'inline-block',
              }}
            >
              {d.modelName}
            </span>
          )}
          {d.status && <StatusDot status={d.status} />}
          {d.diffStatus && (
            <span
              className={`text-[9px] px-1 rounded border ${DIFF_BADGE[d.diffStatus].cls}`}
              style={{ lineHeight: '14px' }}
            >
              {DIFF_BADGE[d.diffStatus].label}
            </span>
          )}
        </div>
        <Handle type="source" position={Position.Right} style={{ background: borderColor }} />
      </div>
      {!d.preview && <NodeTooltip d={d} palette={palette} />}
    </div>
  )
}

const NODE_TYPES = { ciNode: CiNode }

// ── Graph helpers: downstream map + visibility + layout ──────────────────────

function buildDownstream(edges: TopologyEdge[]): Map<number, number[]> {
  const down = new Map<number, number[]>()
  edges.forEach(e => {
    if (!down.has(e.src)) down.set(e.src, [])
    down.get(e.src)!.push(e.dst)
  })
  return down
}

/** BFS from root, only traversing through nodes that are NOT collapsed. */
function computeVisible(
  rootId: number,
  down: Map<number, number[]>,
  collapsed: Set<number>,
  allIds: Set<number>,
): Set<number> {
  const visible = new Set<number>([rootId])
  const queue: number[] = [rootId]
  while (queue.length > 0) {
    const u = queue.shift()!
    if (collapsed.has(u)) continue
    for (const v of down.get(u) ?? []) {
      if (allIds.has(v) && !visible.has(v)) {
        visible.add(v)
        queue.push(v)
      }
    }
  }
  return visible
}

function layoutNodes(
  visibleIds: Set<number>,
  edges: TopologyEdge[],
  rootId: number,
): Map<number, { x: number; y: number }> {
  const levels = new Map<number, number>()
  const queue: number[] = [rootId]
  levels.set(rootId, 0)
  // directed BFS using only edges within the visible sub-graph
  while (queue.length > 0) {
    const cur = queue.shift()!
    const curLevel = levels.get(cur)!
    edges.forEach(e => {
      if (e.src !== cur) return
      if (!visibleIds.has(e.dst)) return
      if (!levels.has(e.dst)) {
        levels.set(e.dst, curLevel + 1)
        queue.push(e.dst)
      }
    })
  }
  // place any visible-but-unreached node at level 0 fallback (safety)
  visibleIds.forEach(id => { if (!levels.has(id)) levels.set(id, 0) })

  const byLevel = new Map<number, number[]>()
  levels.forEach((lv, id) => {
    if (!byLevel.has(lv)) byLevel.set(lv, [])
    byLevel.get(lv)!.push(id)
  })
  const pos = new Map<number, { x: number; y: number }>()
  byLevel.forEach((ids, lv) => {
    ids.forEach((id, i) => {
      pos.set(id, { x: lv * 230, y: (i - (ids.length - 1) / 2) * 120 })
    })
  })
  return pos
}

function edgeKey(e: { src: number; dst: number; kind: string }): string {
  return `${e.src}-${e.dst}-${e.kind}`
}

// ── Converters ───────────────────────────────────────────────────────────────

function toRFNodes(
  topoNodes: TopologyNode[],
  visibleIds: Set<number>,
  positions: Map<number, { x: number; y: number }>,
  down: Map<number, number[]>,
  collapsed: Set<number>,
  filterNodeIds: Set<number> | null,
  nodeDiffMap: Map<number, DiffStatus> | null,
  preview: boolean,
): Node[] {
  return topoNodes
    .filter(n => visibleIds.has(n.id))
    .map(n => ({
      id: String(n.id),
      type: 'ciNode',
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      data: {
        name: n.name,
        modelId: n.modelId,
        modelName: n.modelName,
        modelColor: n.modelColor,
        status: n.status,
        owner: n.owner,
        isRoot: n.isRoot,
        keyAttrs: n.keyAttrs,
        collapsed: collapsed.has(n.id),
        hasDownstream: (down.get(n.id)?.length ?? 0) > 0,
        dimmed: filterNodeIds ? !filterNodeIds.has(n.id) : false,
        diffStatus: nodeDiffMap ? (nodeDiffMap.get(n.id) ?? null) : null,
        preview,
      } as TopologyNodeData,
    }))
}

function toRFEdges(
  edges: TopologyEdge[],
  visibleIds: Set<number>,
  edgeDiffMap: Map<string, DiffStatus> | null,
): Edge[] {
  return edges
    .filter(e => visibleIds.has(e.src) && visibleIds.has(e.dst))
    .map(e => {
      const status = edgeDiffMap ? edgeDiffMap.get(edgeKey(e)) : null
      const style = status ? DIFF_EDGE[status] : null
      return {
        id: `${e.src}-${e.dst}-${e.kind}`,
        source: String(e.src),
        target: String(e.dst),
        label: e.label || undefined,
        markerEnd: { type: MarkerType.ArrowClosed, color: style?.stroke ?? '#64748b' },
        style: {
          stroke: style?.stroke ?? '#475569',
          strokeWidth: status === 'removed' || status === 'added' ? 2 : 1.5,
          strokeDasharray: style?.dashed ? '6 4' : undefined,
        },
        labelStyle: { fontSize: 10, fill: '#94a3b8' },
        labelBgStyle: { fill: '#1e293b' },
      }
    })
}

// ── Main component ───────────────────────────────────────────────────────────

interface CiTopologyGraphProps {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  rootId: number
  preview?: boolean
  onNodeClick?: (node: TopologyNode) => void
  /** When set, nodes whose id is NOT in the set are dimmed (opacity 0.25). */
  filterNodeIds?: Set<number> | null
  /** Compare mode: per-node diff status. */
  nodeDiffMap?: Map<number, DiffStatus> | null
  /** Compare mode: per-edge diff status (key: `${src}-${dst}-${kind}`). */
  edgeDiffMap?: Map<string, DiffStatus> | null
}

export const CiTopologyGraph = forwardRef<HTMLDivElement, CiTopologyGraphProps>(
  function CiTopologyGraph({
    nodes: topoNodes,
    edges: topoEdges,
    rootId,
    preview = false,
    onNodeClick,
    filterNodeIds = null,
    nodeDiffMap = null,
    edgeDiffMap = null,
  }, ref) {
    const down = useMemo(() => buildDownstream(topoEdges), [topoEdges])
    const allIds = useMemo(() => new Set(topoNodes.map(n => n.id)), [topoNodes])

    const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set())
    // reset collapse state whenever the underlying graph changes
    useEffect(() => { setCollapsedIds(new Set()) }, [topoNodes, topoEdges])

    const visibleIds = useMemo(
      () => computeVisible(rootId, down, collapsedIds, allIds),
      [rootId, down, collapsedIds, allIds],
    )

    const positions = useMemo(
      () => layoutNodes(visibleIds, topoEdges, rootId),
      [visibleIds, topoEdges, rootId],
    )

    const rfNodes = useMemo(
      () => toRFNodes(topoNodes, visibleIds, positions, down, collapsedIds, filterNodeIds, nodeDiffMap, preview),
      [topoNodes, visibleIds, positions, down, collapsedIds, filterNodeIds, nodeDiffMap, preview],
    )
    const rfEdges = useMemo(
      () => toRFEdges(topoEdges, visibleIds, edgeDiffMap),
      [topoEdges, visibleIds, edgeDiffMap],
    )

    const [stateNodes, setRfNodes, onNodesChange] = useNodesState(rfNodes)
    const [stateEdges, setRfEdges, onEdgesChange] = useEdgesState(rfEdges)

    useEffect(() => {
      setRfNodes(rfNodes)
      setRfEdges(rfEdges)
    }, [rfNodes, rfEdges, setRfNodes, setRfEdges])

    const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
      const id = Number(node.id)
      const orig = topoNodes.find(n => n.id === id)
      // expand / collapse downstream (only if the node has children)
      if (orig && (down.get(id)?.length ?? 0) > 0) {
        setCollapsedIds(prev => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
      }
      if (onNodeClick && orig) onNodeClick(orig)
    }, [onNodeClick, topoNodes, down])

    return (
      <div ref={ref} style={{ height: preview ? 280 : '100%', width: '100%', background: '#0f172a', borderRadius: 8 }}>
        <ReactFlow
          nodes={stateNodes}
          edges={stateEdges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          panOnDrag={!preview}
          zoomOnScroll={!preview}
          zoomOnPinch={!preview}
          panOnScroll={false}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.1}
          maxZoom={2}
          colorMode="dark"
        >
          <Background color="#1e293b" gap={20} />
          {!preview && <Controls />}
          {!preview && (
            <MiniMap
              nodeColor={n => {
                const d = n.data as TopologyNodeData
                if (d.diffStatus) return DIFF_NODE[d.diffStatus].border
                return resolvePalette(d.modelColor, d.modelId).border
              }}
              maskColor="rgba(0,0,0,0.4)"
            />
          )}
        </ReactFlow>
      </div>
    )
  },
)
