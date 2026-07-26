'use client'

import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from 'react-konva'
import { useEffect, useState } from 'react'
import { elementLabel, pointsToPixels, rectToPixels } from '../model/geometry'
import { FACILITY_TYPE_LABELS, type SpatialDocument, type SpatialElement, type SpatialRuntime, type SpatialRuntimeElement } from '../model/types'

export type SpatialLayer = 'layout' | 'status' | 'alert' | 'rackUtilization' | 'dataQuality'

interface SpatialCanvasStageProps {
  document: SpatialDocument
  referenceImageUrl?: string
  runtime?: SpatialRuntime
  layer: SpatialLayer
  width: number
  height: number
  scale: number
  position: { x: number; y: number }
  selectedElementId?: string
  highlightedElementId?: string
  onPositionChange: (position: { x: number; y: number }) => void
  onSelect: (element: SpatialElement) => void
}

export function SpatialCanvasStage({ document, referenceImageUrl, runtime, layer, width, height, scale, position, selectedElementId, highlightedElementId, onPositionChange, onSelect }: SpatialCanvasStageProps) {
  const logicalWidth = document.canvas.logicalWidth
  const logicalHeight = document.canvas.logicalHeight
  const elements = [...document.elements].sort((a, b) => renderOrder(a) - renderOrder(b))
  return (
    <Stage width={width} height={height} draggable scaleX={scale} scaleY={scale} x={position.x} y={position.y}
      onDragEnd={(event) => onPositionChange({ x: event.target.x(), y: event.target.y() })} aria-label="机房空间布局画布">
      <Layer listening={false}>
        <Rect x={0} y={0} width={logicalWidth} height={logicalHeight} fill={document.canvas.backgroundColor || '#f8fafc'} />
        <Grid width={logicalWidth} height={logicalHeight} gridSize={document.canvas.gridSize ?? 20} />
      </Layer>
      {referenceImageUrl && document.reference?.visibleInPublishedView && <PublishedReferenceImage url={referenceImageUrl} reference={document.reference} logicalWidth={logicalWidth} logicalHeight={logicalHeight} />}
      <Layer>
        {elements.map((element) => <SpatialShape key={element.id} element={element} logicalWidth={logicalWidth} logicalHeight={logicalHeight}
          runtime={runtime?.elements[element.id]} layer={layer} selected={element.id === selectedElementId} highlighted={element.id === highlightedElementId}
          onSelect={onSelect} />)}
      </Layer>
    </Stage>
  )
}

function PublishedReferenceImage({ url, reference, logicalWidth, logicalHeight }: { url: string; reference: NonNullable<SpatialDocument['reference']>; logicalWidth: number; logicalHeight: number }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => { const next = new window.Image(); next.onload = () => setImage(next); next.src = url; return () => { next.onload = null } }, [url])
  if (!image) return null
  const transform = reference.transform || { x: 0.05, y: 0.05, width: 0.9, height: 0.9, rotation: 0 }
  return <Layer listening={false}><KonvaImage image={image} x={transform.x * logicalWidth} y={transform.y * logicalHeight} width={transform.width * logicalWidth} height={transform.height * logicalHeight} rotation={transform.rotation || 0} opacity={reference.opacity ?? 0.35} /></Layer>
}

function Grid({ width, height, gridSize }: { width: number; height: number; gridSize: number }) {
  const lines: React.ReactNode[] = []
  for (let x = 0; x <= width; x += gridSize) lines.push(<Line key={`x-${x}`} points={[x, 0, x, height]} stroke="#e2e8f0" strokeWidth={1} />)
  for (let y = 0; y <= height; y += gridSize) lines.push(<Line key={`y-${y}`} points={[0, y, width, y]} stroke="#e2e8f0" strokeWidth={1} />)
  return <>{lines}</>
}

