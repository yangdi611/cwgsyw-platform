'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download, Paperclip, RotateCcw, SquareX } from 'lucide-react'
import { toast } from 'sonner'
import { DetailDrawer, ErrorState, LoadingState } from '@/components/shared'
import { Button } from '@/components/v2/Button'
import { Label } from '@/components/v2/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { Textarea } from '@/components/v2/Textarea'
import {
  actOnApprovalTask,
  approvalActionLabel,
  downloadApprovalAttachment,
  getApprovalTask,
  type ApprovalActionName,
  type ApprovalAttachmentComment,
  type ApprovalFieldComment,
} from '@/lib/approval-api'
import { getApiErrorMessage } from '@/lib/api-error'
import type { TaskFieldDefinition } from '@/lib/task-template-api'

type FieldCommentDraft = { severity: ApprovalFieldComment['severity']; comment: string }

export function ApprovalTaskDrawer({ approvalTaskId, onClose }: { approvalTaskId?: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const detail = useQuery({
    queryKey: ['approval-task', approvalTaskId],
    queryFn: () => getApprovalTask(approvalTaskId as string),
    enabled: Boolean(approvalTaskId),
  })
  const [comment, setComment] = useState('')
  const [fieldComments, setFieldComments] = useState<Record<string, FieldCommentDraft>>({})
  const [attachmentComments, setAttachmentComments] = useState<Record<number, string>>({})
  const [downloadingId, setDownloadingId] = useState<number>()
  const action = useMutation({
    mutationFn: (name: ApprovalActionName) => {
      const payload = buildPayload(name, comment, fieldComments, attachmentComments)
      if (requiresReason(name) && !payload.comment) throw new Error('退回或终止必须填写理由')
      return actOnApprovalTask(approvalTaskId as string, payload)
    },
    onSuccess: async (_, name) => {
      toast.success(`已${approvalActionLabel(name)}`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['work-items'] }),
        queryClient.invalidateQueries({ queryKey: ['work-item-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['approval-task', approvalTaskId] }),
      ])
      onClose()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '审批操作失败')),
  })

  const footer = detail.data ? (
    <div className="flex flex-wrap justify-end gap-2">
      {detail.data.allowedActions.map((name) => (
        <Button
          key={name}
          variant={name === 'approve' ? 'primary' : name === 'terminate' ? 'danger' : 'secondary'}
          disabled={action.isPending}
          onClick={() => action.mutate(name)}
        >
          {actionIcon(name)}
          {action.isPending && action.variables === name ? '处理中' : approvalActionLabel(name)}
        </Button>
      ))}
    </div>
  ) : undefined

  return (
    <DetailDrawer
      open={Boolean(approvalTaskId)}
      onClose={onClose}
      title={detail.data?.task.title ?? '审批详情'}
      subtitle={detail.data ? `${detail.data.task.nodeName} · 提交 V${detail.data.submissionVersion}` : undefined}
      width="min(760px, 100vw)"
      footer={footer}
    >
      {detail.isLoading ? <LoadingState label="正在加载审批内容…" /> : detail.isError || !detail.data ? (
        <ErrorState title="审批详情加载失败" onRetry={() => detail.refetch()} />
      ) : (
        <ApprovalContent
          detail={detail.data}
          comment={comment}
          fieldComments={fieldComments}
          attachmentComments={attachmentComments}
          downloadingId={downloadingId}
          onCommentChange={setComment}
          onFieldCommentChange={(fieldKey, value) => setFieldComments((current) => ({ ...current, [fieldKey]: value }))}
          onAttachmentCommentChange={(attachmentId, value) => setAttachmentComments((current) => ({ ...current, [attachmentId]: value }))}
          onDownload={async (attachmentId, fileName) => {
            setDownloadingId(attachmentId)
            try {
              await downloadApprovalAttachment(approvalTaskId as string, attachmentId, fileName)
            } catch (error) {
              toast.error(getApiErrorMessage(error, '附件下载失败'))
            } finally {
              setDownloadingId(undefined)
            }
          }}
        />
      )}
    </DetailDrawer>
  )
}

