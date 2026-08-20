'use client'

import type { TemplateVO } from './types'
import { DOC_TYPE_LABEL, DOC_TYPE_TONE } from './types'
import '@/design-system/figma-neutral/index.css'
import { Button, NeutralDialog, StatusBadge } from '@/design-system/figma-neutral/components'

interface PlanTemplatePickerProps {
  open: boolean
  templates: TemplateVO[]
  isPending: boolean
  onClose: () => void
  onSelect: (templateId: number) => void
}

const DOC_TONE = {
  ok: 'success',
  warn: 'warning',
  neutral: 'neutral',
} as const

export function PlanTemplatePicker({
  open,
  templates,
  isPending,
  onClose,
  onSelect,
}: PlanTemplatePickerProps) {
  return (
    <NeutralDialog
      open={open}
      onOpenChange={(next) => { if (!next) onClose() }}
      title="选择方案模板"
      description="为当前变更选择一个方案或通用模板。"
      size="sm"
      footer={<Button type="button" variant="secondary" size="sm" onClick={onClose}>关闭</Button>}
    >
      <div className="cwgsyw-change-doc-plan-picker">
        {templates.length === 0 ? <p>暂无可用方案模板</p> : null}
        {templates.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() => onSelect(item.id)}
          >
            {item.name}
            <StatusBadge size="sm" label={DOC_TYPE_LABEL[item.docType]} status={DOC_TONE[DOC_TYPE_TONE[item.docType]]} />
          </Button>
        ))}
      </div>
    </NeutralDialog>
  )
}
