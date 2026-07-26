import type { RectGeometry, SpatialElement } from './types'

export const CANVAS_PADDING = 32

export function rectToPixels(rect: RectGeometry, width: number, height: number) {
  return { x: rect.x * width, y: rect.y * height, width: rect.width * width, height: rect.height * height, rotation: rect.rotation ?? 0 }
}

export function pointsToPixels(points: Array<[number, number]>, width: number, height: number) {
  return points.flatMap(([x, y]) => [x * width, y * height])
}

export function elementLabel(element: SpatialElement) {
  if (element.type === 'TEXT') return element.text || element.name || '文字'
  return element.name || (element.type === 'RACK_SLOT' ? '机柜位' : element.type)
}

export function viewportForDocument(logicalWidth: number, logicalHeight: number, containerWidth: number, containerHeight: number) {
  const scale = Math.min((containerWidth - CANVAS_PADDING * 2) / logicalWidth, (containerHeight - CANVAS_PADDING * 2) / logicalHeight)
  return {
    scale: Number.isFinite(scale) && scale > 0 ? Math.max(0.1, scale) : 1,
    x: Math.max(CANVAS_PADDING, (containerWidth - logicalWidth * scale) / 2),
    y: Math.max(CANVAS_PADDING, (containerHeight - logicalHeight * scale) / 2),
  }
}
