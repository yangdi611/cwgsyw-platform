'use client'
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
  Handle, Position, NodeProps, NodeToolbar,
} from '@xyflow/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import '@xyflow/react/dist/style.css'
import { CANVAS_NEUTRAL, CANVAS_STATUS } from '@/design-system/figma-neutral/canvas-tokens'
import { Button } from '@/design-system/figma-neutral/components'

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

function resolvePalette(_color: string | null, _seed: string | null): Palette {
  return {
    border: 'var(--cwgsyw-border-strong)',
    bg: 'var(--cwgsyw-bg-surface)',
    text: 'var(--cwgsyw-text-primary)',
  }
}

// ── Status border + diff styling ─────────────────────────────────────────────

const STATUS_BORDER: Record<string, { border: string; style: string }> = {
  online:      { border: CANVAS_STATUS.success, style: 'solid' },
  running:     { border: CANVAS_STATUS.success, style: 'solid' },
  active:      { border: CANVAS_STATUS.success, style: 'solid' },
  offline:     { border: CANVAS_STATUS.danger, style: 'dashed' },
  stopped:     { border: CANVAS_STATUS.danger, style: 'dashed' },
  error:       { border: CANVAS_STATUS.danger, style: 'dashed' },
  maintenance: { border: CANVAS_STATUS.warning, style: 'dashed' },
}

const STATUS_LABEL: Record<string, string> = {
  online: '在线', running: '运行中', active: '活跃', offline: '离线',
  stopped: '已停止', error: '异常', maintenance: '维护中',
}

const STATUS_DOT: Record<string, string> = {
  online: CANVAS_STATUS.success, running: CANVAS_STATUS.success, active: CANVAS_STATUS.success,
  offline: CANVAS_STATUS.danger, stopped: CANVAS_STATUS.danger, error: CANVAS_STATUS.danger,
  maintenance: CANVAS_STATUS.warning,
}

const DIFF_NODE: Record<DiffStatus, { bg: string; border: string; text: string; borderStyle: string }> = {
  added: {
    bg: 'var(--cwgsyw-status-success-bg)',
    border: 'var(--cwgsyw-status-success-fg)',
    text: 'var(--cwgsyw-status-success-fg)',
    borderStyle: 'solid',
  },
  removed: {
    bg: 'var(--cwgsyw-status-danger-bg)',
    border: 'var(--cwgsyw-status-danger-fg)',
    text: 'var(--cwgsyw-status-danger-fg)',
    borderStyle: 'dashed',
  },
  modified: {
    bg: 'var(--cwgsyw-status-warning-bg)',
    border: 'var(--cwgsyw-status-warning-fg)',
    text: 'var(--cwgsyw-status-warning-fg)',
    borderStyle: 'solid',
  },
  unchanged: {
    bg: 'var(--cwgsyw-bg-surface)',
    border: 'var(--cwgsyw-border-strong)',
    text: 'var(--cwgsyw-text-primary)',
    borderStyle: 'solid',
  },
}

const DIFF_EDGE: Record<DiffStatus, { stroke: string; dashed: boolean }> = {
  added:     { stroke: CANVAS_STATUS.success, dashed: false },
  removed:   { stroke: CANVAS_STATUS.danger, dashed: true },
  modified:  { stroke: CANVAS_STATUS.warning, dashed: false },
  unchanged: { stroke: CANVAS_NEUTRAL[600], dashed: false },
}

const DIFF_BADGE: Record<DiffStatus, { label: string; cls: string }> = {
  added:     { label: '新增', cls: 'cwgsyw-type-label-sm' },
  removed:   { label: '删除', cls: 'cwgsyw-type-label-sm' },
  modified:  { label: '修改', cls: 'cwgsyw-type-label-sm' },
  unchanged: { label: '未变', cls: 'cwgsyw-type-label-sm' },
}

