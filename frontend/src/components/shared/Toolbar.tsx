'use client'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface ToolbarProps {
  /** 左侧主操作（如新建按钮） */
  primary?: ReactNode
  /** 右侧次操作（如导出、刷新、列设置） */
  secondary?: ReactNode
  /** 中间区域（如视图切换 Tab） */
  center?: ReactNode
  /** 选中行数（>0 时显示批量操作栏） */
  selectedCount?: number
  /** 批量操作按钮 */
  batchActions?: ReactNode
  /** 清除选择回调 */
  onClearSelection?: () => void
  className?: string
}

/**
 * 列表页工具栏
 *
 * UX 设计：
 * - 默认状态：左侧主操作 / 中间视图切换 / 右侧次操作
 * - 选中行后切换为批量操作栏（高亮提示选中数量）
 * - 提供"清除选择"快速退出批量模式
 */
export function Toolbar({
  primary,
  secondary,
  center,
  selectedCount = 0,
  batchActions,
  onClearSelection,
  className,
}: ToolbarProps) {
  if (selectedCount > 0 && batchActions) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-md border border-v2-primary-border bg-v2-primary-soft px-4 py-2.5',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-v2-primary">
            已选择 <span className="font-bold">{selectedCount}</span> 项
          </span>
          {onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-v2-muted hover:text-v2-fg transition-colors"
            >
              清除选择
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">{batchActions}</div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-2">{primary}</div>
      {center && <div className="flex items-center gap-2">{center}</div>}
      <div className="flex items-center gap-2">{secondary}</div>
    </div>
  )
}
