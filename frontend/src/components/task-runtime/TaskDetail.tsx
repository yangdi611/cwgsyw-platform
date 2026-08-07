'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock3, History, Play, Save, Send, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { DynamicTaskForm } from '@/components/task-runtime/DynamicTaskForm'
import { SubmissionHistoryCard } from '@/components/task-runtime/SubmissionHistoryCard'
import { DetailHeader, ErrorState, FormShell, LoadingState } from '@/components/shared'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, StatusBadge } from '@/components/design-system'
import { approvalActionLabel, listTaskApprovalRounds, type ApprovalAction, type ApprovalRound } from '@/lib/approval-api'
import {
  deleteTaskAttachment,
  getTask,
  previewAggregateReferences,
  remindTask,
  saveTaskDraft,
  startTask,
  submitTask,
  uploadTaskAttachment,
  validateTask,
  type TaskDetail as TaskDetailData,
  type AggregateReferencePreview,
} from '@/lib/task-runtime-api'

export function TaskDetail({ taskId }: { taskId: number }) {
  const task = useQuery({ queryKey: ['task', taskId], queryFn: () => getTask(taskId) })
  const aggregateReferences = useQuery({
    queryKey: ['task', taskId, 'aggregate-references'],
    queryFn: () => previewAggregateReferences(taskId),
    enabled: Boolean(task.data),
  })
  if (task.isLoading) return <LoadingState />
  if (task.isError || !task.data) return <ErrorState title="任务加载失败" onRetry={() => task.refetch()} />
  if (aggregateReferences.isLoading) return <LoadingState />
  if (aggregateReferences.isError) return <ErrorState title="汇总引用加载失败" onRetry={() => aggregateReferences.refetch()} />
  return <TaskDetailForm key={`${taskId}:${task.data.draft.revision}:${task.data.task.executionStatus}`} data={task.data} aggregateReferences={aggregateReferences.data ?? []} />
}

