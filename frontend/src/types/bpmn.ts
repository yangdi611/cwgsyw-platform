export interface BpmnBusinessObjectLike {
  $type?: string
  get: (name: string) => unknown
}

export interface BpmnElementLike {
  businessObject?: BpmnBusinessObjectLike
}

export interface BpmnCanvasLike {
  zoom: (mode: 'fit-viewport') => number
  resized: () => void
}

export interface BpmnFactoryLike {
  create: (type: string, attributes?: Record<string, unknown>) => BpmnBusinessObjectLike
}

export interface BpmnModelingLike {
  updateModdleProperties: (
    element: BpmnElementLike,
    businessObject: BpmnBusinessObjectLike,
    properties: Record<string, unknown>
  ) => void
}

export interface BpmnSelectionLike {
  get: () => BpmnElementLike[]
}

export interface BpmnEditorServices {
  bpmnFactory: BpmnFactoryLike
  canvas: BpmnCanvasLike
  modeling: BpmnModelingLike
  selection: BpmnSelectionLike
}

export interface BpmnOverlayLike {
  add: (
    elementId: string,
    config: {
      position: { top: number; left: number }
      html: string
    }
  ) => void
}

export interface BpmnElementRegistryLike {
  get: (elementId: string) => unknown
}

export interface BpmnViewerServices {
  canvas: BpmnCanvasLike
  elementRegistry: BpmnElementRegistryLike
  overlays: BpmnOverlayLike
}

export function isBpmnBusinessObject(value: unknown): value is BpmnBusinessObjectLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'get' in value &&
    typeof value.get === 'function'
  )
}

export function isBpmnElement(value: unknown): value is BpmnElementLike {
  if (typeof value !== 'object' || value === null || !('businessObject' in value)) {
    return false
  }

  return value.businessObject === undefined || isBpmnBusinessObject(value.businessObject)
}
