'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pause, Pencil, Play, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, StatusBadge } from '@/components/design-system'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'
import { listDirectoryUsers, listPublishedTemplates } from '@/lib/task-plan-api'
import {
  changeTaskAutomationStatus,
  createTaskAutomation,
  deleteTaskAutomation,
  listTaskAutomationExecutions,
  listTaskAutomations,
  previewTaskAutomation,
  retryTaskAutomationExecution,
  updateTaskAutomation,
  type TaskAutomationExecution,
  type TaskAutomationRule,
  type TaskAutomationRulePayload,
} from '@/lib/task-analytics-api'

export function TaskAutomationsManager() {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const [createDraft, setCreateDraft] = useState<AutomationDraft>(emptyDraft)
  const [editingDraft, setEditingDraft] = useState<AutomationDraft>()
  const [selectedId, setSelectedId] = useState<number>()
  const [sourceTaskId, setSourceTaskId] = useState('')
  const [metricValue, setMetricValue] = useState('')
  const rules = useQuery({ queryKey: ['task-automations'], queryFn: listTaskAutomations })
  const templates = useQuery({ queryKey: ['task-automation-templates'], queryFn: listPublishedTemplates })
  const users = useQuery({ queryKey: ['task-automation-users'], queryFn: listDirectoryUsers })
  const selected = useMemo(() => rules.data?.find((rule) => rule.id === selectedId), [rules.data, selectedId])
  const executions = useQuery({
    queryKey: ['task-automation-executions', selectedId],
    queryFn: () => listTaskAutomationExecutions(selectedId as number),
    enabled: Boolean(selectedId),
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['task-automations'] })
  const preview = useMutation({
    mutationFn: () => previewTaskAutomation(selectedId as number, {
      sourceTaskId: Number(sourceTaskId),
      attributes: previewAttributes(selected, metricValue),
    }),
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '自动化预演失败')),
  })
  const create = useMutation({
    mutationFn: () => createTaskAutomation(payloadFor(createDraft)),
    onSuccess: async (value) => {
      toast.success('自动化规则已创建')
      setSelectedId(value.id)
      setCreateDraft(emptyDraft)
      await invalidate()
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '规则创建失败')),
  })
  const update = useMutation({
    mutationFn: () => updateTaskAutomation(selectedId as number, payloadFor(editingDraft as AutomationDraft)),
    onSuccess: async () => {
      toast.success('自动化规则已更新')
      setEditingDraft(undefined)
      await invalidate()
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '规则更新失败')),
  })
  const lifecycle = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'activate' | 'pause' }) => changeTaskAutomationStatus(id, action),
    onSuccess: async (_, variables) => {
      toast.success(variables.action === 'activate' ? '规则已激活' : '规则已暂停')
      await invalidate()
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '规则状态更新失败')),
  })
  const remove = useMutation({
    mutationFn: deleteTaskAutomation,
    onSuccess: async () => {
      toast.success('规则已删除')
      setSelectedId(undefined)
      setEditingDraft(undefined)
      await invalidate()
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '规则删除失败')),
  })
  const retry = useMutation({
    mutationFn: retryTaskAutomationExecution,
    onSuccess: async () => {
      toast.success('已提交重试')
      await queryClient.invalidateQueries({ queryKey: ['task-automation-executions', selectedId] })
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '执行重试失败')),
  })
  const permissions = {
    create: hasPermission('task_analytics', 'create'),
    update: hasPermission('task_analytics', 'update'),
    delete: hasPermission('task_analytics', 'delete'),
  }

  if (rules.isLoading || templates.isLoading || users.isLoading) return <LoadingState label="正在加载自动化规则" minHeight={360} />
  if (rules.isError || templates.isError || users.isError) {
    return <ErrorState title="自动化配置加载失败" onRetry={() => { void rules.refetch(); void templates.refetch(); void users.refetch() }} />
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="统一任务平台 / 事件驱动" title="任务自动化" subtitle="以任务完成、审批通过或指标阈值为触发器，受控地创建后续任务或发送通知。" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <Card>
          <CardHeader><CardTitle>新建规则</CardTitle><CardDescription>触发器、条件和动作均为受控字段，不执行脚本、SQL 或任意 URL。</CardDescription></CardHeader>
          <CardContent>{permissions.create ? <AutomationForm value={createDraft} onChange={setCreateDraft} templates={templates.data ?? []} users={users.data ?? []} onSubmit={() => create.mutate()} busy={create.isPending} submitLabel="创建草稿规则" /> : <p className="text-sm text-v2-muted">你没有创建自动化规则的权限。</p>}</CardContent>
        </Card>
        <section className="space-y-6">
          <Card>
            <CardHeader><CardTitle>规则列表</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {rules.data?.map((rule) => <button key={rule.id} type="button" onClick={() => { setSelectedId(rule.id); setEditingDraft(undefined) }} className={`block w-full border p-3 text-left ${selectedId === rule.id ? 'border-v2-primary bg-v2-primary-soft' : 'border-v2-border hover:bg-v2-surface-hover'}`}><div className="flex items-center justify-between gap-2"><span className="font-medium">{rule.name}</span><StatusBadge status={rule.status === 'active' ? 'ok' : rule.status === 'paused' ? 'warn' : 'neutral'}>{rule.status}</StatusBadge></div><p className="mt-1 text-xs text-v2-muted">{triggerLabel(rule.triggerType)} → {actionLabel(rule.actionType)}</p></button>)}
              {rules.data?.length === 0 && <p className="text-sm text-v2-muted">暂无自动化规则。</p>}
            </CardContent>
          </Card>
          {selected && <RuleDetail rule={selected} editDraft={editingDraft} onEditDraft={setEditingDraft} templates={templates.data ?? []} users={users.data ?? []} canUpdate={permissions.update} canDelete={permissions.delete} sourceTaskId={sourceTaskId} onSourceTaskId={setSourceTaskId} metricValue={metricValue} onMetricValue={setMetricValue} onPreview={() => preview.mutate()} preview={preview.data} previewing={preview.isPending} executions={executions.data ?? []} onRetry={(id) => retry.mutate(id)} retrying={retry.isPending} onSave={() => update.mutate()} saving={update.isPending} onStartEdit={() => setEditingDraft(draftFrom(selected))} onCancelEdit={() => setEditingDraft(undefined)} onLifecycle={(action) => lifecycle.mutate({ id: selected.id, action })} changing={lifecycle.isPending} onDelete={() => remove.mutate(selected.id)} />}
        </section>
      </div>
    </div>
  )
}

