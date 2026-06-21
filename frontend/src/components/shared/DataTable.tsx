'use client'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { LoadingState } from './LoadingState'
import { EmptyState } from './EmptyState'

export interface ColumnDef<T> {
  /** 列唯一 key（用于排序、列设置） */
  key: string
  /** 列标题 */
  title: string
  /** 单元格渲染 */
  render: (row: T, index: number) => ReactNode
  /** 列宽（数字 px 或 CSS 字符串） */
  width?: number | string
  /** 是否可排序 */
  sortable?: boolean
  /** 文本对齐 */
  align?: 'left' | 'center' | 'right'
  /** 列固定 */
  sticky?: 'left' | 'right'
}

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  /** 行 key 提取器 */
  rowKey: (row: T) => string | number
  /** 加载状态 */
  loading?: boolean
  /** 空态配置 */
  empty?: {
    title?: string
    description?: string
    action?: ReactNode
  }
  /** 行点击回调 */
  onRowClick?: (row: T) => void
  /** 选中行（受控） */
  selectedKeys?: (string | number)[]
  /** 选择变化回调 */
  onSelectionChange?: (keys: (string | number)[]) => void
  /** 当前排序字段 */
  sortKey?: string
  /** 当前排序方向 */
  sortOrder?: 'asc' | 'desc'
  /** 排序变化回调 */
  onSortChange?: (key: string, order: 'asc' | 'desc') => void
  className?: string
}

/**
 * 统一数据表格容器
 *
 * UX 设计：
 * - hover 行高亮，点击可触发详情抽屉
 * - 加载状态显示骨架屏，空态显示 EmptyState
 * - 复选框选择联动 Toolbar 的批量操作模式
 * - 排序点击表头切换 asc/desc
 */
export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading,
  empty,
  onRowClick,
  selectedKeys = [],
  onSelectionChange,
  sortKey,
  sortOrder,
  onSortChange,
  className,
}: DataTableProps<T>) {
  const selectable = !!onSelectionChange
  const allSelected = selectable && data.length > 0 && data.every(row => selectedKeys.includes(rowKey(row)))
  const someSelected = selectable && data.some(row => selectedKeys.includes(rowKey(row))) && !allSelected

  function toggleAll() {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange([])
    } else {
      onSelectionChange(data.map(rowKey))
    }
  }

  function toggleRow(row: T) {
    if (!onSelectionChange) return
    const key = rowKey(row)
    const next = selectedKeys.includes(key)
      ? selectedKeys.filter(k => k !== key)
      : [...selectedKeys, key]
    onSelectionChange(next)
  }

  function handleSort(col: ColumnDef<T>) {
    if (!col.sortable || !onSortChange) return
    const nextOrder: 'asc' | 'desc' = sortKey === col.key && sortOrder === 'asc' ? 'desc' : 'asc'
    onSortChange(col.key, nextOrder)
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-v2-border bg-v2-surface">
        <LoadingState minHeight={300} />
      </div>
    )
  }

  if (data.length === 0 && empty) {
    return (
      <div className="rounded-lg border border-v2-border bg-v2-surface">
        <EmptyState
          title={empty.title ?? '暂无数据'}
          description={empty.description}
          action={empty.action}
        />
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-v2-border bg-v2-surface', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-v2-border bg-v2-surface-soft text-v2-muted">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer rounded border-v2-border-strong"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    'px-3 py-2.5 text-xs font-medium uppercase tracking-wide',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    !col.align && 'text-left',
                    col.sortable && 'cursor-pointer select-none hover:text-v2-fg'
                  )}
                  onClick={() => handleSort(col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.title}
                    {col.sortable && sortKey === col.key && (
                      sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-v2-border">
            {data.map((row, idx) => {
              const key = rowKey(row)
              const isSelected = selectedKeys.includes(key)
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer',
                    isSelected ? 'bg-v2-primary-soft' : 'hover:bg-v2-surface-hover'
                  )}
                >
                  {selectable && (
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(row)}
                        className="h-4 w-4 cursor-pointer rounded border-v2-border-strong"
                      />
                    </td>
                  )}
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3 py-2.5 text-v2-fg',
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right'
                      )}
                    >
                      {col.render(row, idx)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
