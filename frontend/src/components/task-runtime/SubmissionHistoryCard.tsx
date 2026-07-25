'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileDiff, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/v2/Button'
import { DynamicTaskForm } from '@/components/task-runtime/DynamicTaskForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/v2/Card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  downloadTaskSubmissionAttachment,
  getTaskSubmissionDiff,
  listTaskSubmissions,
  type TaskSubmission,
  type TaskSubmissionFieldChange,
} from '@/lib/task-runtime-api'
import type { TaskFieldDefinition } from '@/lib/task-template-api'

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
    return <Card><CardHeader><CardTitle>历史提交与差异</CardTitle></CardHeader><CardContent><p className="text-sm text-v2-muted">正在加载提交历史...</p></CardContent></Card>
  }
  if (submissions.isError) {
    return <Card><CardHeader><CardTitle>历史提交与差异</CardTitle></CardHeader><CardContent><div className="flex items-center justify-between gap-3"><p className="text-sm text-v2-danger">提交历史加载失败</p><Button size="sm" onClick={() => submissions.refetch()}>重试</Button></div></CardContent></Card>
  }
  if (!selected || !submissions.data?.length) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>历史提交与差异</CardTitle>
            <CardDescription>正式提交不可修改，每次重提都会保留上一版本。</CardDescription>
          </div>
          <Select value={String(selected.id)} onValueChange={(value) => setSelectedId(Number(value))}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue>{(value: string) => { const submission = submissions.data?.find((item) => String(item.id) === value); return submission ? `V${submission.version} · ${submissionStatusLabel(submission.status)} · ${formatDate(submission.submittedAt)}` : '选择提交版本' }}</SelectValue></SelectTrigger>
            <SelectContent>
              {submissions.data.map((submission) => (
                <SelectItem key={submission.id} value={String(submission.id)}>
                  V{submission.version} · {submissionStatusLabel(submission.status)} · {formatDate(submission.submittedAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-v2-fg">提交 V{selected.version}</span>
          <StatusBadge status={submissionStatusTone(selected.status)}>{submissionStatusLabel(selected.status)}</StatusBadge>
          {selected.effective && <StatusBadge status="ok">统计生效</StatusBadge>}
          <span className="text-xs text-v2-muted">{formatDateTime(selected.submittedAt)}</span>
        </div>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-v2-fg">提交内容</h4>
          <DynamicTaskForm taskId={taskId} fields={fields} values={selected.formData} attachments={selected.attachments} readOnly onChange={() => undefined} onUpload={async () => undefined} onDeleteAttachment={async () => undefined} attachmentFeedback={attachmentFeedback} />
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-v2-fg">附件</h4>
          {selected.attachments.length === 0 ? <p className="text-sm text-v2-muted">无附件</p> : selected.attachments.map((attachment) => (
            <div key={attachment.id} className="rounded-v2-md border border-v2-border bg-v2-surface-soft p-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 shrink-0 text-v2-muted" />
                <span className="min-w-0 flex-1 truncate text-sm text-v2-fg">{attachment.fileName}</span>
                <span className="text-xs text-v2-muted">{formatBytes(attachment.sizeBytes)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  title="下载附件"
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
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              {attachmentFeedback[attachment.id]?.map((comment, index) => (
                <p key={`${attachment.id}:${index}`} className="mt-2 rounded-v2-sm border border-v2-warning-border bg-v2-warning-soft px-2 py-1.5 text-xs text-v2-warning">附件意见：{comment}</p>
              ))}
            </div>
          ))}
        </section>

        {selected.supersedesSubmissionId && (
          <section className="space-y-3 border-t border-v2-border pt-4">
            <div className="flex items-center gap-2">
              <FileDiff className="h-4 w-4 text-v2-muted" />
              <h4 className="text-sm font-semibold text-v2-fg">相对 V{previous?.version ?? '?'} 的变化</h4>
            </div>
            {diff.isLoading && <p className="text-sm text-v2-muted">正在计算字段差异...</p>}
            {diff.isError && <div className="flex items-center justify-between gap-3"><p className="text-sm text-v2-danger">字段差异加载失败</p><Button size="sm" onClick={() => diff.refetch()}>重试</Button></div>}
            {diff.data && <FieldDiff changes={diff.data.changes} />}
            <AttachmentDiff changes={attachmentChanges} />
          </section>
        )}
      </CardContent>
    </Card>
  )
}

function FieldDiff({ changes }: { changes: Record<string, TaskSubmissionFieldChange> }) {
  const entries = Object.entries(changes)
  if (entries.length === 0) return <p className="text-sm text-v2-muted">表单字段无变化</p>
  return <div className="overflow-hidden rounded-v2-md border border-v2-border"><div className="grid grid-cols-[minmax(100px,160px)_minmax(0,1fr)_minmax(0,1fr)] gap-px bg-v2-border text-xs font-medium text-v2-muted"><div className="bg-v2-surface-soft px-3 py-2">字段</div><div className="bg-v2-surface-soft px-3 py-2">变更前</div><div className="bg-v2-surface-soft px-3 py-2">变更后</div>{entries.map(([key, change]) => <div key={key} className="contents"><div className="bg-v2-surface px-3 py-2 font-v2-mono text-v2-fg">{key}</div><div className="min-w-0 bg-v2-danger-soft px-3 py-2 text-v2-danger"><Value value={change.before} /></div><div className="min-w-0 bg-v2-success-soft px-3 py-2 text-v2-success"><Value value={change.after} /></div></div>)}</div></div>
}

interface AttachmentChange {
  key: string
  kind: 'added' | 'removed'
  fileName: string
  fieldKey: string
}

function AttachmentDiff({ changes }: { changes: AttachmentChange[] }) {
  if (changes.length === 0) return <p className="text-sm text-v2-muted">附件无变化</p>
  return <div className="space-y-2">{changes.map((change) => <div key={change.key} className={`flex items-center gap-2 rounded-v2-md border px-3 py-2 text-sm ${change.kind === 'added' ? 'border-v2-success-border bg-v2-success-soft text-v2-success' : 'border-v2-danger-border bg-v2-danger-soft text-v2-danger'}`}><Paperclip className="h-4 w-4 shrink-0" /><span className="font-medium">{change.kind === 'added' ? '新增' : '移除'}</span><span className="min-w-0 flex-1 truncate">{change.fileName}</span><span className="font-v2-mono text-xs">{change.fieldKey}</span></div>)}</div>
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
  if (value == null || value === '') return <span className="text-sm text-v2-muted">-</span>
  if (typeof value === 'object') return <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-v2-mono text-xs">{JSON.stringify(value, null, 2)}</pre>
  return <span className="break-words text-sm">{String(value)}</span>
}

function submissionStatusLabel(status: string) {
  return { current: '当前版本', pending_review: '审批中', approved: '已通过', changes_requested: '已退回', superseded: '已被替代', rejected: '已拒绝', terminated: '已终止' }[status] ?? status
}

function submissionStatusTone(status: string): 'ok' | 'danger' | 'warn' | 'neutral' {
  if (status === 'approved' || status === 'current') return 'ok'
  if (status === 'changes_requested' || status === 'rejected' || status === 'terminated') return 'danger'
  if (status === 'pending_review') return 'warn'
  return 'neutral'
}

function formatDate(value: string) { return new Date(value).toLocaleDateString('zh-CN') }
function formatDateTime(value: string) { return new Date(value).toLocaleString('zh-CN') }
function formatBytes(size: number) { return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB` }