function AutomationForm({ value, onChange, templates, users, onSubmit, busy, submitLabel }: {
  value: AutomationDraft
  onChange: (value: AutomationDraft) => void
  templates: Array<{ latestVersionId?: number; name: string }>
  users: Array<{ id: number; username: string; realName?: string }>
  onSubmit: () => void
  busy: boolean
  submitLabel: string
}) {
  const fields = conditionFields(value.triggerType)
  const valid = value.name.trim() && (value.actionType === 'create_task' ? value.templateVersionId && value.assigneeId : value.recipientId) && (value.triggerType !== 'metric_threshold' || value.metricId)
  return <div className="grid gap-3 md:grid-cols-2">
    <label className="text-sm md:col-span-2">规则名称<Input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} /></label>
    <label className="text-sm md:col-span-2">说明<Input value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} /></label>
    <label className="text-sm">触发器<Select value={value.triggerType} onChange={(triggerType) => onChange({ ...value, triggerType: triggerType as AutomationDraft['triggerType'], conditionField: '' })} options={[{ value: 'submission_approved', label: '审批通过' }, { value: 'task_completed', label: '任务完成' }, { value: 'metric_threshold', label: '指标阈值' }]} /></label>
    {value.triggerType === 'metric_threshold' && <label className="text-sm">指标 ID<Input inputMode="numeric" value={value.metricId} onChange={(event) => onChange({ ...value, metricId: event.target.value })} /></label>}
    <label className="text-sm">动作<Select value={value.actionType} onChange={(actionType) => onChange({ ...value, actionType: actionType as AutomationDraft['actionType'] })} options={[{ value: 'create_task', label: '创建任务' }, { value: 'notify', label: '发送通知' }]} /></label>
    {value.actionType === 'create_task' ? <>
      <label className="text-sm">已发布模板<select className={selectClass} value={value.templateVersionId} onChange={(event) => onChange({ ...value, templateVersionId: event.target.value })}><option value="">选择模板</option>{templates.map((template) => <option key={template.latestVersionId} value={template.latestVersionId}>{template.name}</option>)}</select></label>
      <label className="text-sm">执行人<select className={selectClass} value={value.assigneeId} onChange={(event) => onChange({ ...value, assigneeId: event.target.value })}><option value="">选择执行人</option>{users.map((user) => <option key={user.id} value={user.id}>{user.realName || user.username}</option>)}</select></label>
      <label className="text-sm">截止小时数<Input type="number" min="1" value={value.dueHours} onChange={(event) => onChange({ ...value, dueHours: event.target.value })} /></label>
    </> : <>
      <label className="text-sm">接收人<select className={selectClass} value={value.recipientId} onChange={(event) => onChange({ ...value, recipientId: event.target.value })}><option value="">选择接收人</option>{users.map((user) => <option key={user.id} value={user.id}>{user.realName || user.username}</option>)}</select></label>
      <label className="text-sm">通知标题<Input value={value.notificationTitle} onChange={(event) => onChange({ ...value, notificationTitle: event.target.value })} /></label>
    </>}
    <label className="text-sm">条件字段（可选）<select className={selectClass} value={value.conditionField} onChange={(event) => onChange({ ...value, conditionField: event.target.value })}><option value="">不设置条件</option>{fields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}</select></label>
    {value.conditionField && <><label className="text-sm">条件运算符<Select value={value.conditionOperator} onChange={(conditionOperator) => onChange({ ...value, conditionOperator })} options={[{ value: 'eq', label: '等于' }, { value: 'ne', label: '不等于' }, { value: 'gt', label: '大于' }, { value: 'gte', label: '大于等于' }, { value: 'lt', label: '小于' }, { value: 'lte', label: '小于等于' }]} /></label><label className="text-sm">条件值<Input value={value.conditionValue} onChange={(event) => onChange({ ...value, conditionValue: event.target.value })} /></label></>}
    <div className="md:col-span-2"><Button onClick={onSubmit} disabled={busy || !valid}><Plus className="h-4 w-4" />{submitLabel}</Button></div>
  </div>
}

