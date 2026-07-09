import { Button } from '@/components/v2/Button'
import { Card, CardContent } from '@/components/v2/Card'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { FileText } from 'lucide-react'
import type { TemplateVO } from './types'
import { DOC_TYPE_LABEL, DOC_TYPE_TONE } from './types'

interface TemplateSelectorProps {
  templates: TemplateVO[]
  selectedAppTemplateId: number | null
  selectedPlanTemplateId: number | null
  onSelectAppTemplate: (id: number | null) => void
  onSelectPlanTemplate: (id: number | null) => void
}

export function TemplateSelector({
  templates,
  selectedAppTemplateId,
  selectedPlanTemplateId,
  onSelectAppTemplate,
  onSelectPlanTemplate,
}: TemplateSelectorProps) {
  const appTemplates = templates.filter(
    (t) => t.active && (t.docType === 'application' || t.docType === 'general'),
  )
  const planTemplates = templates.filter(
    (t) => t.active && (t.docType === 'plan' || t.docType === 'general'),
  )

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h3 className="mb-2 text-sm font-bold text-v2-fg">1. 选择申请单模板（可选）</h3>
          <div className="space-y-2">
            {appTemplates.length === 0 && (
              <p className="text-sm text-v2-muted">暂无可用模板</p>
            )}
            {appTemplates.map((t) => {
              const isSelected = selectedAppTemplateId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectAppTemplate(isSelected ? null : t.id)}
                  className={
                    'flex w-full items-center gap-2 rounded-v2-md border px-3 py-2 text-left text-sm transition-colors ' +
                    (isSelected
                      ? 'border-v2-primary bg-v2-primary-soft'
                      : 'border-v2-border bg-v2-surface hover:border-v2-primary-border hover:bg-v2-surface-hover')
                  }
                >
                  <FileText className="h-4 w-4 text-v2-muted" />
                  <span className="flex-1 font-semibold text-v2-fg">{t.name}</span>
                  <StatusBadge status={DOC_TYPE_TONE[t.docType]}>
                    {DOC_TYPE_LABEL[t.docType]}
                  </StatusBadge>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold text-v2-fg">2. 选择方案模板（可选）</h3>
          <div className="space-y-2">
            {planTemplates.length === 0 && (
              <p className="text-sm text-v2-muted">暂无可用模板</p>
            )}
            {planTemplates.map((t) => {
              const isSelected = selectedPlanTemplateId === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectPlanTemplate(isSelected ? null : t.id)}
                  className={
                    'flex w-full items-center gap-2 rounded-v2-md border px-3 py-2 text-left text-sm transition-colors ' +
                    (isSelected
                      ? 'border-v2-primary bg-v2-primary-soft'
                      : 'border-v2-border bg-v2-surface hover:border-v2-primary-border hover:bg-v2-surface-hover')
                  }
                >
                  <FileText className="h-4 w-4 text-v2-muted" />
                  <span className="flex-1 font-semibold text-v2-fg">{t.name}</span>
                  <StatusBadge status={DOC_TYPE_TONE[t.docType]}>
                    {DOC_TYPE_LABEL[t.docType]}
                  </StatusBadge>
                </button>
              )
            })}
          </div>
        </div>

        <p className="text-xs text-v2-muted">
          提示：两个模板可以都选或只选其一。只选申请单时，提交后会进入「待补填方案」状态。
        </p>
      </CardContent>
    </Card>
  )
}
