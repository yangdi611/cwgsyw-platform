'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from '@/design-system/figma-neutral/toast'
import { createOneOffTask } from '@/lib/task-runtime-api'
import { listDirectoryUsers, listPublishedTemplates } from '@/lib/task-plan-api'
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import {
  Button,
  Field,
  Input,
  NeutralDialog,
  Select,
  Textarea,
} from '@/design-system/figma-neutral/components'

function localDateTime(hours: number, initialDate?: string) {
  const date = initialDate ? new Date(`${initialDate}T09:00:00`) : new Date()
  date.setHours(date.getHours() + hours)
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function OneOffTaskDialog({
  open,
  onOpenChange,
  initialDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: string
}) {
  const router = useRouter()
  const templates = useQuery({ queryKey: ['one-off-templates'], queryFn: listPublishedTemplates, enabled: open })
  const users = useQuery({ queryKey: ['one-off-users'], queryFn: listDirectoryUsers, enabled: open })
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [templateVersionId, setTemplateVersionId] = useState(0)
  const [assigneeId, setAssigneeId] = useState(0)
  const [plannedStartAt, setPlannedStartAt] = useState(() => localDateTime(0, initialDate))
  const [dueAt, setDueAt] = useState(() => localDateTime(24, initialDate))
  const create = useMutation({
    mutationFn: () =>
      createOneOffTask({
        templateVersionId,
        title,
        description,
        plannedStartAt,
        dueAt,
        priority: 'normal',
        assigneeId,
      }),
    onSuccess: (task) => {
      toast.success('一次性任务已创建')
      onOpenChange(false)
      router.push(`/tasks/${task.id}`)
    },
    onError: () => toast.error('任务创建失败，请检查必填项'),
  })
  const canSubmit = Boolean(title.trim() && templateVersionId > 0 && assigneeId > 0 && dueAt >= plannedStartAt)

  return (
    <NeutralDialog
      open={open}
      onOpenChange={onOpenChange}
      title="快速创建一次性任务"
      size="md"
      showClose={false}
      footer={
        <div className="cwgsyw-form__actions">
          <Button type="button" size="sm" variant="secondary" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" size="sm" variant="primary" disabled={!canSubmit} loading={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? '创建中' : '创建任务'}
          </Button>
        </div>
      }
    >
      <div className="cwgsyw-form">
        <Field htmlFor="one-off-title" label="任务标题" required>
          <Input id="one-off-title" size="sm" value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field htmlFor="one-off-template" label="任务模板" required>
          <Select
            id="one-off-template"
            size="sm"
            overlay
            value={templateVersionId ? String(templateVersionId) : ''}
            placeholder="选择已发布模板"
            options={(templates.data ?? [])
              .filter((item) => item.latestVersionId)
              .map((item) => ({ value: String(item.latestVersionId), label: item.name }))}
            onChange={(value) => setTemplateVersionId(Number(value))}
          />
        </Field>
        <Field htmlFor="one-off-assignee" label="执行人" required>
          <Select
            id="one-off-assignee"
            size="sm"
            overlay
            value={assigneeId ? String(assigneeId) : ''}
            placeholder="选择执行人"
            options={(users.data ?? []).map((user) => ({
              value: String(user.id),
              label: user.realName || user.username,
            }))}
            onChange={(value) => setAssigneeId(Number(value))}
          />
        </Field>
        <Field htmlFor="one-off-start" label="开始时间">
          <Input id="one-off-start" size="sm" type="datetime-local" value={plannedStartAt} onChange={(event) => setPlannedStartAt(event.target.value)} />
        </Field>
        <Field htmlFor="one-off-due" label="截止时间">
          <Input id="one-off-due" size="sm" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </Field>
        <Field htmlFor="one-off-description" label="任务说明">
          <Textarea id="one-off-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
      </div>
    </NeutralDialog>
  )
}
