import type { ReactNode } from 'react'
import { SearchInput } from './SearchInput'

export interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  sort?: 'none' | 'asc' | 'desc'
}

export interface TableRowData {
  id: string
  cells: Record<string, ReactNode>
  selected?: boolean
  disabled?: boolean
}

export interface TableProps {
  columns: TableColumn[]
  rows: TableRowData[]
  density?: 'compact' | 'default'
  state?: 'data' | 'empty' | 'loading'
  empty?: ReactNode
  loading?: ReactNode
  showSearch?: boolean
  filters?: ReactNode
  actions?: ReactNode
  onSort?: (key: string) => void
  onRowClick?: (id: string) => void
}


export function TableToolbar({ children }: { children: ReactNode }) {
  return <div className="cwgsyw-table-toolbar">{children}</div>
}

export function TableHeaderCell({ label, align, sort, onSort }: { label: ReactNode; align?: 'left' | 'center' | 'right'; sort?: 'none' | 'asc' | 'desc'; onSort?: () => void }) {
  return (
    <th className={['cwgsyw-th', align ? `cwgsyw-align-${align}` : ''].filter(Boolean).join(' ')} aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none'}>
      {onSort ? <button type="button" onClick={onSort}>{label}</button> : label}
    </th>
  )
}

export function TableCell({ children, align }: { children: ReactNode; align?: 'left' | 'center' | 'right' }) {
  return <td className={['cwgsyw-td', align ? `cwgsyw-align-${align}` : ''].filter(Boolean).join(' ')}>{children}</td>
}

export function TableRow({ children, selected, disabled, onClick }: { children: ReactNode; selected?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <tr className="cwgsyw-tr" data-state={disabled ? 'disabled' : selected ? 'selected' : 'default'} onClick={!disabled ? onClick : undefined} tabIndex={onClick && !disabled ? 0 : undefined} onKeyDown={onClick && !disabled ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } } : undefined}>
      {children}
    </tr>
  )
}

export function Table({
  columns,
  rows,
  density = 'default',
  state = 'data',
  empty = '暂无数据',
  loading = '加载中',
  showSearch = true,
  filters,
  actions,
  onSort,
  onRowClick,
}: TableProps) {
  return (
    <div>
      <TableToolbar>
        {showSearch ? <SearchInput placeholder="搜索" /> : null}
        {filters}
        {actions}
      </TableToolbar>
      {state === 'loading' ? <div role="status">{loading}</div> : null}
      {state === 'empty' ? <div>{empty}</div> : null}
      {state === 'data' ? (
        <>
          <div className="cwgsyw-table-wrap cwgsyw-table-desktop">
            <table className={['cwgsyw-table', density === 'compact' ? 'cwgsyw-table--compact' : ''].filter(Boolean).join(' ')}>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <TableHeaderCell key={column.key} label={column.label} align={column.align} sort={column.sort} onSort={onSort ? () => onSort(column.key) : undefined} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <TableRow key={row.id} selected={row.selected} disabled={row.disabled} onClick={onRowClick && !row.disabled ? () => onRowClick(row.id) : undefined}>
                    {columns.map((column) => (
                      <TableCell key={column.key} align={column.align}>{row.cells[column.key]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cwgsyw-table-mobile">
            {rows.map((row) => (
              <article key={row.id} className="cwgsyw-card" data-state={row.selected ? 'selected' : undefined} onClick={onRowClick && !row.disabled ? () => onRowClick(row.id) : undefined}>
                {columns.map((column) => (
                  <div key={column.key}>
                    <div className="cwgsyw-type-label-xs">{column.label}</div>
                    <div className="cwgsyw-type-body-sm">{row.cells[column.key]}</div>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
