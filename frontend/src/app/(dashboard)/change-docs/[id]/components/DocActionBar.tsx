'use client'

import type { UseMutationResult } from '@tanstack/react-query'
import { Button, Input } from '@/components/design-system'
import { Download, Save, Send, Check, X } from 'lucide-react'
import type { ChangeDocVO } from './types'

interface DocActionBarProps {
  doc: ChangeDocVO
  isDraft: boolean
  isPlanPending: boolean
  isPending: boolean
  canReedit: boolean
  isApproved: boolean
  hasPermission: (resource: string, action: string) => boolean
  saveMutation: UseMutationResult<unknown, unknown, void>
  submitMutation: UseMutationResult<unknown, unknown, void>
  submitPlanMutation: UseMutationResult<unknown, unknown, void>
  approveMutation: UseMutationResult<unknown, unknown, boolean>
  approveComment: string
  onApproveCommentChange: (v: string) => void
  exporting: boolean
  onExport: (which: 'application' | 'plan', format: 'pdf' | 'docx') => void
}

export function DocActionBar({
  doc,
  isDraft,
  isPlanPending,
  isPending,
  canReedit,
  isApproved,
  hasPermission,
  saveMutation,
  submitMutation,
  submitPlanMutation,
  approveMutation,
  approveComment,
  onApproveCommentChange,
  exporting,
  onExport,
}: DocActionBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* approved / rejected → 可修改重审 */}
      {canReedit && hasPermission('change_doc', 'update') && (
        <>
          <Button
            variant="primary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4" />
            {isApproved ? '修改并重新审批' : '修改并重新提交'}
          </Button>
          <span className="self-center text-xs text-v2-muted">
            {isApproved
              ? '保存后将退回草稿状态，需重新提交审批。'
              : '保存后将退回草稿状态，可重新提交审批。'}
          </span>
        </>
      )}

      {/* draft：保存 + 提交 */}
      {isDraft && (
        <>
          {hasPermission('change_doc', 'update') && (
            <Button
              variant="primary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="h-4 w-4" />
              保存
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
          >
            <Send className="h-4 w-4" />
            {doc.applicationTemplateId && !doc.planTemplateId
              ? '提交申请单（稍后补填方案）'
              : '提交审批'}
          </Button>
        </>
      )}

      {/* plan_pending：保存 + 提交方案 */}
      {isPlanPending && hasPermission('change_doc', 'update') && (
        <>
          <Button
            variant="primary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4" />
            保存方案
          </Button>
          <Button
            variant="secondary"
            onClick={() => submitPlanMutation.mutate()}
            disabled={submitPlanMutation.isPending || !doc.planTemplateId}
          >
            <Send className="h-4 w-4" />
            提交方案
          </Button>
        </>
      )}

      {/* pending：审批 */}
      {isPending && hasPermission('change_doc', 'approve') && (
        <>
          <Input
            placeholder="审批意见（可选）"
            value={approveComment}
            onChange={(e) => onApproveCommentChange(e.target.value)}
            className="max-w-xs flex-1"
          />
          <Button
            variant="primary"
            onClick={() => approveMutation.mutate(true)}
            disabled={approveMutation.isPending}
          >
            <Check className="h-4 w-4" />
            审批通过
          </Button>
          <Button
            variant="danger"
            onClick={() => approveMutation.mutate(false)}
            disabled={approveMutation.isPending}
          >
            <X className="h-4 w-4" />
            拒绝
          </Button>
        </>
      )}

      {/* approved：导出 */}
      {doc.status === 'approved' && (
        <>
          {doc.applicationTemplateId && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onExport('application', 'pdf')}
                disabled={exporting}
              >
                <Download className="h-4 w-4" />
                导出申请单 PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onExport('application', 'docx')}
                disabled={exporting}
              >
                <Download className="h-4 w-4" />
                导出申请单 Word
              </Button>
            </>
          )}
          {doc.planTemplateId && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onExport('plan', 'pdf')}
                disabled={exporting}
              >
                <Download className="h-4 w-4" />
                导出方案 PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onExport('plan', 'docx')}
                disabled={exporting}
              >
                <Download className="h-4 w-4" />
                导出方案 Word
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}
