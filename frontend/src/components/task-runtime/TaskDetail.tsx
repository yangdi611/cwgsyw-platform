'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import { DynamicTaskForm } from '@/components/task-runtime/DynamicTaskForm'
import { SubmissionHistoryCard } from '@/components/task-runtime/SubmissionHistoryCard'
import { TaskPanel } from '@/components/task-runtime/TaskEmpty'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
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
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import {
  Alert,
  Button,
  DetailDrawerPage,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

export function TaskDetail({ taskId }: { taskId: number }) {
  const task = useQuery({ queryKey: ['task', taskId], queryFn: () => getTask(taskId) })
  const aggregateReferences = useQuery({
    queryKey: ['task', taskId, 'aggregate-references'],
    queryFn: () => previewAggregateReferences(taskId),
    enabled: Boolean(task.data),
  })
  useBreadcrumbLabel(task.data?.task.title)

  if (task.isLoading) return <LoadingState label="正在加载任务…" />
  if (task.isError || !task.data) {
    return (
      <ErrorState
        title="任务加载失败"
        description="无法读取任务详情，请重试。"
        retry={<Button type="button" size="sm" variant="secondary" onClick={() => void task.refetch()}>重试</Button>}
      />
    )
  }
  if (aggregateReferences.isLoading) return <LoadingState label="正在加载汇总引用…" />
  if (aggregateReferences.isError) {
    return (
      <ErrorState
        title="汇总引用加载失败"
        description="无法读取任务汇总引用，请重试。"
        retry={<Button type="button" size="sm" variant="secondary" onClick={() => void aggregateReferences.refetch()}>重试</Button>}
      />
    )
  }
  return (
    <TaskDetailForm
      key={`${taskId}:${task.data.draft.revision}:${task.data.task.executionStatus}`}
      data={task.data}
      aggregateReferences={aggregateReferences.data ?? []}
    />
  )
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
    mutationFn: (action: 'start' | 'remind') => (action === 'start' ? startTask(taskId) : remindTask(taskId)),
    onSuccess: async (_, action) => {
      toast.success(action === 'start' ? '任务已开始' : '提醒已发送')
      await queryClient.invalidateQueries({ queryKey: ['task', taskId] })
    },
  })
  const submit = useMutation({
    mutationFn: async () => {
      let currentRevision = revision
      if (dirty) {
        const draft = await saveTaskDraft(taskId, currentRevision, values)
        currentRevision = draft.revision
        setRevision(draft.revision)
        setAttachments(draft.attachments)
        setDirty(false)
      }
      const validation = await validateTask(taskId)
      if (!validation.valid) {
        setIssues(validation.issues)
        throw new Error('validation')
      }
      setIssues([])
      return submitTask(taskId, currentRevision, submissionIdempotencyKey())
    },
    onSuccess: async () => {
      toast.success(data.task.approvalStatus && data.task.approvalStatus !== 'not_required' ? '已提交审批' : '任务已完成')
      await queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      await queryClient.invalidateQueries({ queryKey: ['work-items'] })
    },
    onError: (error) => {
      if (error.message !== 'validation') toast.error('提交失败')
      else toast.error('请修正表单校验问题')
    },
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

  const removeAttachment = async (attachmentId: number) => {
    await deleteTaskAttachment(taskId, revision, attachmentId)
    setAttachments((current) => current.filter((item) => item.id !== attachmentId))
    toast.success('附件已删除')
  }

  return (
    <DetailDrawerPage
      embedded
      className="cwgsyw-tasks-page"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title={data.task.title}
          subtitle={data.task.description || data.template.instructions || '按模板要求填写并提交任务。'}
          status={
            <div className="cwgsyw-inline-controls">
              <StatusBadge label={executionLabel(data.task.executionStatus)} status={executionTone(data.task.executionStatus, data.task.overdue)} />
              {data.task.approvalStatus && data.task.approvalStatus !== 'not_required' ? (
                <StatusBadge label={approvalLabel(data.task.approvalStatus)} status={approvalTone(data.task.approvalStatus)} />
              ) : null}
            </div>
          }
          actions={
            <div className="cwgsyw-inline-controls">
              {data.actions.canRemind ? (
                <Button type="button" variant="secondary" size="sm" disabled={command.isPending} onClick={() => command.mutate('remind')}>
                  提醒
                </Button>
              ) : null}
              {data.actions.canStart ? (
                <Button type="button" variant="primary" size="sm" disabled={command.isPending} onClick={() => command.mutate('start')}>
                  开始任务
                </Button>
              ) : null}
              {data.actions.canEditDraft ? (
                <Button type="button" variant="secondary" size="sm" disabled={saving || !dirty} onClick={() => void manualSave()}>
                  {saving ? '保存中' : dirty ? '保存草稿' : '已保存'}
                </Button>
              ) : null}
              {data.actions.canSubmit ? (
                <Button type="button" variant="primary" size="sm" disabled={submit.isPending || saving} onClick={() => submit.mutate()}>
                  {submit.isPending ? '提交中' : data.task.executionStatus === 'changes_requested' ? '重新提交' : '提交任务'}
                </Button>
              ) : null}
            </div>
          }
        />
      }
      content={
        <div className="cwgsyw-form">
          {approvalFeedback.returnReason ? (
            <Alert
              tone="danger"
              title="审批已退回，请修改后重新提交"
              description={approvalFeedback.returnReason}
              showDismiss={false}
            />
          ) : null}
          {issues.length > 0 ? (
            <Alert
              tone="danger"
              title="请修正以下问题"
              description={issues.map((issue) => `${issue.path}：${issue.message}`).join('\n')}
              showDismiss={false}
            />
          ) : null}
          <TaskPanel title={data.template.name} description={data.template.description || undefined}>
            <DynamicTaskForm
              taskId={taskId}
              fields={data.template.fields}
              values={values}
              aggregateReferences={aggregateReferences}
              attachments={attachments}
              fieldFeedback={approvalFeedback.fields}
              attachmentFeedback={approvalFeedback.attachments}
              readOnly={readOnly}
              onChange={updateValue}
              onUpload={upload}
              onDeleteAttachment={removeAttachment}
            />
          </TaskPanel>
          <SubmissionHistoryCard
            taskId={taskId}
            currentSubmissionId={data.currentSubmission?.id}
            attachmentFeedback={approvalFeedback.submissionAttachments}
            fields={data.template.fields}
          />
          <ApprovalHistory rounds={rounds.data ?? []} loading={rounds.isLoading} />
        </div>
      }
      drawer={
        <div className="cwgsyw-form">
          <TaskPanel title="任务信息" description="计划、截止和草稿版本。">
            <dl className="cwgsyw-tasks-dl">
              <Info label="计划开始" value={data.task.plannedStartAt ? new Date(data.task.plannedStartAt).toLocaleString('zh-CN') : '-'} />
              <Info label="截止时间" value={data.task.dueAt ? new Date(data.task.dueAt).toLocaleString('zh-CN') : '-'} />
              <Info label="草稿版本" value={`第 ${revision} 版${dirty ? ' · 未保存' : ''}`} />
            </dl>
          </TaskPanel>
          <TaskPanel title="时间线" description="任务执行事件。">
            {data.timeline.length === 0 ? (
              <p className="cwgsyw-tasks-cell-meta">暂无事件</p>
            ) : (
              <div>
                {data.timeline.map((event) => (
                  <div key={event.id} className="cwgsyw-tasks-event">
                    <p className="cwgsyw-tasks-event__title">{timelineLabel(event.eventType)}</p>
                    <p className="cwgsyw-tasks-cell-meta">{new Date(event.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                ))}
              </div>
            )}
          </TaskPanel>
        </div>
      }
    />
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="cwgsyw-type-label-xs">{label}</dt>
      <dd className="cwgsyw-type-body-sm">{value}</dd>
    </div>
  )
}

function ApprovalHistory({ rounds, loading }: { rounds: ApprovalRound[]; loading: boolean }) {
  if (loading || rounds.length === 0) return null
  return (
    <TaskPanel title="审批历史" description="每次提交形成独立审批轮次，退回理由和字段/附件意见永久保留。">
      <div>
        {rounds.map((round) => (
          <div key={round.id} className="cwgsyw-tasks-event">
            <div className="cwgsyw-inline-controls">
              <p className="cwgsyw-tasks-event__title">第 {round.roundNumber} 轮</p>
              <StatusBadge label={approvalLabel(round.status)} status={approvalTone(round.status)} />
            </div>
            <p className="cwgsyw-tasks-cell-meta">
              {new Date(round.startedAt).toLocaleString('zh-CN')}
              {round.endedAt ? ` 至 ${new Date(round.endedAt).toLocaleString('zh-CN')}` : ''}
            </p>
            {round.actions.map((action) => (
              <ApprovalActionItem key={action.id} action={action} />
            ))}
          </div>
        ))}
      </div>
    </TaskPanel>
  )
}

function ApprovalActionItem({ action }: { action: ApprovalAction }) {
  return (
    <div>
      <div className="cwgsyw-inline-controls">
        <span className="cwgsyw-type-label-md">{action.nodeName}</span>
        <StatusBadge label={approvalActionLabel(action.action)} status={action.action === 'approve' ? 'success' : action.action === 'terminate' ? 'danger' : 'warning'} />
        <span className="cwgsyw-type-label-xs">{new Date(action.createdAt).toLocaleString('zh-CN')}</span>
      </div>
      {action.comment ? <p className="cwgsyw-type-body-sm">{action.comment}</p> : null}
      {action.fieldComments.map((item, index) => (
        <p key={`${item.fieldKey}:${index}`} className="cwgsyw-type-label-xs">
          字段 {item.fieldKey}：{item.comment}
        </p>
      ))}
      {action.attachmentComments.map((item, index) => (
        <p key={`${item.attachmentId}:${index}`} className="cwgsyw-type-label-xs">
          附件 #{item.attachmentId}：{item.comment}
        </p>
      ))}
    </div>
  )
}

function feedbackFromRounds(rounds: ApprovalRound[], data: TaskDetailData) {
  const fields: Record<string, Array<{ severity: string; comment: string }>> = {}
  const submissionAttachments: Record<number, string[]> = {}
  let returnReason: string | undefined
  for (const round of rounds) {
    for (const action of round.actions) {
      if (action.action === 'return_for_changes' && action.comment && !returnReason) returnReason = action.comment
      for (const item of action.fieldComments) (fields[item.fieldKey] ??= []).push({ severity: item.severity, comment: item.comment })
      for (const item of action.attachmentComments) (submissionAttachments[item.attachmentId] ??= []).push(item.comment)
    }
  }
  const attachments: Record<number, string[]> = {}
  for (const draft of data.draft.attachments) {
    const source = data.currentSubmission?.attachments.find((item) => item.fieldKey === draft.fieldKey && item.fileName === draft.fileName && item.checksum === draft.checksum)
    if (source && submissionAttachments[source.id]) attachments[draft.id] = submissionAttachments[source.id]
  }
  return { fields, attachments, submissionAttachments, returnReason: data.task.approvalStatus === 'changes_requested' ? returnReason : undefined }
}

function timelineLabel(eventType: string) {
  return {
    created: '已创建',
    started: '已开始',
    cancelled: '已取消',
    exception_closed: '异常关闭',
    reassigned: '已改派',
    reminded: '已提醒',
    draft_saved: '草稿已保存',
    draft_attachment_uploaded: '已上传附件',
    draft_attachment_deleted: '已删除附件',
    submitted: '已提交',
  }[eventType] ?? eventType
}

function executionLabel(status: string) {
  return {
    not_started: '未开始',
    in_progress: '进行中',
    submitted: '已提交',
    changes_requested: '待修改',
    completed: '已完成',
    cancelled: '已取消',
    exception_closed: '异常关闭',
  }[status] ?? status
}

function approvalLabel(status: string) {
  return {
    not_started: '未发起',
    pending: '待启动',
    in_review: '审批中',
    approved: '已通过',
    changes_requested: '已退回',
    terminated: '已终止',
    failed: '失败',
  }[status] ?? status
}

function executionTone(status: string, overdue: boolean): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success'
  if (overdue) return 'danger'
  if (status === 'changes_requested') return 'warning'
  return 'neutral'
}

function approvalTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'approved') return 'success'
  if (status === 'changes_requested' || status === 'terminated' || status === 'failed') return 'danger'
  if (status === 'in_review' || status === 'pending') return 'warning'
  return 'neutral'
}

function submissionIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `submission-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
