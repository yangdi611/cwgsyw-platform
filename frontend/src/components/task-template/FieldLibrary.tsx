'use client'

import { Plus } from 'lucide-react'
import type { FieldTypeMetadata } from '@/lib/task-template-api'

export function FieldLibrary({
  fieldTypes,
  disabled,
  onAdd,
}: {
  fieldTypes: FieldTypeMetadata[]
  disabled: boolean
  onAdd: (type: FieldTypeMetadata) => void
}) {
  const categories = fieldTypes.reduce<Record<string, FieldTypeMetadata[]>>((result, fieldType) => {
    result[fieldType.category] = [...(result[fieldType.category] ?? []), fieldType]
    return result
  }, {})
  return (
    <aside className="min-h-[680px] border-r border-v2-border bg-v2-surface p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-v2-fg">字段组件库</h2>
        <p className="mt-1 text-xs text-v2-muted">点击加入表单画布</p>
      </div>
      <div className="space-y-4">
        {Object.entries(categories).map(([category, types]) => (
          <section key={category}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-v2-muted">{category}</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {types.map((type) => (
                <button
                  key={type.type}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAdd(type)}
                  className="flex items-center justify-between rounded-v2-md border border-v2-border bg-v2-surface px-2 py-2 text-left text-xs text-v2-fg transition hover:border-v2-primary hover:bg-v2-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="truncate">{type.label}</span><Plus className="h-3.5 w-3.5 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}
