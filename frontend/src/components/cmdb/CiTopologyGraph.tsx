'use client'
import { useEffect, useCallback } from 'react'
import {
  ReactFlow,
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
  Handle, Position, NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ── Types ───────────────────────────────────────────────────────────────────

export interface TopologyNodeData extends Record<string, unknown> {
  name: string
  modelId: string | null
  modelName: string | null
  isRoot: boolean
}

export interface TopologyNode {
  id: number
  name: string
  model_id: string | null
  model_name: string | null
  is_root: boolean
}

export interface TopologyEdge {
  id: number
  src_id: number
  dst_id: number
  label: string
  def_id: string
}

// ── Color palette by model_id ────────────────────────────────────────────────

const MODEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  host:    { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  app:     { bg: '#1e3f2a', border: '#22c55e', text: '#86efac' },
  default: { bg: '#1e293b', border: '#64748b', text: '#94a3b8' },
}
function modelColor(modelId: string | null) {
  if (!modelId) return MODEL_COLORS.default
  return MODEL_COLORS[modelId] ?? MODEL_COLORS.default
}

// ── Custom CI node ───────────────────────────────────────────────────────────

function CiNode({ data }: NodeProps) {
  const d = data as TopologyNodeData
  const c = modelColor(d.modelId)
  return (
    <div
      style={{
        background: c.bg,
        border: `2px solid ${d.isRoot ? '#f59e0b' : c.border}`,
        borderRadius: 8,
        padding: '6px 12px',
        minWidth: 120,
        boxShadow: d.isRoot ? '0 0 0 3px rgba(245,158,11,0.3)' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: c.border }} />
      <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{d.name}</div>
      {d.modelName && (
        <div style={{
          fontSize: 10, marginTop: 2, padding: '1px 6px', borderRadius: 4,
          background: c.border + '33', color: c.text, display: 'inline-block',
        }}>
          {d.modelName}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: c.border }} />
    </div>
  )
}

const NODE_TYPES = { ciNode: CiNode }

// ── Auto-layout: BFS-level based left-to-right ───────────────────────────────

function layoutNodes(
  topoNodes: TopologyNode[],
  topoEdges: TopologyEdge[],
  rootId: number,
): Map<number, { x: number; y: number }> {
  const levels = new Map<number, number>()
  const queue: number[] = [rootId]
  levels.set(rootId, 0)
  while (queue.length > 0) {
    const cur = queue.shift()!
    const curLevel = levels.get(cur)!
    topoEdges.forEach(e => {
      const peer = e.src_id === cur ? e.dst_id : e.src_id
      if (!levels.has(peer)) { levels.set(peer, curLevel + 1); queue.push(peer) }
    })
  }
  const byLevel = new Map<number, number[]>()
  levels.forEach((lv, id) => {
    if (!byLevel.has(lv)) byLevel.set(lv, [])
    byLevel.get(lv)!.push(id)
  })
  const pos = new Map<number, { x: number; y: number }>()
  byLevel.forEach((ids, lv) => {
    ids.forEach((id, i) => {
      pos.set(id, { x: lv * 220, y: (i - (ids.length - 1) / 2) * 110 })
    })
  })
  return pos
}

// ── Converters ───────────────────────────────────────────────────────────────

function toRFNodes(topoNodes: TopologyNode[], positions: Map<number, { x: number; y: number }>): Node[] {
  return topoNodes.map(n => ({
    id: String(n.id),
    type: 'ciNode',
    position: positions.get(n.id) ?? { x: 0, y: 0 },
    data: { name: n.name, modelId: n.model_id, modelName: n.model_name, isRoot: n.is_root } as TopologyNodeData,
  }))
}

function toRFEdges(topoEdges: TopologyEdge[]): Edge[] {
  return topoEdges.map(e => ({
    id: String(e.id),
    source: String(e.src_id),
    target: String(e.dst_id),
    label: e.label || undefined,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
    style: { stroke: '#475569' },
    labelStyle: { fontSize: 10, fill: '#94a3b8' },
    labelBgStyle: { fill: '#1e293b' },
  }))
}

// ── Main component ───────────────────────────────────────────────────────────

interface CiTopologyGraphProps {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  rootId: number
  preview?: boolean
  onNodeClick?: (node: TopologyNode) => void
}

export function CiTopologyGraph({
  nodes: topoNodes, edges: topoEdges, rootId, preview = false, onNodeClick,
}: CiTopologyGraphProps) {
  const positions = layoutNodes(topoNodes, topoEdges, rootId)
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(toRFNodes(topoNodes, positions))
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(toRFEdges(topoEdges))

  useEffect(() => {
    const pos = layoutNodes(topoNodes, topoEdges, rootId)
    setRfNodes(toRFNodes(topoNodes, pos))
    setRfEdges(toRFEdges(topoEdges))
  }, [topoNodes, topoEdges, rootId])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (onNodeClick) {
      const orig = topoNodes.find(n => String(n.id) === node.id)
      if (orig) onNodeClick(orig)
    }
  }, [onNodeClick, topoNodes])

  return (
    <div style={{ height: preview ? 280 : '100%', width: '100%', background: '#0f172a', borderRadius: 8 }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
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
        minZoom={0.3}
        maxZoom={2}
        colorMode="dark"
      >
        <Background color="#1e293b" gap={20} />
        {!preview && <Controls />}
        {!preview && <MiniMap nodeColor={() => '#334155'} maskColor="rgba(0,0,0,0.4)" />}
      </ReactFlow>
    </div>
  )
}
