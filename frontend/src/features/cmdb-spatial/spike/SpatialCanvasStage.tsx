'use client'

import { Layer, Line, Rect, Stage, Text } from 'react-konva'
import { CANVAS_NEUTRAL } from '@/design-system/figma-neutral/canvas-tokens'

interface SpatialCanvasSlot {
  id: string
  label: string
  x: number
  y: number
}

interface SpatialCanvasStageProps {
  slots: SpatialCanvasSlot[]
  scale: number
  position: { x: number; y: number }
  onPositionChange: (position: { x: number; y: number }) => void
}

export function SpatialCanvasStage({ slots, scale, position, onPositionChange }: SpatialCanvasStageProps) {
  return (
    <Stage
      width={1600}
      height={620}
      draggable
      scaleX={scale}
      scaleY={scale}
      x={position.x}
      y={position.y}
      onDragEnd={(event) => onPositionChange({ x: event.target.x(), y: event.target.y() })}
      aria-label="空间布局画布技术验证"
    >
      <Layer listening={false}>
        <Rect x={20} y={20} width={1540} height={920} fill={CANVAS_NEUTRAL[50]} stroke={CANVAS_NEUTRAL[400]} strokeWidth={3} cornerRadius={8} />
        <Line points={[20, 20, 1560, 20, 1520, 940, 80, 940, 20, 20]} stroke={CANVAS_NEUTRAL[700]} strokeWidth={5} closed />
        <Text x={74} y={54} text="308 机房逻辑布局 - Canvas Spike" fill={CANVAS_NEUTRAL[900]} fontSize={26} fontStyle="bold" />
        <Rect x={75} y={96} width={1400} height={42} fill={CANVAS_NEUTRAL[200]} cornerRadius={4} />
        <Text x={92} y={108} text="冷通道" fill={CANVAS_NEUTRAL[600]} fontSize={16} />
        {slots.map((slot) => (
          <Rect key={slot.id} x={slot.x} y={slot.y} width={48} height={31} fill={CANVAS_NEUTRAL[700]} stroke={CANVAS_NEUTRAL[900]} strokeWidth={1} cornerRadius={2} />
        ))}
        {slots.map((slot) => (
          <Text key={`${slot.id}-label`} x={slot.x + 4} y={slot.y + 9} text={slot.label.slice(2)} fill={CANVAS_NEUTRAL[50]} fontSize={9} />
        ))}
      </Layer>
    </Stage>
  )
}
