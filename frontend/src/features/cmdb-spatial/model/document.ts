import { FACILITY_TYPE_LABELS, type RectGeometry, type SpatialDocument, type SpatialElement, type SpatialElementType, type SpatialGeometry } from './types'

type RectSpatialGeometry = Extract<SpatialGeometry, { kind: 'RECT' }>

export function cloneDocument(document: SpatialDocument): SpatialDocument { return structuredClone(document) }

function createElementId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof globalThis.crypto?.getRandomValues === 'function') globalThis.crypto.getRandomValues(bytes)
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function createElement(type: SpatialElementType, index: number): SpatialElement {
  const id = createElementId()
  const base: SpatialElement = { id, type, name: defaultName(type, index), geometry: { kind: 'RECT', x: 0.15, y: 0.15, width: 0.14, height: 0.08, rotation: 0 }, zIndex: index + 10 }
  if (type === 'ROOM_OUTLINE') return { ...base, name: '机房外轮廓', geometry: { kind: 'POLYGON', points: [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]] }, locked: true, zIndex: 0 }
  if (type === 'WALL') return { ...base, name: '墙体', geometry: { kind: 'LINE', points: [[0.15, 0.15], [0.45, 0.15]] }, zIndex: 2 }
  if (type === 'DOOR') return { ...base, name: '门', door: { style: 'SINGLE', swing: 'LEFT', direction: 'INWARD' }, geometry: { kind: 'RECT', x: 0.25, y: 0.15, width: 0.1, height: 0.025, rotation: 0 }, zIndex: 4 }
  if (type === 'ZONE') return { ...base, name: '功能区域', zone: { color: '#a855f7', opacity: 0.18 }, zIndex: 1 }
  if (type === 'TEXT') return { ...base, name: '文字标注', text: '文字标注', geometry: { kind: 'RECT', x: 0.2, y: 0.2, width: 0.16, height: 0.04 } }
  if (type === 'RACK_SLOT') return { ...base, name: `R-${String(index + 1).padStart(2, '0')}`, rack: { rowCode: 'R', positionNo: String(index + 1).padStart(2, '0'), slotState: 'EMPTY' }, geometry: { kind: 'RECT', x: 0.2, y: 0.2, width: 0.04, height: 0.08 } }
  if (type === 'FACILITY') return { ...base, name: FACILITY_TYPE_LABELS.GENERAL, facility: { facilityType: 'GENERAL' }, geometry: { kind: 'RECT', x: 0.2, y: 0.2, width: 0.1, height: 0.08 } }
  return base
}

export function updateElement(document: SpatialDocument, elementId: string, patch: Partial<SpatialElement>): SpatialDocument {
  const next = cloneDocument(document)
  next.elements = next.elements.map((element) => element.id === elementId ? { ...element, ...patch } : element)
  return next
}

export function updateElementGeometry(document: SpatialDocument, elementId: string, geometry: Partial<RectGeometry>): SpatialDocument {
  const next = cloneDocument(document)
  next.elements = next.elements.map((element) => {
    if (element.id !== elementId || element.geometry.kind !== 'RECT') return element
    return { ...element, geometry: constrainRect({ ...element.geometry, ...geometry }) }
  })
  return next
}

/** Snap one rack to nearby rack edges or centerlines after it is dropped. */
export function snapRackToNearbyRacks(document: SpatialDocument, rackId: string, geometry: Partial<RectGeometry>): SpatialDocument {
  const rack = document.elements.find((element) => element.id === rackId && element.type === 'RACK_SLOT')
  if (!rack || rack.geometry.kind !== 'RECT') return updateElementGeometry(document, rackId, geometry)
  const next = constrainRect({ ...rack.geometry, ...geometry })
  const nearbyRacks = document.elements.filter((element): element is SpatialElement & { geometry: RectSpatialGeometry } => element.id !== rackId && element.type === 'RACK_SLOT' && element.geometry.kind === 'RECT')
  if (!nearbyRacks.length) return updateElementGeometry(document, rackId, next)
  const threshold = 0.0125
  const xCandidates = nearbyRacks.flatMap((element) => [element.geometry.x, element.geometry.x + element.geometry.width - next.width, element.geometry.x + element.geometry.width, element.geometry.x - next.width, element.geometry.x + element.geometry.width / 2 - next.width / 2])
  const yCandidates = nearbyRacks.flatMap((element) => [element.geometry.y, element.geometry.y + element.geometry.height - next.height, element.geometry.y + element.geometry.height, element.geometry.y - next.height, element.geometry.y + element.geometry.height / 2 - next.height / 2])
  return updateElementGeometry(document, rackId, { ...next, x: snapCoordinate(next.x, xCandidates, threshold), y: snapCoordinate(next.y, yCandidates, threshold) })
}