function RuleDetail({ rule, editDraft, onEditDraft, templates, users, canUpdate, canDelete, sourceTaskId, onSourceTaskId, metricValue, onMetricValue, onPreview, preview, previewing, executions, onRetry, retrying, onSave, saving, onStartEdit, onCancelEdit, onLifecycle, changing, onDelete }: RuleDetailProps) {
  const editing = Boolean(editDraft)
  return <Card>
    <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{rule.name}</CardTitle><CardDescription>{rule.description || `${triggerLabel(rule.triggerType)} → ${actionLabel(rule.actionType)}`}</CardDescription></div><div className="flex gap-1">{canUpdate && !editing && ['draft', 'paused'].includes(rule.status) && <Button size="sm" variant="ghost" title="编辑规则" onClick={onStartEdit}><Pencil className="h-4 w-4" /></Button>}{canUpdate && rule.status === 'active' && <Button size="sm" title="暂停规则" onClick={() => onLifecycle('pause')} disabled={changing}><Pause className="h-4 w-4" /></Button>}{canUpdate && rule.status !== 'active' && rule.status !== 'archived' && <Button size="sm" title="激活规则" onClick={() => onLifecycle('activate')} disabled={changing}><Play className="h-4 w-4" /></Button>}{canDelete && <Button size="sm" variant="danger" title="删除规则" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>}</div></div></CardHeader>
    <CardContent className="space-y-5">
      {editDraft && <div className="space-y-2"><AutomationForm value={editDraft} onChange={(value) => onEditDraft(value)} templates={templates} users={users} onSubmit={onSave} busy={saving} submitLabel="保存规则" /><Button size="sm" variant="ghost" onClick={onCancelEdit}><X className="h-4 w-4" />取消编辑</Button></div>}
      <section className="grid gap-3 border border-v2-border bg-v2-surface-soft p-3 md:grid-cols-[1fr_1fr_auto] md:items-end"><label className="text-sm">来源任务 ID<Input inputMode="numeric" value={sourceTaskId} onChange={(event) => onSourceTaskId(event.target.value)} /></label>{rule.triggerType === 'metric_threshold' && <label className="text-sm">预演指标值<Input type="number" step="any" value={metricValue} onChange={(event) => onMetricValue(event.target.value)} /></label>}<Button size="sm" onClick={onPreview} disabled={previewing || !sourceTaskId}><Eye className="h-4 w-4" />预演</Button>{preview && <p className={`md:col-span-3 text-sm ${preview.matched ? 'text-v2-success' : 'text-v2-warning'}`}>{preview.reason} · 动作：{JSON.stringify(preview.resolvedAction)}</p>}</section>
      <section><h2 className="mb-2 text-sm font-semibold">执行记录</h2><div className="divide-y divide-v2-border border-y border-v2-border">{executions.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 py-3 text-sm"><StatusBadge status={executionTone(item.status)}>{item.status}</StatusBadge><span>尝试 {item.attemptCount ?? 0} 次</span><span className="flex-1 text-v2-muted">{item.resultTaskId ? `生成任务 #${item.resultTaskId}` : item.lastError || new Date(item.createdAt).toLocaleString('zh-CN')}</span>{canUpdate && ['failed', 'dead'].includes(item.status) && <Button size="sm" variant="ghost" title="重试执行" disabled={retrying} onClick={() => onRetry(item.id)}><RefreshCw className="h-4 w-4" /></Button>}</div>)}</div>{executions.length === 0 && <p className="mt-3 text-sm text-v2-muted">规则尚未产生执行记录。</p>}</section>
    </CardContent>
  </Card>
}

function previewAttributes(rule: TaskAutomationRule | undefined, metricValue: string) {
  if (!rule || rule.triggerType !== 'metric_threshold') return {}
  const metricId = rule.triggerConfig.metricId
  return { metricId, metricValue: numericOrText(metricValue || '0') }
}

function draftFrom(rule: TaskAutomationRule): AutomationDraft {
  const trigger = rule.triggerConfig ?? {}
  const condition = rule.conditionConfig ?? {}
  const action = rule.actionConfig ?? {}
  return {
    name: rule.name,
    description: rule.description ?? '',
    triggerType: rule.triggerType,
    metricId: textValue(trigger.metricId),
    actionType: rule.actionType,
    templateVersionId: textValue(action.templateVersionId),
    assigneeId: textValue(action.assigneeId),
    dueHours: textValue(action.dueHours || 24),
    recipientId: textValue(action.recipientId),
    notificationTitle: textValue(action.title || '任务自动化通知'),
    conditionField: textValue(condition.field),
    conditionOperator: textValue(condition.operator || 'gte'),
    conditionValue: textValue(condition.value),
  }
}

function payloadFor(value: AutomationDraft): TaskAutomationRulePayload {
  const triggerConfig = value.triggerType === 'metric_threshold' && value.metricId ? { metricId: Number(value.metricId) } : {}
  const conditionConfig = value.conditionField ? { field: value.conditionField, operator: value.conditionOperator, value: numericOrText(value.conditionValue) } : {}
  const actionConfig = value.actionType === 'create_task'
    ? { templateVersionId: Number(value.templateVersionId), assigneeId: Number(value.assigneeId), dueHours: Number(value.dueHours || 24), title: value.name.trim() }
    : { recipientId: Number(value.recipientId), title: value.notificationTitle || '任务自动化通知' }
  return { name: value.name.trim(), description: value.description || undefined, triggerType: value.triggerType, triggerConfig, conditionConfig, actionType: value.actionType, actionConfig }
}

function conditionFields(trigger: AutomationDraft['triggerType']) {
  const common = [{ value: 'taskId', label: '任务 ID' }, { value: 'submissionId', label: '提交 ID' }]
  if (trigger === 'metric_threshold') return [{ value: 'metricValue', label: '指标值' }, { value: 'metricId', label: '指标 ID' }, ...common, { value: 'ownerGroupId', label: '所属组 ID' }, { value: 'ownerUserId', label: '执行人 ID' }]
  return common
}

function numericOrText(value: string): string | number {
  const number = Number(value)
  return value !== '' && Number.isFinite(number) ? number : value
}

function textValue(value: unknown) { return value == null ? '' : String(value) }
function triggerLabel(value: string) { return value === 'submission_approved' ? '审批通过' : value === 'task_completed' ? '任务完成' : '指标阈值' }
function actionLabel(value: string) { return value === 'create_task' ? '创建任务' : '发送通知' }
function executionTone(status: string): 'ok' | 'warn' | 'danger' | 'neutral' { return status === 'succeeded' ? 'ok' : status === 'failed' || status === 'dead' ? 'danger' : status === 'pending' ? 'warn' : 'neutral' }

const selectClass = 'mt-1 h-9 w-full border border-v2-border bg-v2-surface px-2'
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> }

