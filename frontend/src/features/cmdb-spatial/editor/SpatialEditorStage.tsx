'use client'

import { useEffect, useRef, useState } from 'react'
import type Konva from 'konva'
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import { elementLabel, pointsToPixels, rectToPixels } from '../model/geometry'
import { snapRackToNearbyRacks, snapWallEndpoint } from '../model/document'
import { snapRectToElements, type AlignmentGuide } from '../model/snapping'
import type { RectGeometry, SpatialDocument, SpatialElement } from '../model/types'
import { CANVAS_NEUTRAL } from '@/design-system/figma-neutral/canvas-tokens'

interface SpatialEditorStageProps { document: SpatialDocument; referenceImageUrl?: string; width: number; height: number; scale: number; position: { x: number; y: number }; selectedIds: string[]; smartAlignment: boolean; orthogonalSnap: boolean; onPositionChange: (position: { x: number; y: number }) => void; onSelect: (id: string, additive: boolean) => void; onClearSelection: () => void; onMove: (id: string, geometry: Partial<RectGeometry>) => void; onMultiMove: (anchorId: string, geometry: Partial<RectGeometry>) => void; onPointsChange: (id: string, pointIndex: number, point: [number, number]) => void; onInsertPoint: (id: string, point: [number, number]) => void; onRemovePoint: (id: string, pointIndex: number) => void; onReferenceMove: (transform: RectGeometry) => void }

export function SpatialEditorStage({ document, referenceImageUrl, width, height, scale, position, selectedIds, smartAlignment, orthogonalSnap, onPositionChange, onSelect, onClearSelection, onMove, onMultiMove, onPointsChange, onInsertPoint, onRemovePoint, onReferenceMove }: SpatialEditorStageProps) {
  const logicalWidth = document.canvas.logicalWidth; const logicalHeight = document.canvas.logicalHeight
  const [guides, setGuides] = useState<AlignmentGuide[]>([])
  const [shiftPressed, setShiftPressed] = useState(false)
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => { if (event.key === 'Shift') setShiftPressed(true) }
    const keyUp = (event: KeyboardEvent) => { if (event.key === 'Shift') setShiftPressed(false) }
    const reset = () => setShiftPressed(false)
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', reset)
    return () => { window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', reset) }
  }, [])
  const previewMove = (id: string, geometry: RectGeometry, bypass: boolean) => {
    if (!smartAlignment || bypass) { setGuides([]); return geometry }
    const snapped = snapRectToElements(document, id, geometry, selectedIds, scale)
    setGuides(snapped.guides)
    return snapped.geometry
  }
  const move = (id: string, geometry: Partial<RectGeometry>) => {
    const element = document.elements.find((item) => item.id === id)
    if (element?.type !== 'RACK_SLOT') { onMove(id, geometry); return }
    const snapped = snapRackToNearbyRacks(document, id, geometry).elements.find((item) => item.id === id)
    onMove(id, snapped?.geometry.kind === 'RECT' ? snapped.geometry : geometry)
  }
  const changePoint = (id: string, pointIndex: number, point: [number, number]) => {
    const element = document.elements.find((item) => item.id === id)
    if (element?.type !== 'WALL') { onPointsChange(id, pointIndex, point); return }
    const snapped = snapWallEndpoint(document, id, pointIndex, point, orthogonalSnap || shiftPressed).elements.find((item) => item.id === id)
    if (snapped?.geometry.kind === 'LINE') onPointsChange(id, pointIndex, snapped.geometry.points[pointIndex])
  }
  return <Stage width={width} height={height} draggable scaleX={scale} scaleY={scale} x={position.x} y={position.y} onMouseDown={(event) => { if (event.target === event.target.getStage()) onClearSelection() }} onDragEnd={(event) => { if (event.target === event.target.getStage()) onPositionChange({ x: event.target.x(), y: event.target.y() }) }} aria-label="机房空间布局编辑画布">
    <Layer listening={false}><Rect width={logicalWidth} height={logicalHeight} fill={document.canvas.backgroundColor || CANVAS_NEUTRAL[50]} /><Grid width={logicalWidth} height={logicalHeight} grid={document.canvas.gridSize || 20} /></Layer>
    {referenceImageUrl && document.reference?.assetId && <ReferenceImage url={referenceImageUrl} reference={document.reference} logicalWidth={logicalWidth} logicalHeight={logicalHeight} onMove={onReferenceMove} />}
    <Layer>{[...document.elements].sort((a, b) => renderOrder(a) - renderOrder(b)).map((element) => <EditorElement key={element.id} element={element} logicalWidth={logicalWidth} logicalHeight={logicalHeight} selected={selectedIds.includes(element.id)} multiSelected={selectedIds.length > 1} orthogonalSnap={orthogonalSnap || shiftPressed} onSelect={onSelect} onMove={move} onMultiMove={onMultiMove} onDragPreview={previewMove} onDragFinish={() => setGuides([])} onPointsChange={changePoint} onInsertPoint={onInsertPoint} onRemovePoint={onRemovePoint} />)}</Layer>
    <Layer listening={false}>{guides.map((guide) => guide.axis === 'x'
      ? <Line key={`x-${guide.position}`} points={[guide.position * logicalWidth, 0, guide.position * logicalWidth, logicalHeight]} stroke={CANVAS_NEUTRAL[800]} strokeWidth={1.5 / Math.max(scale, 0.1)} dash={[6 / Math.max(scale, 0.1), 4 / Math.max(scale, 0.1)]} />
      : <Line key={`y-${guide.position}`} points={[0, guide.position * logicalHeight, logicalWidth, guide.position * logicalHeight]} stroke={CANVAS_NEUTRAL[800]} strokeWidth={1.5 / Math.max(scale, 0.1)} dash={[6 / Math.max(scale, 0.1), 4 / Math.max(scale, 0.1)]} />)}</Layer>
  </Stage>
}