function snapCoordinate(value: number, candidates: number[], threshold: number) {
  const candidate = candidates.reduce<number | undefined>((closest, current) => {
    if (current < 0 || current > 1) return closest
    return closest === undefined || Math.abs(current - value) < Math.abs(closest - value) ? current : closest
  }, undefined)
  return candidate !== undefined && Math.abs(candidate - value) <= threshold ? candidate : value
}

/** Snap an edited wall endpoint to the endpoint of another wall or room outline. */
export function snapWallEndpoint(document: SpatialDocument, wallId: string, pointIndex: number, point: [number, number], orthogonal = true): SpatialDocument {
  const wall = document.elements.find((element) => element.id === wallId && element.type === 'WALL')
  if (!wall || wall.geometry.kind !== 'LINE') return document
  if (pointIndex !== 0 && pointIndex !== wall.geometry.points.length - 1) {
    return replaceElementGeometry(document, wallId, { ...wall.geometry, points: wall.geometry.points.map((current, index) => index === pointIndex ? [clampUnit(point[0]), clampUnit(point[1])] as [number, number] : current) })
  }
  const targetPoints = document.elements.flatMap((element) => {
    if (element.id === wallId || (element.type !== 'WALL' && element.type !== 'ROOM_OUTLINE')) return []
    if (element.geometry.kind === 'RECT') return []
    return element.geometry.kind === 'LINE' ? [element.geometry.points[0], element.geometry.points.at(-1)] : element.geometry.points
  }).filter((candidate): candidate is [number, number] => Boolean(candidate))
  const nearest = targetPoints.reduce<{ point: [number, number]; distance: number } | undefined>((closest, candidate) => {
    const distance = Math.hypot(candidate[0] - point[0], candidate[1] - point[1])
    return !closest || distance < closest.distance ? { point: candidate, distance } : closest
  }, undefined)
  let snapped = nearest && nearest.distance <= 0.015 ? nearest.point : [clampUnit(point[0]), clampUnit(point[1])] as [number, number]
  if ((!nearest || nearest.distance > 0.015) && orthogonal) {
    const fixedIndex = pointIndex === 0 ? 1 : wall.geometry.points.length - 2
    const fixed = wall.geometry.points[fixedIndex]
    const dx = (snapped[0] - fixed[0]) * document.canvas.logicalWidth
    const dy = (snapped[1] - fixed[1]) * document.canvas.logicalHeight
    const distance = Math.hypot(dx, dy)
    const tolerance = Math.sin(6 * Math.PI / 180)
    if (distance > 0 && Math.abs(dy) / distance <= tolerance) snapped = [snapped[0], fixed[1]]
    else if (distance > 0 && Math.abs(dx) / distance <= tolerance) snapped = [fixed[0], snapped[1]]
  }
  const points = wall.geometry.points.map((current, index) => index === pointIndex ? snapped : current)
  return replaceElementGeometry(document, wallId, { ...wall.geometry, points })
}

export function replaceElementGeometry(document: SpatialDocument, elementId: string, geometry: SpatialGeometry): SpatialDocument {
  const next = cloneDocument(document)
  next.elements = next.elements.map((element) => element.id === elementId ? { ...element, geometry } : element)
  return next
}

