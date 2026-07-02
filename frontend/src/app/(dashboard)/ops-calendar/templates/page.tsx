'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { PageHeader, DataTable, type ColumnDef } from '@/components/shared'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Textarea } from '@/components/v2/Textarea'
import { Switch } from '@/components/v2/Switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/v2/Dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { TASK_TYPE_META, errMsg } from '@/lib/opsCalendar'
import { Plus, ArrowLeft } from 'lucide-react'

interface TemplateVO {
  id: number
  name: string
  templateType: string
  taskType: string | null
  titleTemplate: string | null
  bodyTemplate: string | null
  checklistJson: string | null
  enabled: boolean
  isBuiltin: boolean
  createdAt: string | null
}

const TYPE_LABEL: Record<string, string> = { notification: '通知模板', checklist: 'SOP 检查项', mixed: '混合' }

export default function TemplatesPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const qc = useQueryClient()

  useEffect(() => {
    if (!hasPermission('ops_calendar', 'manage')) router.replace('/ops-calendar')
  }, [hasPermission, router])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TemplateVO | null>(null)
  const empty = { name: '', templateType: 'notification', taskType: '', titleTemplate: '', bodyTemplate: '', checklistJson: '', enabled: true }
  const [form, setForm] = useState({ ...empty })

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['ops-templates'],
    queryFn: () => api.get('/ops-calendar/templates').then((r) => r.data.data as TemplateVO[]),
  })

  function openCreate() {
    setEditing(null)
    setForm({ ...empty })
    setOpen(true)
  }
  function openEdit(t: TemplateVO) {
    setEditing(t)
    setForm({
      name: t.name, templateType: t.templateType, taskType: t.taskType ?? '',
      titleTemplate: t.titleTemplate ?? '', bodyTemplate: t.bodyTemplate ?? '',
      checklistJson: t.checklistJson ?? '', enabled: t.enabled,
    })
    setOpen(true)
  }

  function body() {
    return {
      name: form.name,
      templateType: form.templateType,
      taskType: form.taskType || null,
      titleTemplate: form.titleTemplate || null,
      bodyTemplate: form.bodyTemplate || null,
      checklistJson: form.checklistJson || null,
      enabled: form.enabled,
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => editing
      ? api.put(`/ops-calendar/templates/${editing.id}`, body())
      : api.post('/ops-calendar/templates', body()),
    onSuccess: () => {
      toast.success(editing ? '模板已更新' : '模板已创建')
      qc.invalidateQueries({ queryKey: ['ops-templates'] })
      setOpen(false)
    },
    onError: (e) => toast.error(errMsg(e, '保存失败')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/ops-calendar/templates/${id}`),
    onSuccess: () => {
      toast.success('模板已删除')
      qc.invalidateQueries({ queryKey: ['ops-templates'] })
    },
    onError: (e) => toast.error(errMsg(e, '删除失败')),
  })

  const columns: ColumnDef<TemplateVO>[] = [
    { key: 'name', title: '名称', render: (t) => <span className="font-semibold text-v2-fg">{t.name}</span> },
    { key: 'templateType', title: '类型', render: (t) => TYPE_LABEL[t.templateType] ?? t.templateType },
    { key: 'taskType', title: '适用任务', render: (t) => t.taskType ? (TASK_TYPE_META[t.taskType]?.label ?? t.taskType) : '-' },
    { key: 'enabled', title: '状态', render: (t) => t.enabled ? '启用' : '停用' },
    { key: 'builtin', title: '来源', render: (t) => t.isBuiltin ? '内置' : '自定义' },
    {
      key: 'ops', title: '操作', align: 'right' as const, render: (t) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(t) }}>编辑</Button>
          {!t.isBuiltin && (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); if (confirm(`删除模板「${t.name}」？`)) deleteMutation.mutate(t.id) }}>删除</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="运维日历"
        title="模板管理"
        subtitle="维护通知模板与 SOP 检查项模板，供周期规则在生成任务时引用。"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.push('/ops-calendar')}><ArrowLeft className="h-4 w-4" />返回</Button>
            <Button variant="primary" onClick={openCreate}><Plus className="h-4 w-4" />新建模板</Button>
          </div>
        }
      />

      <DataTable
        columns={columns} data={templates} rowKey={(t) => t.id} loading={isLoading}
        empty={{ title: '暂无模板', description: '点击右上角新建模板。' }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? '编辑模板' : '新建模板'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>模板名称</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>模板类型</Label>
                <Select value={form.templateType} onValueChange={(v) => setForm({ ...form, templateType: v ?? 'notification' })}>
                  <SelectTrigger><SelectValue>{(v: string) => TYPE_LABEL[v] ?? v}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notification">通知模板</SelectItem>
                    <SelectItem value="checklist">SOP 检查项</SelectItem>
                    <SelectItem value="mixed">混合</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>适用任务类型</Label>
                <Select value={form.taskType || 'any'} onValueChange={(v) => setForm({ ...form, taskType: v === 'any' ? '' : (v ?? '') })}>
                  <SelectTrigger>
                    <SelectValue>
                      {(v: string) => (v === 'any' || !v ? '不限' : TASK_TYPE_META[v]?.label ?? v)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">不限</SelectItem>
                    {Object.entries(TASK_TYPE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(form.templateType === 'notification' || form.templateType === 'mixed') && (
              <>
                <div><Label>通知标题模板</Label><Input value={form.titleTemplate} onChange={(e) => setForm({ ...form, titleTemplate: e.target.value })} placeholder="如：【运维日历】{taskTitle}" /></div>
                <div><Label>通知正文模板</Label><Textarea rows={3} value={form.bodyTemplate} onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })} placeholder="支持 {taskTitle} {assigneeName} {dueTime} 等变量" /></div>
              </>
            )}
            {(form.templateType === 'checklist' || form.templateType === 'mixed') && (
              <div>
                <Label>检查项 JSON</Label>
                <Textarea rows={5} value={form.checklistJson} onChange={(e) => setForm({ ...form, checklistJson: e.target.value })}
                  className="font-v2-mono text-xs"
                  placeholder='[{"title":"检查数据库连接","required":true,"inputType":"checkbox"}]' />
                <p className="text-xs text-v2-muted mt-1">JSON 数组；字段：title、required、inputType(checkbox/text/number/select/attachment)、options。</p>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />启用</label>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>取消</Button>
            <Button variant="primary" onClick={() => { if (!form.name.trim()) { toast.error('请填写名称'); return } saveMutation.mutate() }} disabled={saveMutation.isPending}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
