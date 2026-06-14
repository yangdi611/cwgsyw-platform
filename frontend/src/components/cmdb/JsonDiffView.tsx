'use client'

/**
 * Field-level JSONB diff renderer.
 *
 * Given a `before` and `after` snapshot (objects, or null for create/delete),
 * renders each field as a row coloured by change kind:
 *   - red    = deleted (in before, missing in after)
 *   - green  = added   (in after, missing in before)
 *   - yellow = modified (present in both but values differ)
 *   - gray   = unchanged
 *
 * Pure React — no external diff library, per Tier 3 hard constraints.
 */

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
  /** Hide fields whose values did not change. Default: false. */
  hideUnchanged?: boolean
  className?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  // Use JSON normalisation for objects/arrays; primitives compare directly.
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

/** Compute the ordered, field-level diff between two snapshots. */
export function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): DiffEntry[] {
  const b = before ?? {}
  const a = after ?? {}
  const keys = new Set<string>([...Object.keys(b), ...Object.keys(a)])
  const entries: DiffEntry[] = []
  keys.forEach(k => {
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
  // Surface changed fields first, then leave unchanged in stable order.
  const rank: Record<DiffKind, number> = { removed: 0, added: 1, modified: 2, unchanged: 3 }
  entries.sort((x, y) => rank[x.kind] - rank[y.kind] || x.key.localeCompare(y.key))
  return entries
}

// ── Style map ────────────────────────────────────────────────────────────────

const CELL_STYLE: Record<DiffKind, string> = {
  removed: 'bg-red-500/15 text-red-700 dark:text-red-300',
  added: 'bg-green-500/15 text-green-700 dark:text-green-300',
  modified: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  unchanged: 'bg-muted text-muted-foreground',
}

const DOT_STYLE: Record<DiffKind, string> = {
  removed: 'bg-red-500',
  added: 'bg-green-500',
  modified: 'bg-amber-500',
  unchanged: 'bg-muted-foreground/40',
}

const LABEL: Record<DiffKind, string> = {
  removed: '删除',
  added: '新增',
  modified: '修改',
  unchanged: '未变',
}

// ── Component ────────────────────────────────────────────────────────────────

export function JsonDiffView({ before, after, hideUnchanged = false, className }: JsonDiffViewProps) {
  const entries = computeDiff(before, after).filter(e => !hideUnchanged || e.kind !== 'unchanged')

  if (entries.length === 0) {
    return <p className={className ? `text-sm text-muted-foreground ${className}` : 'text-sm text-muted-foreground'}>无字段差异</p>
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-2 text-xs">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" />新增</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" />删除</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />修改</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/40" />未变</span>
      </div>
      <div className="border rounded-md overflow-hidden">
        <div className="grid grid-cols-[120px_1fr_24px_1fr] text-xs font-medium bg-muted/50 px-3 py-1.5 border-b">
          <span>字段</span>
          <span>变更前</span>
          <span />
          <span>变更后</span>
        </div>
        <div className="divide-y">
          {entries.map(e => (
            <div key={e.key} className="grid grid-cols-[120px_1fr_24px_1fr] items-stretch text-xs">
              <div className="px-3 py-1.5 flex items-center gap-1.5 border-r min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_STYLE[e.kind]}`} />
                <span className="font-mono truncate" title={e.key}>{e.key}</span>
              </div>
              <div className={`px-3 py-1.5 break-all min-w-0 ${CELL_STYLE[e.kind]} ${e.kind === 'unchanged' ? '' : 'font-medium'}`}>
                {e.kind === 'added' ? '—' : formatValue(e.before)}
              </div>
              <div className="px-1 py-1.5 flex items-center justify-center text-muted-foreground border-x">
                {e.kind === 'modified' ? '→' : e.kind === 'unchanged' ? '=' : ''}
              </div>
              <div className={`px-3 py-1.5 break-all min-w-0 ${CELL_STYLE[e.kind]} ${e.kind === 'unchanged' ? '' : 'font-medium'}`}>
                {e.kind === 'removed' ? '—' : formatValue(e.after)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        共 {entries.length} 个字段
        {entries.some(e => e.kind !== 'unchanged') && (
          <>，其中{' '}
            {(['removed', 'added', 'modified'] as const)
              .filter(k => entries.some(e => e.kind === k))
              .map(k => `${entries.filter(e => e.kind === k).length} ${LABEL[k]}`)
              .join('，')}
          </>
        )}
      </p>
    </div>
  )
}
