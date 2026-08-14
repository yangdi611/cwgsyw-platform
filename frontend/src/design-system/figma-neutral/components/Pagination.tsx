import type { ReactNode } from 'react'
import { Icon } from './Icon'

export interface PaginationProps {
  page: number
  pageCount: number
  totalCount?: number
  showTotal?: boolean
  showPageSize?: boolean
  showJump?: boolean
  density?: 'default' | 'compact'
  onPageChange?: (page: number) => void
}

export function PaginationPageItem({
  type = 'number',
  current,
  disabled,
  label,
  children,
  onClick,
}: {
  type?: 'number' | 'previous' | 'next' | 'ellipsis'
  current?: boolean
  disabled?: boolean
  label?: string
  children?: ReactNode
  onClick?: () => void
}) {
  if (type === 'ellipsis') {
    return <span className="cwgsyw-page-item" aria-hidden="true">{label ?? '…'}</span>
  }
  return (
    <button
      type="button"
      className="cwgsyw-page-item"
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      disabled={disabled}
      data-type={type}
      onClick={onClick}
    >
      {children ?? label}
    </button>
  )
}

export function Pagination({
  page,
  pageCount,
  totalCount,
  showTotal = true,
  showPageSize = false,
  showJump = false,
  density = 'default',
  onPageChange,
}: PaginationProps) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1).slice(0, 7)
  return (
    <nav className="cwgsyw-pagination" data-cwgsyw-pagination={density} aria-label="分页">
      {showTotal && totalCount != null ? <span className="cwgsyw-type-label-sm">共 {totalCount} 条</span> : null}
      <PaginationPageItem type="previous" label="上一页" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)}>
        <Icon name="chevron-previous" size="sm" />
      </PaginationPageItem>
      {pages.map((item) => (
        <PaginationPageItem key={item} type="number" current={item === page} onClick={() => onPageChange?.(item)}>
          {item}
        </PaginationPageItem>
      ))}
      <PaginationPageItem type="next" label="下一页" disabled={page >= pageCount} onClick={() => onPageChange?.(page + 1)}>
        <Icon name="chevron-next" size="sm" />
      </PaginationPageItem>
      {showPageSize ? <span className="cwgsyw-type-label-sm">每页</span> : null}
      {showJump ? <span className="cwgsyw-type-label-sm">跳转</span> : null}
    </nav>
  )
}
