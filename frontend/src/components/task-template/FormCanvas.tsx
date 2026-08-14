'use client'

import type { TaskFieldDefinition } from '@/lib/task-template-api'
import { Button, Chip, IconButton, StatusBadge } from '@/design-system/figma-neutral/components'

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
    <section className="cwgsyw-designer__pane cwgsyw-designer__canvas">
      <div className="cwgsyw-designer__canvas-card">
        <div>
          <p className="cwgsyw-type-label-xs">表单画布</p>
          <p className="cwgsyw-type-body-sm">移动端自动降级为单列；发布版本仅可预览。</p>
        </div>
        {fields.length === 0 ? (
          <div className="cwgsyw-designer__empty">从左侧添加字段开始设计</div>
        ) : (
          <div className="cwgsyw-designer__stack">
            {fields.map((field, index) => (
              <div
                key={field.key}
                className="cwgsyw-designer__field"
                data-selected={selectedKey === field.key}
              >
                <Button
                  type="button"
                  variant="ghost"
                  className="cwgsyw-designer__field-select"
                  aria-pressed={selectedKey === field.key}
                  onClick={() => onSelect(field.key)}
                >
                  <div className="cwgsyw-form">
                    <div className="cwgsyw-designer__chips">
                      <strong>{field.label}</strong>
                      {field.required ? <span className="cwgsyw-field__required">*</span> : null}
                      <StatusBadge label={field.type} status="neutral" size="sm" />
                      {field.sensitive ? <Chip label="敏感" tone="warning" /> : null}
                      {field.analytics.enabled === true ? <Chip label="统计" tone="success" /> : null}
                    </div>
                    <p className="cwgsyw-type-label-xs">{field.key}</p>
                  </div>
                </Button>
                {!readOnly ? (
                  <div className="cwgsyw-designer__actions">
                    <IconButton type="button" variant="ghost" size="sm" icon="chevron-up" aria-label="上移" onClick={() => onMove(index, -1)} />
                    <IconButton type="button" variant="ghost" size="sm" icon="chevron-down" aria-label="下移" onClick={() => onMove(index, 1)} />
                    <IconButton type="button" variant="destructive" size="sm" icon="trash" aria-label="删除" onClick={() => onRemove(field.key)} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