interface AutomationDraft { name: string; description: string; triggerType: 'submission_approved' | 'metric_threshold' | 'task_completed'; metricId: string; actionType: 'create_task' | 'notify'; templateVersionId: string; assigneeId: string; dueHours: string; recipientId: string; notificationTitle: string; conditionField: string; conditionOperator: string; conditionValue: string }
interface RuleDetailProps { rule: TaskAutomationRule; editDraft?: AutomationDraft; onEditDraft: (value?: AutomationDraft) => void; templates: Array<{ latestVersionId?: number; name: string }>; users: Array<{ id: number; username: string; realName?: string }>; canUpdate: boolean; canDelete: boolean; sourceTaskId: string; onSourceTaskId: (value: string) => void; metricValue: string; onMetricValue: (value: string) => void; onPreview: () => void; preview?: { matched: boolean; reason: string; resolvedAction: Record<string, unknown> }; previewing: boolean; executions: TaskAutomationExecution[]; onRetry: (id: number) => void; retrying: boolean; onSave: () => void; saving: boolean; onStartEdit: () => void; onCancelEdit: () => void; onLifecycle: (action: 'activate' | 'pause') => void; changing: boolean; onDelete: () => void }
const emptyDraft: AutomationDraft = { name: '', description: '', triggerType: 'submission_approved', metricId: '', actionType: 'create_task', templateVersionId: '', assigneeId: '', dueHours: '24', recipientId: '', notificationTitle: '任务自动化通知', conditionField: '', conditionOperator: 'gte', conditionValue: '' }