function ReferenceImage({ url, reference, logicalWidth, logicalHeight, onMove }: { url: string; reference: NonNullable<SpatialDocument['reference']>; logicalWidth: number; logicalHeight: number; onMove: (transform: RectGeometry) => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => { const next = new window.Image(); next.onload = () => setImage(next); next.src = url; return () => { next.onload = null } }, [url])
  if (!image) return null
  const transform = reference.transform || { x: 0.05, y: 0.05, width: 0.9, height: 0.9, rotation: 0 }
  const update = (node: Konva.Image) => onMove({ x: clamp(node.x() / logicalWidth), y: clamp(node.y() / logicalHeight), width: clamp(node.width() * node.scaleX() / logicalWidth), height: clamp(node.height() * node.scaleY() / logicalHeight), rotation: normalizeRotation(node.rotation()) })
  return <Layer><KonvaImage image={image} x={transform.x * logicalWidth} y={transform.y * logicalHeight} width={transform.width * logicalWidth} height={transform.height * logicalHeight} rotation={transform.rotation || 0} opacity={reference.opacity ?? 0.35} draggable={!reference.locked} listening={!reference.locked} onDragEnd={(event) => update(event.target as Konva.Image)} /></Layer>
}

function EditorElement({ element, logicalWidth, logicalHeight, selected, multiSelected, orthogonalSnap, onSelect, onMove, onMultiMove, onDragPreview, onDragFinish, onPointsChange, onInsertPoint, onRemovePoint }: { element: SpatialElement; logicalWidth: number; logicalHeight: number; selected: boolean; multiSelected: boolean; orthogonalSnap: boolean; onSelect: (id: string, additive: boolean) => void; onMove: (id: string, geometry: Partial<RectGeometry>) => void; onMultiMove: (anchorId: string, geometry: Partial<RectGeometry>) => void; onDragPreview: (id: string, geometry: RectGeometry, bypass: boolean) => RectGeometry; onDragFinish: () => void; onPointsChange: (id: string, pointIndex: number, point: [number, number]) => void; onInsertPoint: (id: string, point: [number, number]) => void; onRemovePoint: (id: string, pointIndex: number) => void }) {
  const label = elementLabel(element); const style = styleFor(element)
  if (element.geometry.kind === 'RECT') {
    const rect = rectToPixels(element.geometry, logicalWidth, logicalHeight)
    return <TransformableRect element={element} rect={rect} style={style} selected={selected} multiSelected={multiSelected} label={label} logicalWidth={logicalWidth} logicalHeight={logicalHeight} orthogonalSnap={orthogonalSnap} onSelect={onSelect} onMove={onMove} onMultiMove={onMultiMove} onDragPreview={onDragPreview} onDragFinish={onDragFinish} />
  }
  const points = pointsToPixels(element.geometry.points, logicalWidth, logicalHeight)
  const insertPoint = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = event.target.getStage(); const pointer = stage?.getPointerPosition()
    if (!stage || !pointer) return
    onInsertPoint(element.id, [clamp((pointer.x - stage.x()) / (logicalWidth * stage.scaleX())), clamp((pointer.y - stage.y()) / (logicalHeight * stage.scaleY()))])
  }
  return <Group onClick={(event) => onSelect(element.id, event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey)} onTap={(event) => onSelect(element.id, event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey)}>
    <Line points={points} closed={element.geometry.kind === 'POLYGON'} fill={element.geometry.kind === 'POLYGON' ? style.fill : undefined} stroke={selected ? CANVAS_NEUTRAL[800] : style.stroke} strokeWidth={selected ? 4 : 3} lineJoin="round" onDblClick={element.locked && element.type !== 'ROOM_OUTLINE' ? undefined : insertPoint} />
    <Text text={label} x={points[0]} y={Math.max(0, points[1] - 18)} fontSize={14} fill={style.text} listening={false} />
    {selected && (!element.locked || element.type === 'ROOM_OUTLINE') && element.geometry.points.map(([x, y], index) => <Circle key={`${element.id}-${index}`} x={x * logicalWidth} y={y * logicalHeight} radius={6} fill={CANVAS_NEUTRAL[800]} stroke={CANVAS_NEUTRAL[0]} strokeWidth={2} draggable onDblClick={() => onRemovePoint(element.id, index)} onDragEnd={(event) => onPointsChange(element.id, index, [clamp(event.target.x() / logicalWidth), clamp(event.target.y() / logicalHeight)])} />)}
  </Group>
}