export function moveElements(document: SpatialDocument, elementIds: string[], dx: number, dy: number): SpatialDocument {
  const selected = new Set(elementIds)
  const next = cloneDocument(document)
  next.elements = next.elements.map((element) => {
    if (!selected.has(element.id) || element.locked) return element
    if (element.geometry.kind === 'RECT') return { ...element, geometry: constrainRect({ ...element.geometry, x: element.geometry.x + dx, y: element.geometry.y + dy }) }
    return { ...element, geometry: { ...element.geometry, points: element.geometry.points.map(([x, y]) => [clampUnit(x + dx), clampUnit(y + dy)] as [number, number]) } }
  })
  return next
}

export function distributeElements(document: SpatialDocument, elementIds: string[], axis: 'horizontal' | 'vertical'): SpatialDocument {
  const selected = document.elements.filter((element) => elementIds.includes(element.id) && !element.locked && element.geometry.kind === 'RECT')
  if (selected.length < 3) return document
  const sorted = [...selected].sort((left, right) => axis === 'horizontal' ? (left.geometry as RectGeometry).x - (right.geometry as RectGeometry).x : (left.geometry as RectGeometry).y - (right.geometry as RectGeometry).y)
  const first = sorted[0].geometry as RectGeometry; const last = sorted.at(-1)?.geometry as RectGeometry
  const start = axis === 'horizontal' ? first.x : first.y
  const end = axis === 'horizontal' ? last.x : last.y
  const gap = (end - start) / (sorted.length - 1)
  const positions = new Map(sorted.map((element, index) => [element.id, start + gap * index]))
  const next = cloneDocument(document)
  next.elements = next.elements.map((element) => {
    const position = positions.get(element.id)
    if (position === undefined || element.geometry.kind !== 'RECT') return element
    return { ...element, geometry: constrainRect(axis === 'horizontal' ? { ...element.geometry, x: position } : { ...element.geometry, y: position }) }
  })
  return next
}

export function snapDoorToNearestEdge(document: SpatialDocument, doorId: string, geometry: Partial<RectGeometry>): SpatialDocument {
  const door = document.elements.find((element) => element.id === doorId && element.type === 'DOOR')
  if (!door || door.geometry.kind !== 'RECT') return updateElementGeometry(document, doorId, geometry)
  const rect: RectGeometry = { ...door.geometry, ...geometry }
  const center: [number, number] = [rect.x + rect.width / 2, rect.y + rect.height / 2]
  const wallCandidates = document.elements.filter((element) => element.type === 'WALL').flatMap(edgeCandidates)
  const candidates = wallCandidates.length ? wallCandidates : document.elements.filter((element) => element.type === 'ROOM_OUTLINE').flatMap(edgeCandidates)
  const nearest = candidates.map((candidate) => ({ ...candidate, projection: projectPoint(center, candidate.start, candidate.end) })).sort((left, right) => left.projection.distance - right.projection.distance)[0]
  if (!nearest) return updateElementGeometry(document, doorId, geometry)
  const [x, y] = nearest.projection.point; const angle = Math.atan2(nearest.end[1] - nearest.start[1], nearest.end[0] - nearest.start[0]) * 180 / Math.PI
  const radians = angle * Math.PI / 180
  // Konva rotates each door from its top-left corner. Offset that rotated center so the visible door sits on the selected wall.
  const centerOffsetX = rect.width / 2 * Math.cos(radians) - rect.height / 2 * Math.sin(radians)
  const centerOffsetY = rect.width / 2 * Math.sin(radians) + rect.height / 2 * Math.cos(radians)
  return updateElement(document, doorId, { geometry: constrainRect({ ...rect, x: x - centerOffsetX, y: y - centerOffsetY, rotation: normalizeRotation(angle) }), door: { ...door.door, edgeElementId: nearest.elementId, segmentIndex: nearest.segmentIndex, position: nearest.projection.position } })
}

