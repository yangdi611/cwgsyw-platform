'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Minus, Plus, Scan } from 'lucide-react'
import { pointsToPixels, rectToPixels, viewportForDocument } from '../model/geometry'
import type { SpatialDocument, SpatialElement, SpatialRuntime } from '../model/types'
import type { SpatialLayer } from './SpatialCanvasStage'

const SpatialCanvasStage = dynamic(() => import('./SpatialCanvasStage').then((module) => module.SpatialCanvasStage), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-v2-surface-soft" />,
})

interface SpatialViewerCanvasProps { document: SpatialDocument; runtime?: SpatialRuntime; layer: SpatialLayer; selectedElementId?: string; highlightedElementId?: string; focusElementId?: string; onSelect: (element: SpatialElement) => void }

export function SpatialViewerCanvas({ document, runtime, layer, selectedElementId, highlightedElementId, focusElementId, onSelect }: SpatialViewerCanvasProps) {
  const container = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [viewport, setViewport] = useState({ scale: 1, x: 32, y: 32 })
  const fit = useCallback(() => {
    if (!container.current) return
    const next = viewportForDocument(document.canvas.logicalWidth, document.canvas.logicalHeight, container.current.clientWidth, container.current.clientHeight)
    setViewport(next)
  }, [document.canvas.logicalHeight, document.canvas.logicalWidth])
  useEffect(() => {
    if (!container.current) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) })
    })
    observer.observe(container.current)
    fit()
    return () => observer.disconnect()
  }, [fit])
  useEffect(() => { fit() }, [fit])
  useEffect(() => {
    if (!focusElementId || !container.current || size.width <= 1 || size.height <= 1) return
    const target = document.elements.find((element) => element.id === focusElementId)
    if (!target) return
    const bounds = elementBounds(target, document.canvas.logicalWidth, document.canvas.logicalHeight)
    const scale = Math.max(0.75, Math.min(2.5, Math.min(size.width / Math.max(bounds.width * 3, 180), size.height / Math.max(bounds.height * 3, 140))))
    const frame = requestAnimationFrame(() => setViewport({ scale, x: size.width / 2 - (bounds.x + bounds.width / 2) * scale, y: size.height / 2 - (bounds.y + bounds.height / 2) * scale }))
    return () => cancelAnimationFrame(frame)
  }, [document, focusElementId, size.height, size.width])
  return <div ref={container} role="region" aria-label="机房空间布局画布" className="relative h-full min-h-[460px] overflow-hidden bg-v2-surface">
    <SpatialCanvasStage document={document} runtime={runtime} layer={layer} width={size.width} height={size.height}
      referenceImageUrl={document.reference?.assetId && document.reference.visibleInPublishedView ? `/api/cmdb/spatial/assets/${document.reference.assetId}/content` : undefined}
      scale={viewport.scale} position={{ x: viewport.x, y: viewport.y }} onPositionChange={(position) => setViewport((current) => ({ ...current, ...position }))}
      selectedElementId={selectedElementId} highlightedElementId={highlightedElementId} onSelect={onSelect} />
    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-v2-sm border border-v2-border bg-v2-surface p-1 shadow-sm">
      <Button variant="ghost" size="icon" title="缩小" onClick={() => setViewport((current) => ({ ...current, scale: Math.max(0.1, current.scale - 0.1) }))}><Minus className="h-4 w-4" /></Button>
      <span className="w-11 text-center text-xs tabular-nums text-v2-muted">{Math.round(viewport.scale * 100)}%</span>
      <Button variant="ghost" size="icon" title="放大" onClick={() => setViewport((current) => ({ ...current, scale: Math.min(4, current.scale + 0.1) }))}><Plus className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" title="适配画布" onClick={fit}><Scan className="h-4 w-4" /></Button>
    </div>
  </div>
}

function elementBounds(element: SpatialElement, logicalWidth: number, logicalHeight: number) {
  if (element.geometry.kind === 'RECT') {
    const rect = rectToPixels(element.geometry, logicalWidth, logicalHeight)
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }
  const points = pointsToPixels(element.geometry.points, logicalWidth, logicalHeight)
  const xs = points.filter((_, index) => index % 2 === 0)
  const ys = points.filter((_, index) => index % 2 === 1)
  const x = Math.min(...xs); const y = Math.min(...ys)
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) }
}
