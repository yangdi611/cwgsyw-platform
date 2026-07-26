import type { RectGeometry, SpatialDocument, SpatialElement } from './types'

export interface AlignmentGuide {
  axis: 'x' | 'y'
  position: number
}

interface Bounds {
  left: number
  centerX: number
  right: number
  top: number
  centerY: number
  bottom: number
}

export function snapRectToElements(
  document: SpatialDocument,
  elementId: string,
  geometry: RectGeometry,
  selectedIds: string[],
  scale: number,
): { geometry: RectGeometry; guides: AlignmentGuide[] } {
  const anchor = document.elements.find((element) => element.id === elementId)
  if (!anchor || anchor.geometry.kind !== 'RECT') return { geometry, guides: [] }

  const movingIds = selectedIds.includes(elementId) && selectedIds.length > 1
    ? new Set(selectedIds)
    : new Set([elementId])
  const dx = geometry.x - anchor.geometry.x
  const dy = geometry.y - anchor.geometry.y
  const movingBounds = unionBounds(
    document.elements
      .filter((element) => movingIds.has(element.id))
      .map((element) => elementBounds(element, document, element.id === elementId ? geometry : undefined, dx, dy))
      .filter((bounds): bounds is Bounds => bounds !== null),
  )
  if (!movingBounds) return { geometry, guides: [] }

  const targets = document.elements
    .filter((element) => !movingIds.has(element.id))
    .map((element) => elementBounds(element, document))
    .filter((bounds): bounds is Bounds => bounds !== null)
  const threshold = 6 / Math.max(scale, 0.1)
  const xSnap = closestSnap(
    [movingBounds.left, movingBounds.centerX, movingBounds.right],
    targets.flatMap((bounds) => [bounds.left, bounds.centerX, bounds.right]),
    threshold,
  )
  const ySnap = closestSnap(
    [movingBounds.top, movingBounds.centerY, movingBounds.bottom],
    targets.flatMap((bounds) => [bounds.top, bounds.centerY, bounds.bottom]),
    threshold,
  )

  return {
    geometry: {
      ...geometry,
      x: clamp(geometry.x + (xSnap?.offset ?? 0) / document.canvas.logicalWidth),
      y: clamp(geometry.y + (ySnap?.offset ?? 0) / document.canvas.logicalHeight),
    },
    guides: [
      ...(xSnap ? [{ axis: 'x' as const, position: xSnap.target / document.canvas.logicalWidth }] : []),
      ...(ySnap ? [{ axis: 'y' as const, position: ySnap.target / document.canvas.logicalHeight }] : []),
    ],
  }
}

function elementBounds(
  element: SpatialElement,
  document: SpatialDocument,
  override?: RectGeometry,
  dx = 0,
  dy = 0,
): Bounds | null {
  const width = document.canvas.logicalWidth
  const height = document.canvas.logicalHeight
  if (element.geometry.kind === 'RECT') {
    const geometry = override ?? {
      ...element.geometry,
      x: element.geometry.x + dx,
      y: element.geometry.y + dy,
    }
    const x = geometry.x * width
    const y = geometry.y * height
    const rectWidth = geometry.width * width
    const rectHeight = geometry.height * height
    const radians = (geometry.rotation ?? 0) * Math.PI / 180
    const corners = [[0, 0], [rectWidth, 0], [rectWidth, rectHeight], [0, rectHeight]].map(([cornerX, cornerY]) => [
      x + cornerX * Math.cos(radians) - cornerY * Math.sin(radians),
      y + cornerX * Math.sin(radians) + cornerY * Math.cos(radians),
    ] as const)
    return boundsFromPoints(corners)
  }
  const points = element.geometry.points.map(([x, y]) => [(x + dx) * width, (y + dy) * height] as const)
  return boundsFromPoints(points)
}

function boundsFromPoints(points: ReadonlyArray<readonly [number, number]>): Bounds | null {
  if (!points.length) return null
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  return { left, centerX: (left + right) / 2, right, top, centerY: (top + bottom) / 2, bottom }
}

function unionBounds(bounds: Bounds[]): Bounds | null {
  if (!bounds.length) return null
  const left = Math.min(...bounds.map((item) => item.left))
  const right = Math.max(...bounds.map((item) => item.right))
  const top = Math.min(...bounds.map((item) => item.top))
  const bottom = Math.max(...bounds.map((item) => item.bottom))
  return { left, centerX: (left + right) / 2, right, top, centerY: (top + bottom) / 2, bottom }
}

function closestSnap(sources: number[], targets: number[], threshold: number) {
  let closest: { offset: number; target: number } | null = null
  for (const source of sources) {
    for (const target of targets) {
      const offset = target - source
      if (Math.abs(offset) > threshold) continue
      if (!closest || Math.abs(offset) < Math.abs(closest.offset)) closest = { offset, target }
    }
  }
  return closest
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, Number(value.toFixed(6))))
}
