// changedoc-owned CI types — decoupled from cmdb types
// Used by ci_selector in new page and topology rendering

export interface CiRecord {
  id: number
  name: string
  modelId: string
  modelName: string
}

export interface CiSearchResult {
  records: CiRecord[]
  total: number
}

export interface TopoNode {
  id: number
  name: string
  modelId: string | null
  modelName: string | null
  isRoot: boolean
}

export interface TopoEdge {
  id: number
  srcId: number
  dstId: number
  label: string
  defId: string
}

export interface CiTopologyResult {
  nodes: TopoNode[]
  edges: TopoEdge[]
}
