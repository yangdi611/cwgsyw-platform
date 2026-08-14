'use client'

import dynamic from 'next/dynamic'
import { useMemo, useRef, useState } from 'react'
import { Button, PageHeader } from '@/design-system/figma-neutral/components'

const SpatialCanvasStage = dynamic(
  () => import('./SpatialCanvasStage').then((module) => module.SpatialCanvasStage),
  { ssr: false, loading: () => <div className="cwgsyw-type-body-sm">加载画布…</div> },
)

const SLOT_COUNT = 500

export function SpatialCanvasSpike() {
  const [scale, setScale] = useState(0.65)
  const [position, setPosition] = useState({ x: 28, y: 28 })
  const stageRef = useRef<HTMLDivElement>(null)
  const slots = useMemo(() => Array.from({ length: SLOT_COUNT }, (_, index) => ({
    id: `spike-slot-${index + 1}`,
    label: `R-${String(index + 1).padStart(3, '0')}`,
    x: 90 + (index % 25) * 62,
    y: 120 + Math.floor(index / 25) * 46,
  })), [])

  return (
    <div className="cwgsyw-stack-list">
      <PageHeader
        eyebrow="CMDB"
        title="空间画布技术验证"
        subtitle="500 个机柜位，支持平移、缩放和不规则机房轮廓。"
        actions={
          <div className="cwgsyw-inline-controls">
            <Button type="button" size="sm" variant="secondary" onClick={() => setScale((current) => Math.max(0.25, current - 0.1))}>缩小</Button>
            <span className="cwgsyw-type-label-sm">{Math.round(scale * 100)}%</span>
            <Button type="button" size="sm" variant="secondary" onClick={() => setScale((current) => Math.min(1.5, current + 0.1))}>放大</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => { setScale(0.65); setPosition({ x: 28, y: 28 }) }}>重置视图</Button>
          </div>
        }
      />
      <div ref={stageRef} className="cwgsyw-card">
        <SpatialCanvasStage slots={slots} scale={scale} position={position} onPositionChange={setPosition} />
      </div>
    </div>
  )
}
