'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { JsonDiffView } from './JsonDiffView'

/**
 * Shared V2 change-history record shape (backend `ChangeHistoryV2VO`, serialised
 * as camelCase via @JsonNaming(LowerCamelCaseStrategy.class)).
 */
export interface ChangeHistoryV2VO {
  id: number
  action: string
  operatorId: number | null
  operatorName: string | null
  beforeJson: Record<string, unknown> | null
  afterJson: Record<string, unknown> | null
  changedFields: string[] | null
  summary: string | null
  createdAt: string
}

/** Action badge styling. Backend stores `create_instance | update_instance | delete_instance`. */
export const ACTION_META: Record<string, { label: string; cls: string }> = {
  create_instance: {
    label: '创建',
    cls: 'border-green-500/40 bg-green-500/15 text-green-700 dark:text-green-300',
  },
  update_instance: {
    label: '更新',
    cls: 'border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300',
  },
  delete_instance: {
    label: '删除',
    cls: 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300',
  },
  create_relation: {
    label: '建立关联',
    cls: 'border-green-500/40 bg-green-500/15 text-green-700 dark:text-green-300',
  },
  delete_relation: {
    label: '删除关联',
    cls: 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300',
  },
}

export function actionMeta(action: string) {
  return ACTION_META[action] ?? { label: action || '操作', cls: 'border-border bg-muted text-muted-foreground' }
}

interface ChangeRecordItemProps {
  record: ChangeHistoryV2VO
  /** Compact variant: used in the instance-detail timeline (smaller padding). */
  compact?: boolean
  defaultOpen?: boolean
}

/**
 * A single change record rendered as a timeline entry: a one-line header
 * (action badge · operator · summary · time) that expands to reveal the
 * field-level JSONB diff via {@link JsonDiffView}.
 */
export function ChangeRecordItem({ record, compact = false, defaultOpen = false }: ChangeRecordItemProps) {
  const [open, setOpen] = useState(defaultOpen)
  const meta = actionMeta(record.action)
  const changedFields = record.changedFields ?? []
  const hasDiff = record.beforeJson != null || record.afterJson != null

  return (
    <div className="relative pl-5">
      {/* timeline dot + connector */}
      <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
      <span className="absolute left-[4px] top-5 bottom-0 w-px bg-border" />

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full text-left rounded-md hover:bg-muted/40 transition-colors px-2 -mx-2 py-1.5"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          )}
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${meta.cls}`}>
            {meta.label}
          </span>
          <span className="text-sm font-medium">{record.operatorName ?? '系统'}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(record.createdAt).toLocaleString('zh-CN')}
          </span>
        </div>
        {record.summary && (
          <p className={`mt-1 ${compact ? 'text-xs' : 'text-sm'} text-muted-foreground ${open ? '' : 'line-clamp-1'}`}>
            {record.summary}
          </p>
        )}
      </button>

      {open && (
        <div className="mt-2 mb-3 pr-1">
          {changedFields.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {changedFields.map(f => (
                <code
                  key={f}
                  className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                >
                  {f}
                </code>
              ))}
            </div>
          )}
          {hasDiff ? (
            <JsonDiffView before={record.beforeJson} after={record.afterJson} />
          ) : (
            <p className="text-xs text-muted-foreground">无变更快照数据</p>
          )}
        </div>
      )}
    </div>
  )
}