function TransformableRect({ element, rect, style, selected, multiSelected, label, logicalWidth, logicalHeight, orthogonalSnap, onSelect, onMove, onMultiMove, onDragPreview, onDragFinish }: { element: SpatialElement; rect: ReturnType<typeof rectToPixels>; style: ReturnType<typeof styleFor>; selected: boolean; multiSelected: boolean; label: string; logicalWidth: number; logicalHeight: number; orthogonalSnap: boolean; onSelect: (id: string, additive: boolean) => void; onMove: (id: string, geometry: Partial<RectGeometry>) => void; onMultiMove: (anchorId: string, geometry: Partial<RectGeometry>) => void; onDragPreview: (id: string, geometry: RectGeometry, bypass: boolean) => RectGeometry; onDragFinish: () => void }) {
  const shapeRef = useRef<Konva.Group>(null); const transformerRef = useRef<Konva.Transformer>(null)
  useEffect(() => { if (selected && shapeRef.current && transformerRef.current) { transformerRef.current.nodes([shapeRef.current]); transformerRef.current.getLayer()?.batchDraw() } }, [selected])
  const updateFromNode = (node: Konva.Group) => {
    const scaleX = node.scaleX(); const scaleY = node.scaleY(); node.scaleX(1); node.scaleY(1)
    const geometry = { x: clamp(node.x() / logicalWidth), y: clamp(node.y() / logicalHeight), width: clamp((rect.width * scaleX) / logicalWidth), height: clamp((rect.height * scaleY) / logicalHeight), rotation: normalizeRotation(node.rotation()) }
    if (multiSelected && scaleX === 1 && scaleY === 1 && geometry.rotation === (element.geometry.kind === 'RECT' ? element.geometry.rotation || 0 : 0)) onMultiMove(element.id, geometry)
    else onMove(element.id, geometry)
  }
  const previewFromNode = (event: Konva.KonvaEventObject<DragEvent>) => {
    const node = event.target as Konva.Group
    const geometry = onDragPreview(element.id, {
      x: clamp(node.x() / logicalWidth),
      y: clamp(node.y() / logicalHeight),
      width: rect.width / logicalWidth,
      height: rect.height / logicalHeight,
      rotation: normalizeRotation(node.rotation()),
    }, event.evt.altKey)
    node.position({ x: geometry.x * logicalWidth, y: geometry.y * logicalHeight })
  }
  return <>
    <Group ref={shapeRef} x={rect.x} y={rect.y} rotation={rect.rotation} draggable={!element.locked} onClick={(event) => onSelect(element.id, event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey)} onTap={(event) => onSelect(element.id, event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey)} onDragMove={previewFromNode} onDragEnd={(event) => { updateFromNode(event.target as Konva.Group); onDragFinish() }} onTransformEnd={(event) => { updateFromNode(event.target as Konva.Group); onDragFinish() }}>
      <Rect width={rect.width} height={rect.height} fill={style.fill} opacity={style.fillOpacity ?? 1} stroke={selected ? CANVAS_NEUTRAL[800] : style.stroke} strokeWidth={selected ? 4 : 2} dash={element.type === 'RACK_ROW' ? [6, 4] : undefined} cornerRadius={2} />
      <Text text={label} width={Math.max(18, rect.width - 4)} x={2} y={Math.max(2, rect.height / 2 - 7)} align="center" fontSize={Math.max(9, Math.min(14, rect.width / 6))} fill={style.text} listening={false} />
    </Group>
    {selected && !element.locked && <Transformer ref={transformerRef} keepRatio={false} rotateEnabled rotationSnaps={orthogonalSnap ? [0, 90, 180, 270] : []} rotationSnapTolerance={6} enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} boundBoxFunc={(oldBox, newBox) => newBox.width < 12 || newBox.height < 12 ? oldBox : newBox} />}
  </>
}

