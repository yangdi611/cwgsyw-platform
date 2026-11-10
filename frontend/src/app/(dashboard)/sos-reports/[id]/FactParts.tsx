'use client'

import type { ReactNode } from 'react'
import type { SosFacts } from '@/lib/sos-report-api'
import { fact, formatFactValue, isEmptySlot } from '@/lib/sos-report-format'
import { Chip, Table } from '@/design-system/figma-neutral/components'
import { SosPanel } from '../SosPanel'

export type FactRow = Record<string, unknown>
/** 标签、事实 key、单位、枚举值的中文名。 */
export type Definition = [label: string, key: string, unit?: string, labels?: Record<string, string>]
export type Column = { key: string; label: string; unit?: string }

export function Definitions({ facts, items }: { facts: SosFacts | undefined; items: Definition[] }) {
  return (
    <dl className="cwgsyw-devices-defs">
      {items.map(([label, key, unit, labels]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{formatFactValue(fact(facts, key), unit, labels)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** 状态列：空槽位用标签突出显示，其余按文本显示。 */
function cell(row: FactRow, column: Column): ReactNode {
  if (column.key === 'status' && isEmptySlot(row)) return <Chip label="空槽位" />
  return formatFactValue(row[column.key], column.unit)
}

/**
 * 明细表。{@code hideWhenEmpty} 用于只在特定硬件或工具存在时才有数据的表（RAID 卡、IB、FC 等），
 * 没有数据时不占位置；常规表在没有数据时显示 {@code empty} 说明。
 */
export function FactTable({ title, columns, rows, empty, hideWhenEmpty = false }: {
  title: string
  columns: Column[]
  rows: FactRow[]
  empty?: string
  hideWhenEmpty?: boolean
}) {
  if (hideWhenEmpty && rows.length === 0) return null
  return (
    <SosPanel title={title} flush>
      <Table
        className="cwgsyw-cmdb-table"
        density="compact"
        showSearch={false}
        columns={columns.map(({ key, label }) => ({ key, label }))}
        rows={rows.map((row, index) => ({
          id: String(index),
          cells: Object.fromEntries(columns.map((column) => [column.key, cell(row, column)])) as Record<string, ReactNode>,
        }))}
        state={rows.length === 0 ? 'empty' : 'data'}
        empty={empty}
      />
    </SosPanel>
  )
}

export function Tags({ title, values, empty, tone, hideWhenEmpty = false }: {
  title: string
  values: string[]
  empty: string
  tone?: 'danger'
  hideWhenEmpty?: boolean
}) {
  if (hideWhenEmpty && values.length === 0) return null
  return (
    <SosPanel title={`${title}（${values.length}）`}>
      {values.length === 0 ? (
        <p className="cwgsyw-sos-report__note">{empty}</p>
      ) : (
        <div className="cwgsyw-sos-report__tags">
          {values.map((value) => <Chip key={value} label={value} tone={tone} />)}
        </div>
      )}
    </SosPanel>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cwgsyw-sos-report__stack">
      <h2 className="cwgsyw-sos-report__section-title">{title}</h2>
      {children}
    </section>
  )
}

/** “已安装 x / 共 y”，用于插槽类表格的标题。 */
export function slotTitle(title: string, rows: FactRow[]): string {
  if (rows.length === 0) return title
  const installed = rows.filter((row) => !isEmptySlot(row)).length
  return `${title}（已用 ${installed} / 共 ${rows.length}）`
}