function SpatialShape({ element, logicalWidth, logicalHeight, runtime, layer, selected, highlighted, onSelect }: {
  element: SpatialElement; logicalWidth: number; logicalHeight: number; runtime?: SpatialRuntimeElement; layer: SpatialLayer; selected: boolean; highlighted: boolean; onSelect: (element: SpatialElement) => void
}) {
  const palette = resolvePalette(element, runtime, layer)
  const emphasisStroke = selected ? '#0f766e' : highlighted ? '#ea580c' : palette.stroke
  const strokeWidth = selected || highlighted ? 4 : palette.strokeWidth
  const label = element.type === 'FACILITY' && !element.name ? FACILITY_TYPE_LABELS[element.facility?.facilityType || 'GENERAL'] : elementLabel(element)
  const common = { onClick: () => onSelect(element), onTap: () => onSelect(element), opacity: element.type === 'RACK_ROW' ? 0.45 : 1 }
  if (element.geometry.kind === 'RECT') {
    const rect = rectToPixels(element.geometry, logicalWidth, logicalHeight)
    return <Group {...common} x={rect.x} y={rect.y} rotation={rect.rotation}>
      <Rect width={rect.width} height={rect.height} fill={palette.fill} opacity={palette.fillOpacity} stroke={emphasisStroke} strokeWidth={strokeWidth} cornerRadius={element.type === 'RACK_SLOT' ? 2 : 4} />
      {label && <Text text={label} width={Math.max(18, rect.width - 6)} x={3} y={Math.max(2, rect.height / 2 - 7)} fontSize={labelFontSize(element, rect.width)} align="center" fill={palette.text} ellipsis listening={false} />}
      {runtime && layer === 'alert' && runtime.activeAlertCount > 0 && <Text text={String(runtime.activeAlertCount)} x={Math.max(0, rect.width - 15)} y={-8} fontSize={11} fontStyle="bold" fill="#b91c1c" listening={false} />}
    </Group>
  }
  const points = pointsToPixels(element.geometry.points, logicalWidth, logicalHeight)
  const closed = element.geometry.kind === 'POLYGON'
  const bounds = pointBounds(points)
  return <Group {...common}>
    <Line points={points} closed={closed} fill={closed ? palette.fill : undefined} stroke={emphasisStroke} strokeWidth={strokeWidth} lineJoin="round" />
    {label && <Text text={label} x={bounds.x} y={bounds.y - 18} width={bounds.width} align="center" fontSize={14} fill={palette.text} listening={false} />}
  </Group>
}

function renderOrder(element: SpatialElement) { if (element.type === 'ROOM_OUTLINE') return 0; if (element.type === 'ZONE') return 1; return 10 + (element.zIndex ?? 0) }
function resolvePalette(element: SpatialElement, runtime: SpatialRuntimeElement | undefined, layer: SpatialLayer) {
  if (element.type === 'ROOM_OUTLINE') return { fill: '#f8fafc', stroke: '#334155', text: '#0f172a', strokeWidth: 4 }
  if (element.type === 'WALL') return { fill: '#64748b', stroke: '#334155', text: '#0f172a', strokeWidth: 4 }
  if (element.type === 'DOOR') return { fill: '#fef3c7', stroke: '#b45309', text: '#78350f', strokeWidth: 2 }
  if (element.type === 'AISLE') return { fill: '#dbeafe', stroke: '#60a5fa', text: '#1e3a8a', strokeWidth: 1 }
  if (element.type === 'ZONE') return { fill: element.zone?.color || '#a855f7', fillOpacity: element.zone?.opacity ?? 0.18, stroke: element.zone?.color || '#a855f7', text: '#581c87', strokeWidth: 1 }
  if (element.type === 'TEXT') return { fill: 'transparent', stroke: 'transparent', text: '#0f172a', strokeWidth: 0 }
  if (layer === 'alert' && runtime?.activeAlertCount) return { fill: runtime.highestSeverity === 'critical' ? '#fecaca' : '#fed7aa', stroke: '#dc2626', text: '#7f1d1d', strokeWidth: 2 }
  if (layer === 'status' && runtime?.ciStatus) {
    const online = ['online', 'running', 'active'].includes(runtime.ciStatus)
    return online ? { fill: '#bbf7d0', stroke: '#16a34a', text: '#14532d', strokeWidth: 2 } : { fill: '#e5e7eb', stroke: '#6b7280', text: '#374151', strokeWidth: 2 }
  }
  if (layer === 'rackUtilization' && runtime?.rack) {
    const ratio = runtime.rack.heightU ? runtime.rack.usedU / runtime.rack.heightU : 0
    return ratio >= 0.85 ? { fill: '#fecaca', stroke: '#dc2626', text: '#7f1d1d', strokeWidth: 2 } : ratio >= 0.65 ? { fill: '#fde68a', stroke: '#d97706', text: '#78350f', strokeWidth: 2 } : { fill: '#bfdbfe', stroke: '#2563eb', text: '#1e3a8a', strokeWidth: 2 }
  }
  if (layer === 'dataQuality' && runtime?.qualityIssues.length) return { fill: '#fecaca', stroke: '#dc2626', text: '#7f1d1d', strokeWidth: 2 }
  if (element.type === 'RACK_SLOT') return layer === 'layout' ? rackLayoutPalette(element, runtime) : { fill: element.rack?.slotState === 'RESERVED' ? '#e5e7eb' : '#334155', stroke: '#0f172a', text: '#f8fafc', strokeWidth: 1 }
  if (element.type === 'FACILITY') return { fill: '#ccfbf1', stroke: '#0f766e', text: '#134e4a', strokeWidth: 2 }
  return { fill: '#e2e8f0', stroke: '#64748b', text: '#334155', strokeWidth: 1 }
}

