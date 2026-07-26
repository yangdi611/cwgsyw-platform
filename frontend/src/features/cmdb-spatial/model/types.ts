export type SpatialElementType = 'ROOM_OUTLINE' | 'WALL' | 'DOOR' | 'RACK_ROW' | 'RACK_SLOT' | 'AISLE' | 'ZONE' | 'FACILITY' | 'TEXT'
export const FACILITY_TYPES = ['AIR_CONDITIONER', 'UPS', 'POWER_DISTRIBUTION', 'PDU', 'FRESH_AIR', 'FIRE_PROTECTION', 'GENERAL'] as const
export type SpatialFacilityType = typeof FACILITY_TYPES[number]
export const FACILITY_TYPE_LABELS: Record<SpatialFacilityType, string> = {
  AIR_CONDITIONER: '空调',
  UPS: 'UPS',
  POWER_DISTRIBUTION: '配电柜',
  PDU: 'PDU',
  FRESH_AIR: '新风机',
  FIRE_PROTECTION: '消防设施',
  GENERAL: '通用设施',
}
export type SpatialGeometry =
  | { kind: 'RECT'; x: number; y: number; width: number; height: number; rotation?: number }
  | { kind: 'POLYGON' | 'LINE'; points: Array<[number, number]> }

export interface SpatialElement {
  id: string
  type: SpatialElementType
  name?: string
  geometry: SpatialGeometry
  rack?: { rowCode?: string; positionNo?: string; slotState?: 'EMPTY' | 'RESERVED' | 'OCCUPIED' | 'DISABLED' }
  zone?: { color?: string; opacity?: number }
  facility?: { facilityType?: SpatialFacilityType }
  door?: { edgeElementId?: string; segmentIndex?: number; position?: number; style?: 'SINGLE' | 'DOUBLE'; swing?: 'LEFT' | 'RIGHT'; direction?: 'INWARD' | 'OUTWARD' }
  binding?: { ciInstanceId?: number }
  text?: string
  locked?: boolean
  zIndex?: number
}

export interface SpatialDocument {
  schemaVersion: 1
  canvas: { logicalWidth: number; logicalHeight: number; gridSize?: number; backgroundColor?: string }
  reference?: { assetId?: number; visibleInPublishedView?: boolean; opacity?: number; locked?: boolean; transform?: RectGeometry }
  elements: SpatialElement[]
  extensions?: Record<string, unknown>
}

export interface RectGeometry { x: number; y: number; width: number; height: number; rotation?: number }

export interface SpatialLayoutSummary {
  layoutId: number
  roomInstanceId: number
  name: string
  status: 'ACTIVE' | 'ARCHIVED'
  draftVersionId: number | null
  publishedVersionId: number | null
  updatedAt: string | null
}

export interface SpatialRoom { roomInstanceId: number; name: string; configured: boolean; layoutId: number | null }

export interface SpatialLayoutVersion {
  versionId: string
  layoutId: number
  state: 'DRAFT' | 'PUBLISHED'
  versionNo: number | null
  revision: number
  schemaVersion: number
  document: SpatialDocument
  checksum: string
  elementCount: number
  sourceVersionId: string | null
  changeSummary: string | null
  publishedAt: string | null
  updatedAt: string | null
}

export interface SpatialRuntimeElement {
  ciInstanceId: number | null
  ciName: string | null
  ciModelId: string | null
  ciStatus: string | null
  activeAlertCount: number
  highestSeverity: string | null
  rack: { heightU: number; usedU: number; freeU: number; deviceCount: number } | null
  qualityIssues: string[]
}

export interface SpatialRuntime {
  layoutId: number
  publishedVersionId: number
  generatedAt: string
  elements: Record<string, SpatialRuntimeElement>
  partial: boolean
}

export interface SpatialCandidate { ciInstanceId: number; name: string; modelId: string; status: string; bound: boolean }
export interface SpatialValidationIssue { code: string; elementId: string | null; path: string; message: string }
export interface SpatialValidationResult { revision: number; valid: boolean; errors: SpatialValidationIssue[]; warnings: SpatialValidationIssue[] }
export interface SpatialLocateResult { roomInstanceId: number; roomName: string; layoutId: number; publishedVersionId: number; elementId: string; targetCiInstanceId: number; targetCiName: string; targetModelId: string; rackCiInstanceId: number; rackName: string; pathLabel: string }
