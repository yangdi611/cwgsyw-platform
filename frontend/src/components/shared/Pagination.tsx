'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  /** 当前页（1-based） */
  page: number
  /** 每页条数 */
  pageSize: number
  /** 总记录数 */
  total: number
  /** 翻页回调 */
  onPageChange: (page: number) => void
  className?: string
}

/**
 * 列表分页控件
 *
 * UX 设计：
 * - 左侧固定显示总条数，让用户感知数据规模
 * - 右侧上一页 / 当前页 / 下一页，禁用态用透明度提示边界
 * - 轻量样式，不抢表格视觉焦点
 */
export function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (total === 0) return null

  const btnCls =
    'inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md border border-v2-border bg-v2-surface text-v2-fg transition-colors hover:bg-v2-surface-hover disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <span className="text-sm text-v2-muted">
        共 <span className="font-semibold text-v2-fg tabular-nums">{total}</span> 条
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btnCls}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-v2-fg tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className={btnCls}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
