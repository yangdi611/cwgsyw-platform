'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/components/design-system'
import { createOneOffTask } from '@/lib/task-runtime-api'
import { listDirectoryUsers, listPublishedTemplates } from '@/lib/task-plan-api'

function localDateTime(hours: number, initialDate?: string) {
  const date = initialDate ? new Date(`${initialDate}T09:00:00`) : new Date()
  date.setHours(date.getHours() + hours)
  const offset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function OneOffTaskDialog({ open, onOpenChange, initialDate }: { open: boolean; onOpenChange: (open: boolean) => void; initialDate?: string }) {
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
    mutationFn: () => createOneOffTask({ templateVersionId, title, description, plannedStartAt, dueAt, priority: 'normal', assigneeId }),
    onSuccess: (task) => {
      toast.success('一次性任务已创建')
      onOpenChange(false)
      router.push(`/tasks/${task.id}`)
    },
    onError: () => toast.error('任务创建失败，请检查必填项'),
  })
  const canSubmit = title.trim() && templateVersionId > 0 && assigneeId > 0 && dueAt >= plannedStartAt

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>快速创建一次性任务</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2"><Label>任务标题 *</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} /></div>
          <div className="space-y-2"><Label>任务模板 *</Label><Select value={templateVersionId ? String(templateVersionId) : ''} onValueChange={(value) => setTemplateVersionId(Number(value))}><SelectTrigger><SelectValue placeholder="选择已发布模板">{(value: string) => templates.data?.find((item) => String(item.latestVersionId) === value)?.name ?? '选择已发布模板'}</SelectValue></SelectTrigger><SelectContent>{templates.data?.filter((item) => item.latestVersionId).map((item) => <SelectItem key={item.id} value={String(item.latestVersionId)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>执行人 *</Label><Select value={assigneeId ? String(assigneeId) : ''} onValueChange={(value) => setAssigneeId(Number(value))}><SelectTrigger><SelectValue placeholder="选择执行人">{(value: string) => { const user = users.data?.find((item) => String(item.id) === value); return user ? user.realName || user.username : '选择执行人' }}</SelectValue></SelectTrigger><SelectContent>{users.data?.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.realName || user.username}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>开始时间</Label><Input type="datetime-local" value={plannedStartAt} onChange={(event) => setPlannedStartAt(event.target.value)} /></div>
          <div className="space-y-2"><Label>截止时间</Label><Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div>
          <div className="space-y-2 md:col-span-2"><Label>任务说明</Label><Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>取消</Button><Button variant="primary" disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>{create.isPending ? '创建中' : '创建任务'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
