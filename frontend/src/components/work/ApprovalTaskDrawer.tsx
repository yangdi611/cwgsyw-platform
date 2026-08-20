'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
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
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  ErrorState,
  Field,
  LoadingState,
  NeutralDrawer,
  Select,
  StatusBadge,
  Textarea,
} from '@/design-system/figma-neutral/components'

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

  return (
    <NeutralDrawer
      open={Boolean(approvalTaskId)}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={detail.data?.task.title ?? '审批详情'}
      description={detail.data ? `${detail.data.task.nodeName} · 提交 V${detail.data.submissionVersion}` : undefined}
      className="cwgsyw-work-drawer"
    >
      {detail.isLoading ? (
        <LoadingState label="正在加载审批内容…" />
      ) : detail.isError || !detail.data ? (
        <ErrorState
          title="审批详情加载失败"
          description="无法读取审批内容，请重试。"
          retry={
            <Button type="button" variant="secondary" onClick={() => void detail.refetch()}>
              重试
            </Button>
          }
        />
      ) : (
        <div className="cwgsyw-form">
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
          <div className="cwgsyw-form__actions">
            {detail.data.allowedActions.map((name) => (
              <Button
                key={name}
                type="button"
                size="sm"
                variant={name === 'approve' ? 'primary' : name === 'terminate' ? 'destructive' : 'secondary'}
                loading={action.isPending && action.variables === name}
                disabled={action.isPending}
                onClick={() => action.mutate(name)}
              >
                {approvalActionLabel(name)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </NeutralDrawer>
  )
}

function ApprovalContent({
  detail,
  comment,
  fieldComments,
  attachmentComments,
  downloadingId,
  onCommentChange,
  onFieldCommentChange,
  onAttachmentCommentChange,
  onDownload,
}: {
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
  const attachmentsByField = useMemo(
    () =>
      attachments.reduce((groups, attachment) => {
        const values = groups.get(attachment.fieldKey) ?? []
        values.push(attachment)
        groups.set(attachment.fieldKey, values)
        return groups
      }, new Map<string, typeof attachments>()),
    [attachments],
  )

  return (
    <>
      <div className="cwgsyw-inline-controls">
        <StatusBadge size="sm" label={detail.task.overdue ? '已逾期' : '待审批'} status={detail.task.overdue ? 'danger' : 'warning'} />
        <StatusBadge
          size="sm"
          label={priorityLabel(detail.task.priority)}
          status={detail.task.priority === 'critical' ? 'danger' : detail.task.priority === 'high' ? 'warning' : 'neutral'}
        />
        {detail.task.dueAt ? <span className="cwgsyw-type-label-xs">截止 {new Date(detail.task.dueAt).toLocaleString('zh-CN')}</span> : null}
      </div>

      <section className="cwgsyw-form">
        <div>
          <h3 className="cwgsyw-type-title-sm">提交内容</h3>
          <p className="cwgsyw-type-body-sm">字段意见会随审批动作保存，并在退回后向执行人展示。</p>
        </div>
        {detail.fields.map((field) => {
          const draft = fieldComments[field.key] ?? { severity: 'error' as const, comment: '' }
          return (
            <article key={field.key} className="cwgsyw-work-drawer__field">
              <div className="cwgsyw-inline-controls">
                <span className="cwgsyw-work-drawer__label">{field.label}</span>
                <StatusBadge size="sm" label={field.type} status="neutral" />
                {field.sensitive ? <StatusBadge size="sm" label="敏感" status="warning" /> : null}
              </div>
              <div className="cwgsyw-type-body-sm">{renderValue(field, detail.formData[field.key], detail.computedValues[field.key])}</div>
              {(attachmentsByField.get(field.key) ?? []).map((attachment) => (
                <div key={attachment.id} className="cwgsyw-form">
                  <div className="cwgsyw-inline-controls">
                    <span className="cwgsyw-type-body-sm">{attachment.fileName}</span>
                    <span className="cwgsyw-type-label-xs">{formatBytes(attachment.sizeBytes)}</span>
                    <Button type="button" size="sm" variant="ghost" disabled={downloadingId === attachment.id} onClick={() => void onDownload(attachment.id, attachment.fileName)}>
                      下载
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    value={attachmentComments[attachment.id] ?? ''}
                    placeholder="添加附件意见（可选）"
                    onChange={(event) => onAttachmentCommentChange(attachment.id, event.target.value)}
                  />
                </div>
              ))}
              {field.type === 'table' ? (
                <TableAttachments
                  field={field}
                  attachments={attachments}
                  comments={attachmentComments}
                  downloadingId={downloadingId}
                  onCommentChange={onAttachmentCommentChange}
                  onDownload={onDownload}
                />
              ) : null}
              {!['section', 'help_text'].includes(field.type) ? (
                <div className="cwgsyw-form">
                  <Select
                    overlay
                    size="sm"
                    aria-label={`${field.label} 意见级别`}
                    value={draft.severity}
                    options={[
                      { value: 'info', label: '提示' },
                      { value: 'warning', label: '注意' },
                      { value: 'error', label: '需修改' },
                    ]}
                    onChange={(value) => onFieldCommentChange(field.key, { ...draft, severity: value as FieldCommentDraft['severity'] })}
                  />
                  <Textarea
                    rows={2}
                    value={draft.comment}
                    placeholder="添加字段意见（可选）"
                    onChange={(event) => onFieldCommentChange(field.key, { ...draft, comment: event.target.value })}
                  />
                </div>
              ) : null}
            </article>
          )
        })}
      </section>

      <Field htmlFor="approval-comment" label="审批意见 / 退回理由">
        <Textarea
          id="approval-comment"
          rows={4}
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="通过时可选；退回修改、退回上一节点或终止时必填"
        />
      </Field>
    </>
  )
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

function requiresReason(action: ApprovalActionName) {
  return action !== 'approve'
}
function priorityLabel(priority: string) {
  return { low: '低', normal: '普通', high: '高', critical: '紧急' }[priority] ?? priority
}
function formatBytes(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}
function renderValue(field: TaskFieldDefinition, value: unknown, computedValue: unknown) {
  const shown = computedValue ?? value
  if (field.type === 'section') return <span className="cwgsyw-type-label-xs">表单分区</span>
  if (field.type === 'help_text') return <span className="cwgsyw-type-label-xs">{field.label}</span>
  if (shown == null || shown === '') return <span className="cwgsyw-type-label-xs">未填写</span>
  if (typeof shown === 'boolean') return shown ? '是' : '否'
  if (field.type === 'table' && Array.isArray(shown)) return <ReadonlyTable field={field} rows={shown} />
  if (typeof shown === 'object') return <pre className="cwgsyw-type-label-xs">{JSON.stringify(shown, null, 2)}</pre>
  return String(shown)
}

function ReadonlyTable({ field, rows }: { field: TaskFieldDefinition; rows: unknown[] }) {
  const columns = Array.isArray(field.validation?.columns) ? field.validation.columns.filter(isTableColumn) : []
  if (columns.length === 0) return <span className="cwgsyw-type-label-xs">表格未配置列</span>
  return (
    <table className="cwgsyw-preview">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.filter(isRow).map((row, rowIndex) => (
          <tr key={String(row.__rowId ?? rowIndex)}>
            {columns.map((column) => (
              <td key={column.key}>{formatTableCell(row[column.key])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TableAttachments({
  field,
  attachments,
  comments,
  downloadingId,
  onCommentChange,
  onDownload,
}: {
  field: TaskFieldDefinition
  attachments: Awaited<ReturnType<typeof getApprovalTask>>['attachments']
  comments: Record<number, string>
  downloadingId?: number
  onCommentChange: (id: number, value: string) => void
  onDownload: (id: number, fileName: string) => Promise<void>
}) {
  const prefix = `${field.key}~`
  const tableAttachments = attachments.filter((attachment) => attachment.fieldKey.startsWith(prefix))
  if (tableAttachments.length === 0) return null
  const columns = Array.isArray(field.validation?.columns) ? field.validation.columns.filter(isTableColumn) : []
  return (
    <div className="cwgsyw-form">
      <p className="cwgsyw-type-label-xs">表格行内附件</p>
      {tableAttachments.map((attachment) => {
        const [, rowId, columnKey] = attachment.fieldKey.split('~')
        const column = columns.find((item) => item.key === columnKey)
        return (
          <div key={attachment.id} className="cwgsyw-form">
            <div className="cwgsyw-inline-controls">
              <span className="cwgsyw-type-body-sm">
                第 {rowId?.slice(0, 6) ?? '-'} 行 · {column?.label ?? columnKey} · {attachment.fileName}
              </span>
              <Button type="button" size="sm" variant="ghost" disabled={downloadingId === attachment.id} onClick={() => void onDownload(attachment.id, attachment.fileName)}>
                下载
              </Button>
            </div>
            <Textarea rows={2} value={comments[attachment.id] ?? ''} placeholder="添加附件意见（可选）" onChange={(event) => onCommentChange(attachment.id, event.target.value)} />
          </div>
        )
      })}
    </div>
  )
}

type TableColumn = { key: string; label: string }
function isTableColumn(value: unknown): value is TableColumn {
  return typeof value === 'object' && value !== null && 'key' in value && 'label' in value
}
function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
function formatTableCell(value: unknown) {
  if (value == null || value === '') return '-'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
