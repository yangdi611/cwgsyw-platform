import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LoadingStateProps {
  /** 加载文案 */
  label?: string
  /** 占位高度 */
  minHeight?: number | string
  className?: string
}

/**
 * 加载状态占位
 *
 * UX 设计：
 * - 占据父容器空间，避免内容跳动
 * - 中央旋转图标 + 文案
 * - 可与表格、卡片、抽屉等容器组合
 */
export function LoadingState({
  label = '加载中…',
  minHeight = 200,
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-v2-muted',
        className
      )}
      style={{ minHeight }}
    >
      <Loader2 className="h-5 w-5 animate-spin text-v2-primary" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

/**
 * 表格行骨架屏
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: columns }).map((_, c) => (
            <div
              key={c}
              className="h-9 flex-1 animate-pulse rounded-md bg-v2-surface-hover"
            />
          ))}
        </div>
      ))}
    </div>
  )
}
