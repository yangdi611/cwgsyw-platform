'use client'

import type { CSSProperties } from 'react'

export type DiffKind = 'added' | 'removed' | 'modified' | 'unchanged'

export interface DiffEntry {
  key: string
  kind: DiffKind
  before: unknown
  after: unknown
}

interface JsonDiffViewProps {
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  hideUnchanged?: boolean
  className?: string
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

function formatValue(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v === '' ? '(空)' : v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): DiffEntry[] {
  const b = before ?? {}
  const a = after ?? {}
  const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)])
  const entries: DiffEntry[] = []
  keys.forEach((k) => {
    const hasBefore = Object.prototype.hasOwnProperty.call(b, k)
    const hasAfter = Object.prototype.hasOwnProperty.call(a, k)
    const beforeVal = b[k]
    const afterVal = a[k]
    let kind: DiffKind
    if (hasBefore && !hasAfter) kind = 'removed'
    else if (!hasBefore && hasAfter) kind = 'added'
    else if (!deepEqual(beforeVal, afterVal)) kind = 'modified'
    else kind = 'unchanged'
    entries.push({ key: k, kind, before: beforeVal, after: afterVal })
  })
  const rank: Record<DiffKind, number> = { removed: 0, added: 1, modified: 2, unchanged: 3 }
  entries.sort((x, y) => rank[x.kind] - rank[y.kind] || x.key.localeCompare(y.key))
  return entries
}

const CELL_STYLE: Record<DiffKind, CSSProperties> = {
  removed: { background: 'var(--cwgsyw-status-danger-bg)', color: 'var(--cwgsyw-status-danger-fg)' },
  added: { background: 'var(--cwgsyw-status-success-bg)', color: 'var(--cwgsyw-status-success-fg)' },
  modified: { background: 'var(--cwgsyw-status-warning-bg)', color: 'var(--cwgsyw-status-warning-fg)' },
  unchanged: { background: 'var(--cwgsyw-neutral-100)', color: 'var(--cwgsyw-neutral-600)' },
}

const LABEL: Record<DiffKind, string> = {
  removed: '删除',
  added: '新增',
  modified: '修改',
  unchanged: '未变',
}

export function JsonDiffView({ before, after, hideUnchanged = false, className }: JsonDiffViewProps) {
  const entries = computeDiff(before, after).filter((e) => !hideUnchanged || e.kind !== 'unchanged')

  if (entries.length === 0) {
    return <p className={className ? `cwgsyw-type-body-sm ${className}` : 'cwgsyw-type-body-sm'}>无字段差异</p>
  }

  return (
    <div className={className}>
      <div className="cwgsyw-stack-list">
        {entries.map((e) => (
          <div key={e.key} className="cwgsyw-inline-controls">
            <span className="cwgsyw-type-label-sm">{e.key}</span>
            <span className="cwgsyw-type-label-sm" style={CELL_STYLE[e.kind]}>{e.kind === 'added' ? '—' : formatValue(e.before)}</span>
            <span className="cwgsyw-type-label-sm">{e.kind === 'modified' ? '→' : e.kind === 'unchanged' ? '=' : ''}</span>
            <span className="cwgsyw-type-label-sm" style={CELL_STYLE[e.kind]}>{e.kind === 'removed' ? '—' : formatValue(e.after)}</span>
            <span className="cwgsyw-type-label-sm">{LABEL[e.kind]}</span>
          </div>
        ))}
      </div>
      <p className="cwgsyw-type-label-sm">共 {entries.length} 个字段</p>
    </div>
  )
}