export function insertPointOnClosestEdge(document: SpatialDocument, elementId: string, point: [number, number]): SpatialDocument {
  const element = document.elements.find((item) => item.id === elementId)
  if (!element || (element.geometry.kind !== 'POLYGON' && element.geometry.kind !== 'LINE')) return document
  const points = element.geometry.points
  const edgeCount = element.geometry.kind === 'POLYGON' ? points.length : points.length - 1
  let closestIndex = 0; let closestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < edgeCount; index++) {
    const projection = projectPoint(point, points[index], points[(index + 1) % points.length])
    if (projection.distance < closestDistance) { closestDistance = projection.distance; closestIndex = index }
  }
  const next = [...points]; next.splice(closestIndex + 1, 0, [clampUnit(point[0]), clampUnit(point[1])])
  return replaceElementGeometry(document, elementId, { ...element.geometry, points: next })
}

export function removePoint(document: SpatialDocument, elementId: string, pointIndex: number): SpatialDocument {
  const element = document.elements.find((item) => item.id === elementId)
  if (!element || (element.geometry.kind !== 'POLYGON' && element.geometry.kind !== 'LINE')) return document
  const minimum = element.geometry.kind === 'POLYGON' ? 3 : 2
  if (element.geometry.points.length <= minimum) return document
  const points = element.geometry.points.filter((_, index) => index !== pointIndex)
  return replaceElementGeometry(document, elementId, { ...element.geometry, points })
}

export function alignElements(document: SpatialDocument, elementIds: string[], axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): SpatialDocument {
  const selected = document.elements.filter((element) => elementIds.includes(element.id) && !element.locked && element.geometry.kind === 'RECT')
  if (selected.length < 2) return document
  const first = selected[0].geometry as RectGeometry
  const target = axis === 'left' ? first.x : axis === 'right' ? first.x + first.width : axis === 'center' ? first.x + first.width / 2 : axis === 'top' ? first.y : axis === 'bottom' ? first.y + first.height : first.y + first.height / 2
  const next = cloneDocument(document)
  next.elements = next.elements.map((element) => {
    if (!elementIds.includes(element.id) || element.locked || element.geometry.kind !== 'RECT') return element
    const geometry = { ...element.geometry }
    if (axis === 'left') geometry.x = target
    if (axis === 'right') geometry.x = target - geometry.width
    if (axis === 'center') geometry.x = target - geometry.width / 2
    if (axis === 'top') geometry.y = target
    if (axis === 'bottom') geometry.y = target - geometry.height
    if (axis === 'middle') geometry.y = target - geometry.height / 2
    return { ...element, geometry: constrainRect(geometry) }
  })
  return next
}

export function duplicateElements(document: SpatialDocument, sourceElements: SpatialElement[], offset = 0.02): { document: SpatialDocument; ids: string[] } {
  const originals = sourceElements.filter((element) => !element.locked && element.type !== 'ROOM_OUTLINE')
  const rackNames = new Set(document.elements.flatMap((element) => element.type === 'RACK_SLOT' && element.name ? [element.name] : []))
  const copies: SpatialElement[] = originals.map((element, index): SpatialElement => {
    const geometry = element.geometry.kind === 'RECT'
      ? constrainRect({ ...element.geometry, x: element.geometry.x + offset, y: element.geometry.y + offset })
      : { ...element.geometry, points: element.geometry.points.map(([x, y]) => [clampUnit(x + offset), clampUnit(y + offset)] as [number, number]) }
    const name = element.type === 'RACK_SLOT' ? nextCopyName(element.name || '机柜位', rackNames) : element.name
    const rack = element.type === 'RACK_SLOT' ? { ...element.rack, slotState: 'EMPTY' as const } : element.rack
    return { ...element, id: createElementId(), name, binding: undefined, rack, geometry, zIndex: Math.max(...document.elements.map((item) => item.zIndex || 0), 0) + index + 1 }
  })
  const next = { ...cloneDocument(document), elements: [...document.elements, ...copies] }
  const snapped = copies.filter((element) => element.type === 'DOOR').reduce((current, door) => snapDoorToNearestEdge(current, door.id, {}), next)
  return { document: snapped, ids: copies.map((element) => element.id) }
}

function nextCopyName(baseName: string, names: Set<string>) {
  const first = `${baseName} 副本`
  if (!names.has(first)) { names.add(first); return first }
  let index = 2
  while (names.has(`${first} ${index}`)) index += 1
  const name = `${first} ${index}`
  names.add(name)
  return name
}