function Grid({ width, height, grid }: { width: number; height: number; grid: number }) { const lines: React.ReactNode[] = []; for (let x = 0; x <= width; x += grid) lines.push(<Line key={`x-${x}`} points={[x, 0, x, height]} stroke={CANVAS_NEUTRAL[200]} strokeWidth={1} />); for (let y = 0; y <= height; y += grid) lines.push(<Line key={`y-${y}`} points={[0, y, width, y]} stroke={CANVAS_NEUTRAL[200]} strokeWidth={1} />); return <>{lines}</> }
function renderOrder(element: SpatialElement) { if (element.type === 'ROOM_OUTLINE') return 0; if (element.type === 'ZONE') return 1; return 10 + (element.zIndex || 0) }
function styleFor(element: SpatialElement) { if (element.type === 'ROOM_OUTLINE') return { fill: CANVAS_NEUTRAL[50], stroke: CANVAS_NEUTRAL[700], text: CANVAS_NEUTRAL[900] }; if (element.type === 'WALL') return { fill: CANVAS_NEUTRAL[500], stroke: CANVAS_NEUTRAL[700], text: CANVAS_NEUTRAL[900] }; if (element.type === 'DOOR') return { fill: CANVAS_NEUTRAL[100], stroke: CANVAS_NEUTRAL[600], text: CANVAS_NEUTRAL[700] }; if (element.type === 'AISLE') return { fill: CANVAS_NEUTRAL[100], stroke: CANVAS_NEUTRAL[400], text: CANVAS_NEUTRAL[700] }; if (element.type === 'ZONE') return { fill: element.zone?.color || CANVAS_NEUTRAL[700], stroke: element.zone?.color || CANVAS_NEUTRAL[700], text: CANVAS_NEUTRAL[800], fillOpacity: element.zone?.opacity ?? 0.18 }; if (element.type === 'FACILITY') return { fill: CANVAS_NEUTRAL[200], stroke: CANVAS_NEUTRAL[800], text: CANVAS_NEUTRAL[700] }; if (element.type === 'RACK_SLOT') return { fill: CANVAS_NEUTRAL[700], stroke: CANVAS_NEUTRAL[900], text: CANVAS_NEUTRAL[50] }; return { fill: CANVAS_NEUTRAL[200], stroke: CANVAS_NEUTRAL[500], text: CANVAS_NEUTRAL[700] } }
function clamp(value: number) { return Math.min(1, Math.max(0, Number(value.toFixed(6)))) }
function normalizeRotation(value: number) { return Number(((value % 360 + 360) % 360).toFixed(6)) }
