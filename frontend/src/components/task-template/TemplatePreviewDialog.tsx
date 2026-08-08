'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, StatusBadge } from '@/components/design-system'
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{role === 'approver' ? '审批人视图' : '执行人视图'}预览</DialogTitle></DialogHeader>
        {loading ? <p className="py-12 text-center text-sm text-v2-muted">正在生成服务端预览…</p> : preview ? (
          <div className="space-y-4">
            <div><h2 className="text-lg font-semibold text-v2-fg">{preview.schema.name}</h2><p className="mt-1 text-sm text-v2-muted">{preview.schema.description}</p></div>
            {preview.schema.fields.map((field) => (
              <div key={field.key} className="rounded-v2-lg border border-v2-border p-3">
                <div className="flex items-center gap-2"><span className="font-medium text-v2-fg">{field.label}</span>{preview.requiredFields[field.key] && <span className="text-v2-danger">*</span>}<StatusBadge status="neutral">{field.type}</StatusBadge></div>
                <p className="mt-2 text-sm text-v2-muted">{role === 'approver' ? '只读查看提交值' : '执行人填写区域'}</p>
                {preview.computedValues[field.key] !== undefined && <p className="mt-2 rounded bg-v2-primary-soft p-2 font-v2-mono text-xs text-v2-primary">计算值：{String(preview.computedValues[field.key])}</p>}
              </div>
            ))}
            {preview.valueIssues.length > 0 && <div className="rounded-v2-lg border border-v2-warning-border bg-v2-warning-soft p-3"><p className="font-semibold text-v2-warning">预览值提示</p>{preview.valueIssues.map((issue, index) => <p key={`${issue.code}-${index}`} className="mt-1 text-xs text-v2-warning">{issue.fieldKey ? `${issue.fieldKey}: ` : ''}{issue.message}</p>)}</div>}
          </div>
        ) : <p className="py-12 text-center text-sm text-v2-muted">暂无预览数据</p>}
      </DialogContent>
    </Dialog>
  )
}
