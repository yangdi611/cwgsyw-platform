'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/v2/Dialog'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Textarea } from '@/components/v2/Textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { TASK_TYPE_META, errMsg } from '@/lib/opsCalendar'

interface UserOpt { id: number; realName: string | null; username: string }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EMPTY = {
  title: '', taskType: 'inspection', plannedStartAt: '', dueAt: '',
  assigneeId: '', priority: 'normal', content: '', visibility: 'private',
}

export function TaskFormDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ ...EMPTY })

  const { data: users = [] } = useQuery({
    queryKey: ['users-for-ops-task'],
    queryFn: () => api.get('/users', { params: { page: 1, size: 200 } })
      .then((r) => (r.data.data.records ?? r.data.data) as UserOpt[])
      .catch(() => [] as UserOpt[]),
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        title: form.title,
        taskType: form.taskType,
        priority: form.priority,
        content: form.content || undefined,
        visibility: form.visibility,
        plannedStartAt: form.plannedStartAt ? form.plannedStartAt + ':00' : undefined,
        dueAt: form.dueAt ? form.dueAt + ':00' : undefined,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : undefined,
      }
      return api.post('/ops-calendar/tasks', body).then((r) => r.data)
    },
    onSuccess: () => {
      toast.success('任务已创建')
      queryClient.invalidateQueries({ queryKey: ['ops-calendar-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['ops-calendar-dashboard'] })
      setForm({ ...EMPTY })
      onOpenChange(false)
    },
    onError: (e: unknown) => toast.error(errMsg(e, '创建失败')),
  })

  function submit() {
    if (!form.title.trim()) { toast.error('请填写标题'); return }
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>新建临时任务</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>标题 *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="如：节前数据库巡检" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Select value={form.taskType} onValueChange={(v) => setForm({ ...form, taskType: v ?? 'inspection' })}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => TASK_TYPE_META[v]?.label ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_TYPE_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>优先级</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v ?? 'normal' })}>
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) => ({ low: '低', normal: '普通', high: '高', critical: '紧急' } as Record<string, string>)[v] ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="normal">普通</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="critical">紧急</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>计划开始</Label>
              <Input type="datetime-local" value={form.plannedStartAt}
                onChange={(e) => setForm({ ...form, plannedStartAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>截止时间</Label>
              <Input type="datetime-local" value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>负责人</Label>
              <Select value={form.assigneeId || 'none'} onValueChange={(v) => setForm({ ...form, assigneeId: !v || v === 'none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="选择负责人">
                    {(v: string) => {
                      if (v === 'none' || !v) return '未指定'
                      const u = users.find((uu) => String(uu.id) === v)
                      return u ? (u.realName || u.username) : '选择负责人'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未指定</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.realName || u.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>可见性</Label>
              <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v ?? 'private' })}>
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) => ({ private: '私有', group: '本组', public: '公共' } as Record<string, string>)[v] ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">私有</SelectItem>
                  <SelectItem value="group">本组</SelectItem>
                  <SelectItem value="public">公共</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>内容说明</Label>
            <Textarea rows={3} value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="任务说明、SOP 要点等" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="primary" onClick={submit} disabled={createMutation.isPending}>
            {createMutation.isPending ? '创建中…' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