const COLLAPSED_KEY_ATTR_LIMIT = 6
const COLLAPSED_POPOVER_WIDTH = 184
const EXPANDED_POPOVER_WIDTH = 376
const POPOVER_EXPAND_TRANSITION = { type: 'spring', stiffness: 180, damping: 26, bounce: 0 } as const

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

interface NodeTooltipProps {
  d: TopologyNodeData
  palette: Palette
  visible: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function NodeTooltip({ d, palette, visible, onMouseEnter, onMouseLeave }: NodeTooltipProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const statusLabel = d.status ? (STATUS_LABEL[d.status] ?? d.status) : null
  const keyAttrEntries = d.keyAttrs ? Object.entries(d.keyAttrs) : []
  const visibleKeyAttrEntries = keyAttrEntries.slice(0, COLLAPSED_KEY_ATTR_LIMIT)
  const extraKeyAttrEntries = keyAttrEntries.slice(COLLAPSED_KEY_ATTR_LIMIT)

  const toggleExpanded = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setIsExpanded((expanded) => !expanded)
  }

  return (
    <NodeToolbar
      isVisible={visible}
      position={Position.Bottom}
      align="start"
      offset={8}
      className="cwgsyw-topology-node-popover-anchor nodrag nopan nowheel"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <motion.div
        className={`cwgsyw-popover cwgsyw-popover--hover cwgsyw-topology-node-popover${isExpanded ? ' is-expanded' : ''}`}
        initial={false}
        animate={{ width: isExpanded ? EXPANDED_POPOVER_WIDTH : COLLAPSED_POPOVER_WIDTH }}
        transition={prefersReducedMotion ? { duration: 0 } : POPOVER_EXPAND_TRANSITION}
      >
        <div className="cwgsyw-topology-node-popover__header flex items-center gap-2">
          <span className="cwgsyw-topology-node-popover__marker flex-shrink-0" style={{ background: palette.border }} />
          <span className="cwgsyw-topology-node-popover__title">{d.name}</span>
        </div>
        <dl className="cwgsyw-topology-node-popover__list">
          <div>
            <dt className="cwgsyw-type-label-sm">模型</dt>
            <dd>{d.modelName ?? d.modelId ?? '—'}</dd>
          </div>
          <div>
            <dt className="cwgsyw-type-label-sm">状态</dt>
            <dd className="flex items-center gap-1.5">
              {d.status && <StatusDot status={d.status} />}
              {statusLabel ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="cwgsyw-type-label-sm">负责人</dt>
            <dd>{d.owner ?? '—'}</dd>
          </div>
          {d.isRoot && (
            <div>
              <dt className="cwgsyw-type-label-sm">根节点</dt>
              <dd className="text-[var(--cwgsyw-status-warning-fg)]">是</dd>
            </div>
          )}
        </dl>
        {visibleKeyAttrEntries.length > 0 && (
          <div className="cwgsyw-topology-node-popover__attrs">
            <p className="cwgsyw-type-label-sm">关键属性</p>
            <div className={`cwgsyw-topology-node-popover__attr-columns${isExpanded ? ' is-expanded' : ''}`}>
              <div className="cwgsyw-topology-node-popover__attr-list">
                {visibleKeyAttrEntries.map(([k, v]) => (
                  <div key={k}>
                    <span className="cwgsyw-type-label-sm font-mono">{k}</span>
                    <span>{String(v ?? '—')}</span>
                  </div>
                ))}
              </div>
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    className="cwgsyw-topology-node-popover__attr-list cwgsyw-topology-node-popover__attr-list--extra"
                    initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                    transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
                  >
                    {extraKeyAttrEntries.map(([k, v]) => (
                      <div key={k}>
                        <span className="cwgsyw-type-label-sm font-mono">{k}</span>
                        <span>{String(v ?? '—')}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {extraKeyAttrEntries.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="cwgsyw-topology-node-popover__expand"
                aria-expanded={isExpanded}
                onClick={toggleExpanded}
              >
                {isExpanded ? '收起' : `查看全部（${keyAttrEntries.length}）`}
              </Button>
            )}
          </div>
        )}
        {d.diffStatus && (
          <div className={`cwgsyw-topology-node-popover__diff ${DIFF_BADGE[d.diffStatus].cls}`}>
            {DIFF_BADGE[d.diffStatus].label}
          </div>
        )}
      </motion.div>
    </NodeToolbar>
  )
}

function CiNode({ data }: NodeProps) {
  const d = data as TopologyNodeData
  const [isHovered, setIsHovered] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const palette = resolvePalette(d.modelColor, d.modelId)

  const keepTooltipOpen = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
    setIsHovered(true)
  }, [])

  const scheduleTooltipClose = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setIsHovered(false)
      hideTimerRef.current = null
    }, 150)
  }, [])

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }, [])

  const diffStyle = d.diffStatus ? DIFF_NODE[d.diffStatus] : null
  const statusStyle = d.status ? STATUS_BORDER[d.status] : null

  const borderColor = diffStyle?.border ?? statusStyle?.border ?? palette.border
  const bg = palette.bg
  const textColor = palette.text

  return (
    <div
      className="cwgsyw-topology-node relative"
      onMouseEnter={keepTooltipOpen}
      onMouseLeave={scheduleTooltipClose}
      style={{ opacity: d.dimmed ? 0.25 : 1, transition: 'opacity 0.2s' }}
    >
      <div
        className="cwgsyw-topology-node__frame"
        style={{
          background: bg,
          border: 'var(--cwgsyw-border-width-default) solid var(--cwgsyw-border-subtle)',
          color: textColor,
          '--cwgsyw-topology-node-accent': borderColor,
        } as React.CSSProperties}
      >
        <Handle type="target" position={Position.Left} className="cwgsyw-topology-node__handle" style={{ background: borderColor }} />
        <div className="cwgsyw-topology-node__title-row flex items-center">
          {d.hasDownstream && (
            <span
              className="cwgsyw-topology-node__toggle flex-shrink-0 rounded-full flex items-center justify-center leading-none"
              style={{ background: borderColor, color: bg }}
              title={d.collapsed ? '点击展开下游' : '点击折叠下游'}
            >
              {d.collapsed ? '+' : '−'}
            </span>
          )}
          <span className="cwgsyw-topology-node__title truncate">
            {d.name}
          </span>
        </div>
        <div className="cwgsyw-topology-node__meta flex items-center">
          {d.modelName && (
            <span className="cwgsyw-topology-node__model">
              {d.modelName}
            </span>
          )}
          {d.status && <StatusDot status={d.status} />}
          {d.diffStatus && (
            <span
              className={`cwgsyw-topology-node__diff ${DIFF_BADGE[d.diffStatus].cls}`}
              style={{ color: borderColor }}
            >
              {DIFF_BADGE[d.diffStatus].label}
            </span>
          )}
        </div>
        <Handle type="source" position={Position.Right} className="cwgsyw-topology-node__handle" style={{ background: borderColor }} />
      </div>
      {!d.preview && isHovered && (
        <NodeTooltip
          d={d}
          palette={palette}
          visible={isHovered}
          onMouseEnter={keepTooltipOpen}
          onMouseLeave={scheduleTooltipClose}
        />
      )}
    </div>
  )
}

