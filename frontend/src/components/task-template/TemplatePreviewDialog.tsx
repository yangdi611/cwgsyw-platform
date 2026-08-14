'use client'

import { NeutralDialog, StatusBadge } from '@/design-system/figma-neutral/components'
import type { PreviewRole, TemplatePreview } from '@/lib/task-template-api'

export function TemplatePreviewDialog({
  open,
  role,
  preview,
  loading,
  onOpenChange,
}: {
  open: boolean
  role: PreviewRole
  preview?: TemplatePreview
  loading: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <NeutralDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={role === 'approver' ? '审批人视图预览' : '执行人视图预览'}
      description={loading ? '正在生成服务端预览…' : preview?.schema.description}
    >
      {loading ? (
        <p className="cwgsyw-type-body-sm">正在生成服务端预览…</p>
      ) : preview ? (
        <div className="cwgsyw-form">
          <div>
            <h2 className="cwgsyw-type-title-sm">{preview.schema.name}</h2>
            <p className="cwgsyw-type-body-sm">{preview.schema.description}</p>
          </div>
          {preview.schema.fields.map((field) => (
            <div key={field.key} className="cwgsyw-designer__table-col">
              <div className="cwgsyw-designer__chips">
                <strong>{field.label}</strong>
                {preview.requiredFields[field.key] ? <span className="cwgsyw-field__required">*</span> : null}
                <StatusBadge label={field.type} status="neutral" size="sm" />
              </div>
              <p className="cwgsyw-type-body-sm">{role === 'approver' ? '只读查看提交值' : '执行人填写区域'}</p>
              {preview.computedValues[field.key] !== undefined ? (
                <p className="cwgsyw-type-label-xs">计算值：{String(preview.computedValues[field.key])}</p>
              ) : null}
            </div>
          ))}
          {preview.valueIssues.length > 0 ? (
            <div className="cwgsyw-designer__table-col">
              <p className="cwgsyw-type-title-sm">预览值提示</p>
              {preview.valueIssues.map((issue, index) => (
                <p key={`${issue.code}-${index}`} className="cwgsyw-type-label-xs">
                  {issue.fieldKey ? `${issue.fieldKey}: ` : ''}{issue.message}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="cwgsyw-type-body-sm">暂无预览数据</p>
      )}
    </NeutralDialog>
  )
}
