'use client'

import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react'
import type { TaskFieldDefinition } from '@/lib/task-template-api'

export function FormCanvas({
  fields,
  selectedKey,
  readOnly,
  onSelect,
  onMove,
  onRemove,
}: {
  fields: TaskFieldDefinition[]
  selectedKey?: string
  readOnly: boolean
  onSelect: (key: string) => void
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (key: string) => void
}) {
  return (
    <main className="min-h-[680px] bg-v2-canvas p-4">
      <div className="mx-auto max-w-3xl rounded-v2-xl border border-v2-border bg-v2-surface p-5 shadow-v2-sm">
        <div className="mb-5 border-b border-v2-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-v2-primary">表单画布</p>
          <p className="mt-1 text-sm text-v2-muted">移动端自动降级为单列；发布版本仅可预览。</p>
        </div>
        {fields.length === 0 ? (
          <div className="flex min-h-80 items-center justify-center rounded-v2-lg border border-dashed border-v2-border text-sm text-v2-muted">
            从左侧添加字段开始设计
          </div>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <button
                key={field.key}
                type="button"
                onClick={() => onSelect(field.key)}
                className={`flex w-full items-start gap-3 rounded-v2-lg border p-3 text-left transition ${
                  selectedKey === field.key
                    ? 'border-v2-primary bg-v2-primary-soft shadow-v2-sm'
                    : 'border-v2-border bg-v2-surface hover:bg-v2-surface-hover'
                }`}
              >
                <GripVertical className="mt-1 h-4 w-4 shrink-0 text-v2-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-v2-fg">{field.label}</span>
                    {field.required && <span className="text-v2-danger">*</span>}
                    <span className="rounded bg-v2-surface-hover px-1.5 py-0.5 font-v2-mono text-[10px] text-v2-muted">{field.type}</span>
                    {field.sensitive && <span className="rounded bg-v2-warning-soft px-1.5 py-0.5 text-[10px] text-v2-warning">敏感</span>}
                    {field.analytics.enabled === true && <span className="rounded bg-v2-success-soft px-1.5 py-0.5 text-[10px] text-v2-success">统计</span>}
                  </div>
                  <p className="mt-1 truncate font-v2-mono text-xs text-v2-muted">{field.key}</p>
                </div>
                {!readOnly && (
                  <div className="flex shrink-0 gap-1" onClick={(event) => event.stopPropagation()}>
                    <span role="button" tabIndex={0} aria-label="上移" onClick={() => onMove(index, -1)} className="rounded p-1 text-v2-muted hover:bg-v2-surface-hover"><ChevronUp className="h-4 w-4" /></span>
                    <span role="button" tabIndex={0} aria-label="下移" onClick={() => onMove(index, 1)} className="rounded p-1 text-v2-muted hover:bg-v2-surface-hover"><ChevronDown className="h-4 w-4" /></span>
                    <span role="button" tabIndex={0} aria-label="删除" onClick={() => onRemove(field.key)} className="rounded p-1 text-v2-danger hover:bg-v2-danger-soft"><Trash2 className="h-4 w-4" /></span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
