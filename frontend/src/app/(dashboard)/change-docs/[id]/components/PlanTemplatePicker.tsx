'use client'

import { Button, StatusBadge } from '@/components/design-system'
import { FileText } from 'lucide-react'
import type { TemplateVO } from './types'
import { DOC_TYPE_LABEL, DOC_TYPE_TONE } from './types'

interface PlanTemplatePickerProps {
  open: boolean
  templates: TemplateVO[]
  isPending: boolean
  onClose: () => void
  onSelect: (templateId: number) => void
}

export function PlanTemplatePicker({
  open,
  templates,
  isPending,
  onClose,
  onSelect,
}: PlanTemplatePickerProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-v2-md border border-v2-border bg-v2-surface p-4 shadow-v2-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-v2-fg">选择方案模板</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {templates.length === 0 && (
            <p className="py-4 text-center text-sm text-v2-muted">暂无可用方案模板</p>
          )}
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              disabled={isPending}
              className="flex w-full items-center gap-2 rounded-v2-md border border-v2-border bg-v2-surface px-3 py-2 text-left text-sm transition-colors hover:border-v2-primary-border hover:bg-v2-surface-hover"
            >
              <FileText className="h-4 w-4 text-v2-muted" />
              <span className="font-semibold text-v2-fg">{t.name}</span>
              <StatusBadge status={DOC_TYPE_TONE[t.docType]}>
                {DOC_TYPE_LABEL[t.docType]}
              </StatusBadge>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