function rackLayoutPalette(element: SpatialElement, runtime: SpatialRuntimeElement | undefined) {
  const empty = { fill: '#ffffff', stroke: '#94a3b8', text: '#334155', strokeWidth: 1 }
  if (element.rack?.slotState === 'DISABLED') return { fill: '#e2e8f0', stroke: '#94a3b8', text: '#475569', strokeWidth: 1 }
  if (!element.binding?.ciInstanceId) return element.rack?.slotState === 'RESERVED'
    ? { fill: '#fef3c7', stroke: '#d97706', text: '#78350f', strokeWidth: 1 }
    : empty
  if (!runtime || runtime.ciInstanceId === null) return { fill: '#fed7aa', stroke: '#ea580c', text: '#7c2d12', strokeWidth: 2 }
  if (runtime.activeAlertCount > 0) return { fill: '#fecaca', stroke: '#dc2626', text: '#7f1d1d', strokeWidth: 2 }
  if (runtime.qualityIssues.length > 0) return { fill: '#ffedd5', stroke: '#f97316', text: '#7c2d12', strokeWidth: 2 }
  const status = runtime.ciStatus?.toLowerCase()
  if (['online', 'running', 'active', 'normal', 'up'].includes(status || '')) return { fill: '#bbf7d0', stroke: '#16a34a', text: '#14532d', strokeWidth: 2 }
  if (['maintenance', 'maintaining'].includes(status || '')) return { fill: '#bfdbfe', stroke: '#2563eb', text: '#1e3a8a', strokeWidth: 2 }
  if (['offline', 'stopped', 'down', 'error', 'fault'].includes(status || '')) return { fill: '#e5e7eb', stroke: '#64748b', text: '#374151', strokeWidth: 2 }
  if (status) return { fill: '#fef3c7', stroke: '#d97706', text: '#78350f', strokeWidth: 2 }
  return { fill: '#bbf7d0', stroke: '#16a34a', text: '#14532d', strokeWidth: 2 }
}

function labelFontSize(element: SpatialElement, width: number) {
  if (element.type === 'RACK_SLOT') return Math.max(8, Math.min(13, width / 5))
  return Math.max(10, Math.min(16, width / 11))
}

function pointBounds(points: number[]) {
  const xs = points.filter((_, index) => index % 2 === 0); const ys = points.filter((_, index) => index % 2 === 1)
  const x = Math.min(...xs); const y = Math.min(...ys)
  return { x, y, width: Math.max(80, Math.max(...xs) - x) }
}