function TaskDetailForm({ data, aggregateReferences }: { data: TaskDetailData; aggregateReferences: AggregateReferencePreview[] }) {
  const queryClient = useQueryClient()
  const taskId = data.task.id
  const readOnly = !data.actions.canEditDraft
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...(readOnly ? data.currentSubmission?.formData ?? data.draft.formData : data.draft.formData),
    ...Object.fromEntries(aggregateReferences.map((item) => [item.fieldKey, item.selectedValue ?? null])),
  }))
  const [revision, setRevision] = useState(data.draft.revision)
  const [attachments, setAttachments] = useState(readOnly ? data.currentSubmission?.attachments ?? data.draft.attachments : data.draft.attachments)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editVersion, setEditVersion] = useState(0)
  const [issues, setIssues] = useState<Array<{ path: string; message: string }>>([])
  const editVersionRef = useRef(0)
  const rounds = useQuery({ queryKey: ['task-approval-rounds', taskId], queryFn: () => listTaskApprovalRounds(taskId) })
  const approvalFeedback = feedbackFromRounds(rounds.data ?? [], data)
  const command = useMutation({
    mutationFn: (action: 'start' | 'remind') => action === 'start' ? startTask(taskId) : remindTask(taskId),
    onSuccess: async (_, action) => { toast.success(action === 'start' ? '任务已开始' : '提醒已发送'); await queryClient.invalidateQueries({ queryKey: ['task', taskId] }) },
  })
  const submit = useMutation({
    mutationFn: async () => {
      let currentRevision = revision
      if (dirty) {
        const draft = await saveTaskDraft(taskId, currentRevision, values)
        currentRevision = draft.revision; setRevision(draft.revision); setAttachments(draft.attachments); setDirty(false)
      }
      const validation = await validateTask(taskId)
      if (!validation.valid) { setIssues(validation.issues); throw new Error('validation') }
      setIssues([])
      return submitTask(taskId, currentRevision, submissionIdempotencyKey())
    },
    onSuccess: async () => { toast.success(data.task.approvalStatus && data.task.approvalStatus !== 'not_required' ? '已提交审批' : '任务已完成'); await queryClient.invalidateQueries({ queryKey: ['task', taskId] }); await queryClient.invalidateQueries({ queryKey: ['tasks'] }); await queryClient.invalidateQueries({ queryKey: ['work-items'] }) },
    onError: (error) => { if (error.message !== 'validation') toast.error('提交失败'); else toast.error('请修正表单校验问题') },
  })

  useEffect(() => {
    if (!dirty || saving || !data.actions.canEditDraft) return
    const snapshot = values
    const baseRevision = revision
    const snapshotVersion = editVersion
    const timer = window.setTimeout(async () => {
      setSaving(true)
      try {
        const draft = await saveTaskDraft(taskId, baseRevision, snapshot)
        setRevision(draft.revision)
        setAttachments(draft.attachments)
        if (editVersionRef.current === snapshotVersion) setDirty(false)
      } catch {
        toast.error('自动保存失败，可能已被其他页面更新')
      } finally {
        setSaving(false)
      }
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [dirty, saving, values, revision, editVersion, taskId, data.actions.canEditDraft])

  const updateValue = (key: string, value: unknown) => {
    editVersionRef.current += 1
    setEditVersion(editVersionRef.current)
    setValues((current) => ({ ...current, [key]: value }))
    setDirty(true)
  }
  const manualSave = async () => {
    if (!dirty || saving) return
    const snapshotVersion = editVersionRef.current
    setSaving(true)
    try {
      const draft = await saveTaskDraft(taskId, revision, values)
      setRevision(draft.revision)
      setAttachments(draft.attachments)
      if (editVersionRef.current === snapshotVersion) setDirty(false)
      toast.success('草稿已保存')
    } catch {
      toast.error('草稿保存失败，可能已被其他页面更新')
    } finally {
      setSaving(false)
    }
  }
  const upload = async (fieldKey: string, file: File) => {
    let currentRevision = revision
    if (dirty) {
      const draft = await saveTaskDraft(taskId, revision, values)
      currentRevision = draft.revision
      setRevision(draft.revision)
      setAttachments(draft.attachments)
      setDirty(false)
    }
    const attachment = await uploadTaskAttachment(taskId, currentRevision, fieldKey, file)
    setAttachments((current) => [...current, attachment])
    toast.success('附件已上传')
  }
  const removeAttachment = async (attachmentId: number) => { await deleteTaskAttachment(taskId, revision, attachmentId); setAttachments((current) => current.filter((item) => item.id !== attachmentId)); toast.success('附件已删除') }

  return <FormShell width="wide"><DetailHeader backHref="/tasks" eyebrow="统一任务平台" title={data.task.title} subtitle={data.task.description || data.template.instructions || '按模板要求填写并提交任务。'} actions={<div className="flex flex-wrap gap-2">{data.actions.canRemind && <Button onClick={() => command.mutate('remind')}><UploadCloud className="h-4 w-4" />提醒</Button>}{data.actions.canStart && <Button variant="primary" onClick={() => command.mutate('start')}><Play className="h-4 w-4" />开始任务</Button>}{data.actions.canEditDraft && <Button onClick={() => void manualSave()} disabled={saving || !dirty}><Save className="h-4 w-4" />{saving ? '保存中' : dirty ? '保存草稿' : '已保存'}</Button>}{data.actions.canSubmit && <Button variant="primary" onClick={() => submit.mutate()} disabled={submit.isPending || saving}><Send className="h-4 w-4" />{submit.isPending ? '提交中' : data.task.executionStatus === 'changes_requested' ? '重新提交' : '提交任务'}</Button>}</div>} />
    {approvalFeedback.returnReason && <div className="flex gap-3 rounded-v2-md border border-v2-danger-border bg-v2-danger-soft p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-v2-danger" /><div><p className="font-semibold text-v2-danger">审批已退回，请修改后重新提交</p><p className="mt-1 whitespace-pre-wrap text-sm text-v2-danger">{approvalFeedback.returnReason}</p></div></div>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4"><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{data.template.name}</CardTitle><CardDescription>{data.template.description}</CardDescription></div><div className="flex gap-2"><StatusBadge status={data.task.executionStatus === 'completed' ? 'ok' : data.task.overdue ? 'danger' : data.task.executionStatus === 'changes_requested' ? 'warn' : 'neutral'}>{executionLabel(data.task.executionStatus)}</StatusBadge>{data.task.approvalStatus && data.task.approvalStatus !== 'not_required' && <StatusBadge status={data.task.approvalStatus === 'approved' ? 'ok' : data.task.approvalStatus === 'changes_requested' ? 'danger' : 'warn'}>{approvalLabel(data.task.approvalStatus)}</StatusBadge>}</div></div></CardHeader><CardContent><DynamicTaskForm taskId={taskId} fields={data.template.fields} values={values} aggregateReferences={aggregateReferences} attachments={attachments} fieldFeedback={approvalFeedback.fields} attachmentFeedback={approvalFeedback.attachments} readOnly={readOnly} onChange={updateValue} onUpload={upload} onDeleteAttachment={removeAttachment} />{issues.length > 0 && <div className="mt-4 rounded-v2-md border border-v2-danger bg-v2-danger-soft p-3"><p className="font-semibold text-v2-danger">请修正以下问题</p>{issues.map((issue) => <p key={`${issue.path}:${issue.message}`} className="mt-1 text-xs text-v2-danger">{issue.path}：{issue.message}</p>)}</div>}</CardContent></Card>
        <SubmissionHistoryCard taskId={taskId} currentSubmissionId={data.currentSubmission?.id} attachmentFeedback={approvalFeedback.submissionAttachments} fields={data.template.fields} />
        <ApprovalHistory rounds={rounds.data ?? []} loading={rounds.isLoading} />
      </div>
      <div className="space-y-4"><Card><CardHeader><CardTitle>任务信息</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Info icon={<Clock3 className="h-4 w-4" />} label="计划开始" value={data.task.plannedStartAt ? new Date(data.task.plannedStartAt).toLocaleString('zh-CN') : '-'} /><Info icon={<CheckCircle2 className="h-4 w-4" />} label="截止时间" value={data.task.dueAt ? new Date(data.task.dueAt).toLocaleString('zh-CN') : '-'} /><Info icon={<Save className="h-4 w-4" />} label="草稿版本" value={`revision ${revision}${dirty ? ' · 未保存' : ''}`} /></CardContent></Card><Card><CardHeader><CardTitle>时间线</CardTitle></CardHeader><CardContent className="space-y-3">{data.timeline.length === 0 ? <p className="text-sm text-v2-muted">暂无事件</p> : data.timeline.map((event) => <div key={event.id} className="flex gap-3"><History className="mt-0.5 h-4 w-4 text-v2-muted" /><div><p className="text-sm font-medium text-v2-fg">{event.eventType}</p><p className="text-xs text-v2-muted">{new Date(event.createdAt).toLocaleString('zh-CN')}</p></div></div>)}</CardContent></Card></div>
    </div></FormShell>
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-start gap-2 text-v2-muted">{icon}<div><p className="text-xs">{label}</p><p className="text-v2-fg">{value}</p></div></div> }

function ApprovalHistory({ rounds, loading }: { rounds: ApprovalRound[]; loading: boolean }) {
  if (loading || rounds.length === 0) return null
  return <Card><CardHeader><CardTitle>审批历史</CardTitle><CardDescription>每次提交形成独立审批轮次，退回理由和字段/附件意见永久保留。</CardDescription></CardHeader><CardContent className="space-y-4">{rounds.map((round) => <div key={round.id} className="rounded-v2-md border border-v2-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-v2-fg">第 {round.roundNumber} 轮</p><StatusBadge status={round.status === 'approved' ? 'ok' : round.status === 'changes_requested' || round.status === 'terminated' || round.status === 'failed' ? 'danger' : 'warn'}>{approvalLabel(round.status)}</StatusBadge></div><p className="mt-1 text-xs text-v2-muted">{new Date(round.startedAt).toLocaleString('zh-CN')}{round.endedAt ? ` 至 ${new Date(round.endedAt).toLocaleString('zh-CN')}` : ''}</p><div className="mt-3 space-y-3">{round.actions.map((action) => <ApprovalActionItem key={action.id} action={action} />)}</div></div>)}</CardContent></Card>
}

function ApprovalActionItem({ action }: { action: ApprovalAction }) {
  return <div className="border-l-2 border-v2-border pl-3"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-v2-fg">{action.nodeName}</span><StatusBadge status={action.action === 'approve' ? 'ok' : action.action === 'terminate' ? 'danger' : 'warn'}>{approvalActionLabel(action.action)}</StatusBadge><span className="text-xs text-v2-muted">{new Date(action.createdAt).toLocaleString('zh-CN')}</span></div>{action.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-v2-fg">{action.comment}</p>}{action.fieldComments.map((item, index) => <p key={`${item.fieldKey}:${index}`} className="mt-1 text-xs text-v2-warning">字段 {item.fieldKey}：{item.comment}</p>)}{action.attachmentComments.map((item, index) => <p key={`${item.attachmentId}:${index}`} className="mt-1 text-xs text-v2-warning">附件 #{item.attachmentId}：{item.comment}</p>)}</div>
}

function feedbackFromRounds(rounds: ApprovalRound[], data: TaskDetailData) {
  const fields: Record<string, Array<{ severity: string; comment: string }>> = {}
  const submissionAttachments: Record<number, string[]> = {}
  let returnReason: string | undefined
  for (const round of rounds) for (const action of round.actions) {
    if (action.action === 'return_for_changes' && action.comment && !returnReason) returnReason = action.comment
    for (const item of action.fieldComments) (fields[item.fieldKey] ??= []).push({ severity: item.severity, comment: item.comment })
    for (const item of action.attachmentComments) (submissionAttachments[item.attachmentId] ??= []).push(item.comment)
  }
  const attachments: Record<number, string[]> = {}
  for (const draft of data.draft.attachments) {
    const source = data.currentSubmission?.attachments.find((item) => item.fieldKey === draft.fieldKey && item.fileName === draft.fileName && item.checksum === draft.checksum)
    if (source && submissionAttachments[source.id]) attachments[draft.id] = submissionAttachments[source.id]
  }
  return { fields, attachments, submissionAttachments, returnReason: data.task.approvalStatus === 'changes_requested' ? returnReason : undefined }
}

function executionLabel(status: string) { return { not_started: '未开始', in_progress: '进行中', submitted: '已提交', changes_requested: '待修改', completed: '已完成', cancelled: '已取消', exception_closed: '异常关闭' }[status] ?? status }
function approvalLabel(status: string) { return { not_started: '未发起', pending: '待启动', in_review: '审批中', approved: '已通过', changes_requested: '已退回', terminated: '已终止', failed: '失败' }[status] ?? status }

function submissionIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `submission-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
