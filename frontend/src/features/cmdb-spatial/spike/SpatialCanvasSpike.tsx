'use client'

import dynamic from 'next/dynamic'
import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Minus, Plus, RotateCcw } from 'lucide-react'

const SpatialCanvasStage = dynamic(
  () => import('./SpatialCanvasStage').then((module) => module.SpatialCanvasStage),
  { ssr: false, loading: () => <div className="h-[620px] animate-pulse rounded-v2-md bg-v2-surface-soft" /> },
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

  const resetViewport = () => {
    setScale(0.65)
    setPosition({ x: 28, y: 28 })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-v2-fg">空间画布技术验证</h1>
          <p className="mt-1 text-sm text-v2-muted">500 个机柜位，支持平移、缩放和不规则机房轮廓。</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" title="缩小" onClick={() => setScale((current) => Math.max(0.25, current - 0.1))}>
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-14 text-center text-xs tabular-nums text-v2-muted">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="icon" title="放大" onClick={() => setScale((current) => Math.min(1.5, current + 0.1))}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" title="重置视图" onClick={resetViewport}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={stageRef} className="h-[620px] overflow-hidden rounded-v2-md border border-v2-border bg-v2-surface">
        <SpatialCanvasStage slots={slots} scale={scale} position={position} onPositionChange={setPosition} />
      </div>
    </div>
  )
}
