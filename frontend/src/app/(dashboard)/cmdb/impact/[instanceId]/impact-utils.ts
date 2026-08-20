export interface ImpactLayer { depth: number; nodes: Array<{ id: number }> }
export interface ImpactEdge { src: number; dst: number; kind: string; label?: string }

function pushEdge(m: Map<number, ImpactEdge[]>, nodeId: number, edge: ImpactEdge) {
  const current = m.get(nodeId)
  if (current) {
    if (!current.some((item) => item.src === edge.src && item.dst === edge.dst && item.kind === edge.kind)) current.push(edge)
  } else {
    m.set(nodeId, [edge])
  }
}

export function buildImmediateIncomingEdges(layers: ImpactLayer[], edges: ImpactEdge[]) {
  const depthByNode = new Map<number, number>()
  layers.forEach((layer) => layer.nodes.forEach((node) => depthByNode.set(node.id, layer.depth)))

  const incoming = new Map<number, ImpactEdge[]>()
  edges.forEach((edge) => {
    const sourceDepth = depthByNode.get(edge.src)
    const targetDepth = depthByNode.get(edge.dst)
    if (sourceDepth == null || targetDepth == null) return

    if (targetDepth === sourceDepth + 1) pushEdge(incoming, edge.dst, edge)
    if (sourceDepth === targetDepth + 1) pushEdge(incoming, edge.src, edge)
  })
  return incoming
}

export function summarizeImpactEdges(edges: ImpactEdge[]) {
  const summaries = new Map<string, { label: string; count: number }>()
  edges.forEach((edge) => {
    const label = edge.label?.trim() || edge.kind
    const current = summaries.get(label)
    if (current) current.count += 1
    else summaries.set(label, { label, count: 1 })
  })
  return Array.from(summaries.values())
}
