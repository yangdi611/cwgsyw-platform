'use client'

import type { UseMutationResult } from '@tanstack/react-query'
import type { ChangeDocVO } from './types'
import '@/design-system/figma-neutral/index.css'
import { Button, Input } from '@/design-system/figma-neutral/components'

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
  onApproveCommentChange: (value: string) => void
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
    <div className="cwgsyw-designer__actions cwgsyw-change-doc-detail__action-bar">
      {canReedit && hasPermission('change_doc', 'update') ? (
        <>
          <Button type="button" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {isApproved ? '修改并重新审批' : '修改并重新提交'}
          </Button>
          <span className="cwgsyw-change-doc-detail__action-note">
            {isApproved
              ? '保存后将退回草稿状态，需重新提交审批。'
              : '保存后将退回草稿状态，可重新提交审批。'}
          </span>
        </>
      ) : null}

      {isDraft ? (
        <>
          {hasPermission('change_doc', 'update') ? (
            <Button type="button" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              保存
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
            {doc.applicationTemplateId && !doc.planTemplateId ? '提交申请单（稍后补填方案）' : '提交审批'}
          </Button>
        </>
      ) : null}

      {isPlanPending && hasPermission('change_doc', 'update') ? (
        <>
          <Button type="button" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            保存方案
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => submitPlanMutation.mutate()} disabled={submitPlanMutation.isPending || !doc.planTemplateId}>
            提交方案
          </Button>
        </>
      ) : null}

      {isPending && hasPermission('change_doc', 'approve') ? (
        <>
          <Input
            size="sm"
            aria-label="审批意见"
            placeholder="审批意见（可选）"
            value={approveComment}
            onChange={(event) => onApproveCommentChange(event.target.value)}
          />
          <Button type="button" size="sm" onClick={() => approveMutation.mutate(true)} disabled={approveMutation.isPending}>
            审批通过
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => approveMutation.mutate(false)} disabled={approveMutation.isPending}>
            拒绝
          </Button>
        </>
      ) : null}

      {doc.status === 'approved' ? (
        <>
          {doc.applicationTemplateId ? (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => onExport('application', 'pdf')} disabled={exporting}>
                导出申请单 PDF
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onExport('application', 'docx')} disabled={exporting}>
                导出申请单 Word
              </Button>
            </>
          ) : null}
          {doc.planTemplateId ? (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => onExport('plan', 'pdf')} disabled={exporting}>
                导出方案 PDF
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onExport('plan', 'docx')} disabled={exporting}>
                导出方案 Word
              </Button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