function ApprovalContent({ detail, comment, fieldComments, attachmentComments, downloadingId, onCommentChange, onFieldCommentChange, onAttachmentCommentChange, onDownload }: {
  detail: Awaited<ReturnType<typeof getApprovalTask>>
  comment: string
  fieldComments: Record<string, FieldCommentDraft>
  attachmentComments: Record<number, string>
  downloadingId?: number
  onCommentChange: (value: string) => void
  onFieldCommentChange: (fieldKey: string, value: FieldCommentDraft) => void
  onAttachmentCommentChange: (attachmentId: number, value: string) => void
  onDownload: (attachmentId: number, fileName: string) => Promise<void>
}) {
  const attachments = detail.attachments
  const attachmentsByField = useMemo(() => attachments.reduce((groups, attachment) => {
    const values = groups.get(attachment.fieldKey) ?? []
    values.push(attachment)
    groups.set(attachment.fieldKey, values)
    return groups
  }, new Map<string, typeof attachments>()), [attachments])
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={detail.task.overdue ? 'danger' : 'warn'}>{detail.task.overdue ? '已逾期' : '待审批'}</StatusBadge>
      <StatusBadge status={detail.task.priority === 'critical' ? 'danger' : detail.task.priority === 'high' ? 'warn' : 'neutral'}>{priorityLabel(detail.task.priority)}</StatusBadge>
      {detail.task.dueAt && <span className="text-xs text-v2-muted">截止 {new Date(detail.task.dueAt).toLocaleString('zh-CN')}</span>}
    </div>

    <section className="space-y-3">
      <div><h3 className="font-semibold text-v2-fg">提交内容</h3><p className="mt-1 text-xs text-v2-muted">字段意见会随审批动作保存，并在退回后向执行人展示。</p></div>
      {detail.fields.map((field) => {
        const draft = fieldComments[field.key] ?? { severity: 'error' as const, comment: '' }
        return <div key={field.key} className="rounded-v2-md border border-v2-border p-4">
          <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-v2-fg">{field.label}</span><StatusBadge status="neutral">{field.type}</StatusBadge>{field.sensitive && <StatusBadge status="warn">敏感</StatusBadge>}</div>
          <div className="mt-3 rounded-v2-md bg-v2-surface-soft p-3 text-sm text-v2-fg">{renderValue(field, detail.formData[field.key], detail.computedValues[field.key])}</div>
          {(attachmentsByField.get(field.key) ?? []).map((attachment) => (
            <div key={attachment.id} className="mt-3 space-y-2 rounded-v2-md border border-v2-border bg-v2-surface-soft p-3">
              <div className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-v2-muted" /><span className="min-w-0 flex-1 truncate text-sm text-v2-fg">{attachment.fileName}</span><span className="text-xs text-v2-muted">{formatBytes(attachment.sizeBytes)}</span><Button size="sm" variant="ghost" title="下载附件" disabled={downloadingId === attachment.id} onClick={() => void onDownload(attachment.id, attachment.fileName)}><Download className="h-4 w-4" /></Button></div>
              <Textarea rows={2} value={attachmentComments[attachment.id] ?? ''} placeholder="添加附件意见（可选）" onChange={(event) => onAttachmentCommentChange(attachment.id, event.target.value)} />
            </div>
          ))}
          {!['section', 'help_text'].includes(field.type) && <div className="mt-3 grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]"><Select value={draft.severity} onValueChange={(value) => onFieldCommentChange(field.key, { ...draft, severity: value as FieldCommentDraft['severity'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">提示</SelectItem><SelectItem value="warning">注意</SelectItem><SelectItem value="error">需修改</SelectItem></SelectContent></Select><Textarea rows={2} value={draft.comment} placeholder="添加字段意见（可选）" onChange={(event) => onFieldCommentChange(field.key, { ...draft, comment: event.target.value })} /></div>}
        </div>
      })}
    </section>

    <section className="space-y-2"><Label htmlFor="approval-comment">审批意见 / 退回理由</Label><Textarea id="approval-comment" rows={4} value={comment} onChange={(event) => onCommentChange(event.target.value)} placeholder="通过时可选；退回修改、退回上一节点或终止时必填" /></section>
  </div>
}

function buildPayload(action: ApprovalActionName, comment: string, fields: Record<string, FieldCommentDraft>, attachments: Record<number, string>) {
  const fieldComments: ApprovalFieldComment[] = Object.entries(fields)
    .filter(([, value]) => value.comment.trim())
    .map(([fieldKey, value]) => ({ fieldKey, severity: value.severity, comment: value.comment.trim() }))
  const attachmentComments: ApprovalAttachmentComment[] = Object.entries(attachments)
    .filter(([, value]) => value.trim())
    .map(([attachmentId, value]) => ({ attachmentId: Number(attachmentId), comment: value.trim() }))
  return { action, comment: comment.trim() || undefined, fieldComments, attachmentComments }
}

function requiresReason(action: ApprovalActionName) { return action !== 'approve' }
function actionIcon(action: ApprovalActionName) {
  if (action === 'approve') return <Check className="h-4 w-4" />
  if (action === 'terminate') return <SquareX className="h-4 w-4" />
  return <RotateCcw className="h-4 w-4" />
}
function priorityLabel(priority: string) { return { low: '低', normal: '普通', high: '高', critical: '紧急' }[priority] ?? priority }
function formatBytes(size: number) { return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB` }
function renderValue(field: TaskFieldDefinition, value: unknown, computedValue: unknown) {
  const shown = computedValue ?? value
  if (field.type === 'section') return <span className="text-v2-muted">表单分区</span>
  if (field.type === 'help_text') return <span className="text-v2-muted">{field.label}</span>
  if (shown == null || shown === '') return <span className="text-v2-subtle">未填写</span>
  if (typeof shown === 'boolean') return shown ? '是' : '否'
  if (typeof shown === 'object') return <pre className="overflow-auto whitespace-pre-wrap font-v2-mono text-xs">{JSON.stringify(shown, null, 2)}</pre>
  return String(shown)
}
