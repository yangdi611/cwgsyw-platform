'use client'

import type { TemplateVO } from './types'
import { DOC_TYPE_LABEL, DOC_TYPE_TONE } from './types'
import '@/design-system/figma-neutral/index.css'
import { Card, StatusBadge } from '@/design-system/figma-neutral/components'

interface TemplateSelectorProps {
  templates: TemplateVO[]
  selectedAppTemplateId: number | null
  selectedPlanTemplateId: number | null
  onSelectAppTemplate: (id: number | null) => void
  onSelectPlanTemplate: (id: number | null) => void
}

const TONE_MAP = {
  ok: 'success',
  warn: 'warning',
  neutral: 'neutral',
} as const

export function TemplateSelector({
  templates,
  selectedAppTemplateId,
  selectedPlanTemplateId,
  onSelectAppTemplate,
  onSelectPlanTemplate,
}: TemplateSelectorProps) {
  const appTemplates = templates.filter((item) => item.active && (item.docType === 'application' || item.docType === 'general'))
  const planTemplates = templates.filter((item) => item.active && (item.docType === 'plan' || item.docType === 'general'))

  return (
    <Card title="选择模板">
      <div className="cwgsyw-form">
        <div className="cwgsyw-form">
          <strong>1. 选择申请单模板（可选）</strong>
          {appTemplates.length === 0 ? <p>暂无可用模板</p> : null}
          {appTemplates.map((item) => {
            const selected = selectedAppTemplateId === item.id
            return (
              <Card
                key={item.id}
                title={item.name}
                variant={selected ? 'selected' : 'interactive'}
                onClick={() => onSelectAppTemplate(selected ? null : item.id)}
              >
                <StatusBadge label={DOC_TYPE_LABEL[item.docType]} status={TONE_MAP[DOC_TYPE_TONE[item.docType]]} />
              </Card>
            )
          })}
        </div>
        <div className="cwgsyw-form">
          <strong>2. 选择方案模板（可选）</strong>
          {planTemplates.length === 0 ? <p>暂无可用模板</p> : null}
          {planTemplates.map((item) => {
            const selected = selectedPlanTemplateId === item.id
            return (
              <Card
                key={item.id}
                title={item.name}
                variant={selected ? 'selected' : 'interactive'}
                onClick={() => onSelectPlanTemplate(selected ? null : item.id)}
              >
                <StatusBadge label={DOC_TYPE_LABEL[item.docType]} status={TONE_MAP[DOC_TYPE_TONE[item.docType]]} />
              </Card>
            )
          })}
        </div>
        <p>提示：两个模板可以都选或只选其一。只选申请单时，提交后会进入「待补填方案」状态。</p>
      </div>
    </Card>
  )
}
