'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import { DynamicTaskForm } from '@/components/task-runtime/DynamicTaskForm'
import { TaskPanel } from '@/components/task-runtime/TaskEmpty'
import '@/components/task-runtime/tasks.css'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  downloadTaskSubmissionAttachment,
  getTaskSubmissionDiff,
  listTaskSubmissions,
  type TaskSubmission,
  type TaskSubmissionFieldChange,
} from '@/lib/task-runtime-api'
import type { TaskFieldDefinition } from '@/lib/task-template-api'
import {
  Alert,
  Button,
  Select,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

interface SubmissionHistoryCardProps {
  taskId: number
  currentSubmissionId?: number
  attachmentFeedback: Record<number, string[]>
  fields: TaskFieldDefinition[]
}

export function SubmissionHistoryCard({ taskId, currentSubmissionId, attachmentFeedback, fields }: SubmissionHistoryCardProps) {
  const submissions = useQuery({
    queryKey: ['task-submissions', taskId],
    queryFn: () => listTaskSubmissions(taskId),
  })
  const [selectedId, setSelectedId] = useState<number>()
  const [downloadingId, setDownloadingId] = useState<number>()

  const selected = submissions.data?.find((item) => item.id === selectedId)
    ?? submissions.data?.find((item) => item.id === currentSubmissionId)
    ?? submissions.data?.[0]
  const previous = submissions.data?.find((item) => item.id === selected?.supersedesSubmissionId)
  const diff = useQuery({
    queryKey: ['task-submission-diff', taskId, selected?.id, selected?.supersedesSubmissionId],
    queryFn: () => getTaskSubmissionDiff(taskId, selected!.id, selected!.supersedesSubmissionId!),
    enabled: Boolean(selected?.supersedesSubmissionId),
  })
  const attachmentChanges = useMemo(() => compareAttachments(previous, selected), [previous, selected])

  if (submissions.isLoading) {
    return <TaskPanel title="历史提交与差异"><p className="cwgsyw-tasks-cell-meta">正在加载提交历史…</p></TaskPanel>
  }
  if (submissions.isError) {
    return (
      <TaskPanel
        title="历史提交与差异"
        action={<Button type="button" size="sm" variant="secondary" onClick={() => void submissions.refetch()}>重试</Button>}
      >
        <Alert tone="danger" title="提交历史加载失败" description="无法读取历史提交，请重试。" showDismiss={false} />
      </TaskPanel>
    )
  }
  if (!selected || !submissions.data?.length) return null

  return (
    <TaskPanel
      title="历史提交与差异"
      description="正式提交不可修改，每次重提都会保留上一版本。"
      action={
        <Select
          size="sm"
          overlay
          aria-label="选择提交版本"
          value={String(selected.id)}
          options={submissions.data.map((submission) => ({
            value: String(submission.id),
            label: `V${submission.version} · ${submissionStatusLabel(submission.status)} · ${formatDate(submission.submittedAt)}`,
          }))}
          onChange={(value) => setSelectedId(Number(value))}
        />
      }
    >
      <div className="cwgsyw-form">
        <div className="cwgsyw-inline-controls">
          <p className="cwgsyw-tasks-event__title">提交 V{selected.version}</p>
          <StatusBadge label={submissionStatusLabel(selected.status)} status={submissionStatusTone(selected.status)} />
          {selected.effective ? <StatusBadge label="统计生效" status="success" /> : null}
          <span className="cwgsyw-type-label-xs">{formatDateTime(selected.submittedAt)}</span>
        </div>

        <section className="cwgsyw-form">
          <p className="cwgsyw-tasks-event__title">提交内容</p>
          <DynamicTaskForm
            taskId={taskId}
            fields={fields}
            values={selected.formData}
            attachments={selected.attachments}
            readOnly
            onChange={() => undefined}
            onUpload={async () => undefined}
            onDeleteAttachment={async () => undefined}
            attachmentFeedback={attachmentFeedback}
          />
        </section>

        <section className="cwgsyw-form">
          <p className="cwgsyw-tasks-event__title">附件</p>
          {selected.attachments.length === 0 ? (
            <p className="cwgsyw-type-body-sm">无附件</p>
          ) : (
            selected.attachments.map((attachment) => (
              <div key={attachment.id} className="cwgsyw-stack-list">
                <div className="cwgsyw-inline-controls">
                  <span className="cwgsyw-type-body-sm">{attachment.fileName}</span>
                  <span className="cwgsyw-type-label-xs">{formatBytes(attachment.sizeBytes)}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={downloadingId === attachment.id}
                    onClick={async () => {
                      setDownloadingId(attachment.id)
                      try {
                        await downloadTaskSubmissionAttachment(taskId, selected.id, attachment.id, attachment.fileName)
                      } catch (error) {
                        toast.error(getApiErrorMessage(error, '附件下载失败'))
                      } finally {
                        setDownloadingId(undefined)
                      }
                    }}
                  >
                    {downloadingId === attachment.id ? '下载中' : '下载'}
                  </Button>
                </div>
                {attachmentFeedback[attachment.id]?.map((comment, index) => (
                  <Alert key={`${attachment.id}:${index}`} tone="warning" title="附件意见" description={comment} showDismiss={false} />
                ))}
              </div>
            ))
          )}
        </section>

        {selected.supersedesSubmissionId ? (
          <section className="cwgsyw-form">
            <h4 className="cwgsyw-type-title-sm">相对 V{previous?.version ?? '?'} 的变化</h4>
            {diff.isLoading ? <p className="cwgsyw-type-body-sm">正在计算字段差异...</p> : null}
            {diff.isError ? (
              <div className="cwgsyw-inline-controls">
                <Alert tone="danger" title="字段差异加载失败" description="无法比较提交版本。" showDismiss={false} />
                <Button type="button" size="sm" variant="secondary" onClick={() => void diff.refetch()}>重试</Button>
              </div>
            ) : null}
            {diff.data ? <FieldDiff changes={diff.data.changes} /> : null}
            <AttachmentDiff changes={attachmentChanges} />
          </section>
        ) : null}
      </div>
    </TaskPanel>
  )
}

function FieldDiff({ changes }: { changes: Record<string, TaskSubmissionFieldChange> }) {
  const entries = Object.entries(changes)
  if (entries.length === 0) return <p className="cwgsyw-type-body-sm">表单字段无变化</p>
  return (
    <div className="cwgsyw-table-wrap">
      <table className="cwgsyw-table cwgsyw-table--compact">
        <thead>
          <tr>
            <th className="cwgsyw-th">字段</th>
            <th className="cwgsyw-th">变更前</th>
            <th className="cwgsyw-th">变更后</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, change]) => (
            <tr key={key}>
              <td className="cwgsyw-td">{key}</td>
              <td className="cwgsyw-td"><Value value={change.before} /></td>
              <td className="cwgsyw-td"><Value value={change.after} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface AttachmentChange {
  key: string
  kind: 'added' | 'removed'
  fileName: string
  fieldKey: string
}

function AttachmentDiff({ changes }: { changes: AttachmentChange[] }) {
  if (changes.length === 0) return <p className="cwgsyw-type-body-sm">附件无变化</p>
  return (
    <div className="cwgsyw-stack-list">
      {changes.map((change) => (
        <Alert
          key={change.key}
          tone={change.kind === 'added' ? 'success' : 'danger'}
          title={change.kind === 'added' ? '新增附件' : '移除附件'}
          description={`${change.fileName} · ${change.fieldKey}`}
          showDismiss={false}
        />
      ))}
    </div>
  )
}

function compareAttachments(previous?: TaskSubmission, current?: TaskSubmission): AttachmentChange[] {
  if (!previous || !current) return []
  const identity = (item: TaskSubmission['attachments'][number]) => `${item.fieldKey}:${item.checksum || item.fileName}`
  const previousKeys = new Set(previous.attachments.map(identity))
  const currentKeys = new Set(current.attachments.map(identity))
  return [
    ...current.attachments.filter((item) => !previousKeys.has(identity(item))).map((item) => ({ key: `added:${identity(item)}`, kind: 'added' as const, fileName: item.fileName, fieldKey: item.fieldKey })),
    ...previous.attachments.filter((item) => !currentKeys.has(identity(item))).map((item) => ({ key: `removed:${identity(item)}`, kind: 'removed' as const, fileName: item.fileName, fieldKey: item.fieldKey })),
  ]
}

function Value({ value }: { value: unknown }) {
  if (value == null || value === '') return <span className="cwgsyw-type-label-xs">-</span>
  if (typeof value === 'object') return <pre className="cwgsyw-type-label-xs">{JSON.stringify(value, null, 2)}</pre>
  return <span className="cwgsyw-type-body-sm">{String(value)}</span>
}

function submissionStatusLabel(status: string) {
  return { current: '当前版本', pending_review: '审批中', approved: '已通过', changes_requested: '已退回', superseded: '已被替代', rejected: '已拒绝', terminated: '已终止' }[status] ?? status
}

function submissionStatusTone(status: string): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'approved' || status === 'current') return 'success'
  if (status === 'changes_requested' || status === 'rejected' || status === 'terminated') return 'danger'
  if (status === 'pending_review') return 'warning'
  return 'neutral'
}

function formatDate(value: string) { return new Date(value).toLocaleDateString('zh-CN') }
function formatDateTime(value: string) { return new Date(value).toLocaleString('zh-CN') }
function formatBytes(size: number) { return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB` }
