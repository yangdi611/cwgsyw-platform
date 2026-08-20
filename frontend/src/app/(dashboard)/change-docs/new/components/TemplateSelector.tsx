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
      <div className="cwgsyw-change-doc-template-selector">
        <section className="cwgsyw-change-doc-template-selector__group" aria-labelledby="change-doc-application-template-label">
          <div className="cwgsyw-change-doc-template-selector__heading">
            <h3 id="change-doc-application-template-label">申请单模板</h3>
            <span>可选</span>
          </div>
          <p>定义申请信息、影响范围与审批所需字段。</p>
          {appTemplates.length === 0 ? <p className="cwgsyw-change-doc-template-selector__empty">暂无可用模板</p> : null}
          <div className="cwgsyw-change-doc-template-selector__grid">
            {appTemplates.map((item) => {
              const selected = selectedAppTemplateId === item.id
              return (
                <Card
                  key={item.id}
                  title={item.name}
                  variant={selected ? 'selected' : 'interactive'}
                  padding="sm"
                  onClick={() => onSelectAppTemplate(selected ? null : item.id)}
                >
                  <StatusBadge size="sm" label={DOC_TYPE_LABEL[item.docType]} status={TONE_MAP[DOC_TYPE_TONE[item.docType]]} />
                </Card>
              )
            })}
          </div>
        </section>
        <section className="cwgsyw-change-doc-template-selector__group" aria-labelledby="change-doc-plan-template-label">
          <div className="cwgsyw-change-doc-template-selector__heading">
            <h3 id="change-doc-plan-template-label">方案模板</h3>
            <span>可选</span>
          </div>
          <p>定义实施步骤、回退方案与验证内容。</p>
          {planTemplates.length === 0 ? <p className="cwgsyw-change-doc-template-selector__empty">暂无可用模板</p> : null}
          <div className="cwgsyw-change-doc-template-selector__grid">
            {planTemplates.map((item) => {
              const selected = selectedPlanTemplateId === item.id
              return (
                <Card
                  key={item.id}
                  title={item.name}
                  variant={selected ? 'selected' : 'interactive'}
                  padding="sm"
                  onClick={() => onSelectPlanTemplate(selected ? null : item.id)}
                >
                  <StatusBadge size="sm" label={DOC_TYPE_LABEL[item.docType]} status={TONE_MAP[DOC_TYPE_TONE[item.docType]]} />
                </Card>
              )
            })}
          </div>
        </section>
        <p className="cwgsyw-change-doc-template-selector__note">两个模板可以同时选择或只选其一；仅选择申请单时，提交后进入「待补填方案」状态。</p>
      </div>
    </Card>
  )
}