export function removeElement(document: SpatialDocument, elementId: string): SpatialDocument {
  const next = cloneDocument(document)
  next.elements = next.elements.filter((element) => element.id !== elementId)
  return next
}

export interface RackRowOptions { rowCode: string; count: number; startNo: number; padding: number; orientation: 'horizontal' | 'vertical'; numbering: 'ascending' | 'descending'; slotState: 'EMPTY' | 'RESERVED'; slotWidth: number; slotHeight: number; gap: number }

export function generateRackRow(document: SpatialDocument, options: RackRowOptions): SpatialElement[] {
  const code = options.rowCode.trim().toUpperCase()
  if (!/^[A-Z0-9_-]{1,16}$/.test(code)) throw new Error('机柜列代码只能包含大写字母、数字、下划线或短横线')
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 200) throw new Error('机柜数量必须在 1 到 200 之间')
  const names = new Set(document.elements.filter((element) => element.type === 'RACK_SLOT').map((element) => element.name))
  const created: SpatialElement[] = []
  for (let index = 0; index < options.count; index++) {
    const positionNo = options.numbering === 'ascending' ? options.startNo + index : options.startNo + options.count - index - 1
    const no = String(positionNo).padStart(options.padding, '0')
    const name = `${code}-${no}`
    if (names.has(name)) throw new Error(`机柜位编号 ${name} 已存在`)
    const offset = index * ((options.orientation === 'horizontal' ? options.slotWidth : options.slotHeight) + options.gap)
    created.push({ id: createElementId(), type: 'RACK_SLOT', name, rack: { rowCode: code, positionNo: no, slotState: options.slotState }, geometry: {
      kind: 'RECT', x: 0.12 + (options.orientation === 'horizontal' ? offset : 0), y: 0.2 + (options.orientation === 'vertical' ? offset : 0), width: options.slotWidth, height: options.slotHeight,
    }, zIndex: 30 + index })
  }
  return created
}

function defaultName(type: SpatialElementType, index: number) {
  const names: Partial<Record<SpatialElementType, string>> = { DOOR: '门', AISLE: '通道', ZONE: '功能区域', RACK_ROW: `机柜列 ${index + 1}` }
  return names[type] || type
}

function clampUnit(value: number) { return Math.min(1, Math.max(0, Number(value.toFixed(6)))) }
function constrainRect(rect: RectGeometry): RectSpatialGeometry {
  const width = clampUnit(rect.width)
  const height = clampUnit(rect.height)
  return {
    kind: 'RECT',
    ...rect,
    width,
    height,
    x: Math.min(1 - width, Math.max(0, Number(rect.x.toFixed(6)))),
    y: Math.min(1 - height, Math.max(0, Number(rect.y.toFixed(6)))),
  }
}
function normalizeRotation(value: number) { return Number(((value % 360 + 360) % 360).toFixed(6)) }

type EdgeCandidate = { elementId: string; segmentIndex: number; start: [number, number]; end: [number, number] }
function edgeCandidates(element: SpatialElement): EdgeCandidate[] {
  if (element.type !== 'WALL' && element.type !== 'ROOM_OUTLINE') return []
  if (element.geometry.kind !== 'LINE' && element.geometry.kind !== 'POLYGON') return []
  const points = element.geometry.points; const count = element.geometry.kind === 'POLYGON' ? points.length : points.length - 1
  return Array.from({ length: count }, (_, index) => ({ elementId: element.id, segmentIndex: index, start: points[index], end: points[(index + 1) % points.length] }))
}
function projectPoint(point: [number, number], start: [number, number], end: [number, number]) {
  const dx = end[0] - start[0]; const dy = end[1] - start[1]; const denominator = dx * dx + dy * dy
  const position = denominator === 0 ? 0 : Math.min(1, Math.max(0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / denominator))
  const projected: [number, number] = [start[0] + dx * position, start[1] + dy * position]
  return { point: projected, position: Number(position.toFixed(6)), distance: Math.hypot(point[0] - projected[0], point[1] - projected[1]) }
}