const NODE_TYPES = { ciNode: CiNode }

// ── Graph helpers: downstream map + visibility + layout ──────────────────────

function buildDownstream(edges: TopologyEdge[]): Map<number, number[]> {
  const neighbors = new Map<number, number[]>()
  edges.forEach(e => {
    if (!neighbors.has(e.src)) neighbors.set(e.src, [])
    if (!neighbors.has(e.dst)) neighbors.set(e.dst, [])
    neighbors.get(e.src)!.push(e.dst)
    neighbors.get(e.dst)!.push(e.src)  // Bidirectional: add reverse edge
  })
  return neighbors
}

/** BFS from root, only traversing through nodes that are NOT collapsed. */
function computeVisible(
  rootId: number,
  neighbors: Map<number, number[]>,
  collapsed: Set<number>,
  allIds: Set<number>,
): Set<number> {
  const visible = new Set<number>([rootId])
  const queue: number[] = [rootId]
  while (queue.length > 0) {
    const u = queue.shift()!
    if (collapsed.has(u)) continue
    for (const v of neighbors.get(u) ?? []) {
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
  // bidirectional BFS using only edges within the visible sub-graph
  while (queue.length > 0) {
    const cur = queue.shift()!
    const curLevel = levels.get(cur)!
    edges.forEach(e => {
      // Check both directions: cur as src or dst
      let peer: number | null = null
      if (e.src === cur) peer = e.dst
      else if (e.dst === cur) peer = e.src
      if (peer === null) return
      if (!visibleIds.has(peer)) return
      if (!levels.has(peer)) {
        levels.set(peer, curLevel + 1)
        queue.push(peer)
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
  neighbors: Map<number, number[]>,
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
        hasDownstream: (neighbors.get(n.id)?.length ?? 0) > 0,
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
        markerEnd: { type: MarkerType.ArrowClosed, color: style?.stroke ?? CANVAS_NEUTRAL[500] },
        style: {
          stroke: style?.stroke ?? CANVAS_NEUTRAL[600],
          strokeWidth: status === 'removed' || status === 'added' ? 2 : 1.5,
          strokeDasharray: style?.dashed ? '6 4' : undefined,
        },
        labelStyle: { fontSize: 10, fill: 'var(--cwgsyw-text-secondary)' },
        labelBgStyle: { fill: 'var(--cwgsyw-bg-surface)' },
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
    const neighbors = useMemo(() => buildDownstream(topoEdges), [topoEdges])
    const allIds = useMemo(() => new Set(topoNodes.map(n => n.id)), [topoNodes])

    const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set())
    // reset collapse state whenever the underlying graph changes
    useEffect(() => {
      // Graph replacement invalidates collapse IDs from the previous graph.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsedIds(new Set())
    }, [topoNodes, topoEdges])

    const visibleIds = useMemo(
      () => computeVisible(rootId, neighbors, collapsedIds, allIds),
      [rootId, neighbors, collapsedIds, allIds],
    )

    const positions = useMemo(
      () => layoutNodes(visibleIds, topoEdges, rootId),
      [visibleIds, topoEdges, rootId],
    )

    const rfNodes = useMemo(
      () => toRFNodes(topoNodes, visibleIds, positions, neighbors, collapsedIds, filterNodeIds, nodeDiffMap, preview),
      [topoNodes, visibleIds, positions, neighbors, collapsedIds, filterNodeIds, nodeDiffMap, preview],
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
      if (orig && (neighbors.get(id)?.length ?? 0) > 0) {
        setCollapsedIds(prev => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
      }
      if (onNodeClick && orig) onNodeClick(orig)
    }, [onNodeClick, topoNodes, neighbors])

    return (
      <div ref={ref} className="cwgsyw-topology-graph">
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
          fitViewOptions={{ padding: 0.35, maxZoom: 1 }}
          minZoom={0.1}
          maxZoom={1.5}
          colorMode="light"
        >
          <Background color="var(--cwgsyw-border-strong)" gap={18} size={1} />
          {!preview && <Controls />}
          {!preview && (
            <MiniMap
              nodeColor={n => {
                const d = n.data as TopologyNodeData
                if (d.diffStatus) return DIFF_NODE[d.diffStatus].border
                return resolvePalette(d.modelColor, d.modelId).border
              }}
              maskColor="rgba(115, 115, 115, 0.16)"
            />
          )}
        </ReactFlow>
      </div>
    )
  },
)
