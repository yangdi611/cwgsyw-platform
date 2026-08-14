'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
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
import '@/design-system/figma-neutral/index.css'
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  DataManagementPage,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

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

  if (rules.isLoading || templates.isLoading || users.isLoading) return <LoadingState label="正在加载自动化规则" />
  if (rules.isError || templates.isError || users.isError) {
    return (
      <ErrorState
        title="自动化配置加载失败"
        retry={<Button type="button" variant="secondary" onClick={() => { void rules.refetch(); void templates.refetch(); void users.refetch() }}>重试</Button>}
      />
    )
  }

  return (
    <DataManagementPage
      embedded
      header={
        <PageHeader
          eyebrow="统一任务平台"
          title="任务自动化"
          subtitle="以任务完成、审批通过或指标阈值为触发器，受控地创建后续任务或发送通知。"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/tasks', label: '我的任务' },
                { label: '任务自动化' },
              ]}
            />
          }
        />
      }
      filter={
        <Card title="新建规则" description="触发器、条件和动作均为受控字段，不执行脚本、SQL 或任意 URL。">
          {permissions.create ? (
            <AutomationForm value={createDraft} onChange={setCreateDraft} templates={templates.data ?? []} users={users.data ?? []} onSubmit={() => create.mutate()} busy={create.isPending} submitLabel="创建草稿规则" />
          ) : (
            <p className="cwgsyw-type-body-sm">你没有创建自动化规则的权限。</p>
          )}
        </Card>
      }
      content={
        <div className="cwgsyw-split">
          <Card title="规则列表">
            <div className="cwgsyw-form">
              {(rules.data ?? []).map((rule) => (
                <Button
                  key={rule.id}
                  type="button"
                  variant="outline"
                  onClick={() => { setSelectedId(rule.id); setEditingDraft(undefined) }}
                  className="cwgsyw-dashboard-tile"
                  data-selected={selectedId === rule.id}
                >
                  <span>
                    <strong>{rule.name}</strong>
                    <span className="cwgsyw-type-label-xs">{triggerLabel(rule.triggerType)} → {actionLabel(rule.actionType)}</span>
                  </span>
                  <StatusBadge label={ruleStatusLabel(rule.status)} status={ruleStatusTone(rule.status)} />
                </Button>
              ))}
              {(rules.data ?? []).length === 0 ? <EmptyState title="暂无自动化规则" description="创建一条草稿规则后即可预演和激活。" /> : null}
            </div>
          </Card>
          {selected ? (
            <RuleDetail
              rule={selected}
              editDraft={editingDraft}
              onEditDraft={setEditingDraft}
              templates={templates.data ?? []}
              users={users.data ?? []}
              canUpdate={permissions.update}
              canDelete={permissions.delete}
              sourceTaskId={sourceTaskId}
              onSourceTaskId={setSourceTaskId}
              metricValue={metricValue}
              onMetricValue={setMetricValue}
              onPreview={() => preview.mutate()}
              preview={preview.data}
              previewing={preview.isPending}
              executions={executions.data ?? []}
              onRetry={(id) => retry.mutate(id)}
              retrying={retry.isPending}
              onSave={() => update.mutate()}
              saving={update.isPending}
              onStartEdit={() => setEditingDraft(draftFrom(selected))}
              onCancelEdit={() => setEditingDraft(undefined)}
              onLifecycle={(action) => lifecycle.mutate({ id: selected.id, action })}
              changing={lifecycle.isPending}
              onDelete={() => remove.mutate(selected.id)}
            />
          ) : (
            <EmptyState title="选择一条规则" description="查看详情、预演或管理生命周期。" />
          )}
        </div>
      }
    />
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
  return (
    <div className="cwgsyw-filter-grid">
      <div className="cwgsyw-filter-grid--span-3">
        <Field label="规则名称">
          <Input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} />
        </Field>
      </div>
      <div className="cwgsyw-filter-grid--span-3">
        <Field label="说明">
          <Input value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} />
        </Field>
      </div>
      <Field label="触发器">
        <Select
          value={value.triggerType}
          onChange={(triggerType) => onChange({ ...value, triggerType: triggerType as AutomationDraft['triggerType'], conditionField: '' })}
          options={[{ value: 'submission_approved', label: '审批通过' }, { value: 'task_completed', label: '任务完成' }, { value: 'metric_threshold', label: '指标阈值' }]}
        />
      </Field>
      {value.triggerType === 'metric_threshold' ? (
        <Field label="指标 ID">
          <Input inputMode="numeric" value={value.metricId} onChange={(event) => onChange({ ...value, metricId: event.target.value })} />
        </Field>
      ) : null}
      <Field label="动作">
        <Select
          value={value.actionType}
          onChange={(actionType) => onChange({ ...value, actionType: actionType as AutomationDraft['actionType'] })}
          options={[{ value: 'create_task', label: '创建任务' }, { value: 'notify', label: '发送通知' }]}
        />
      </Field>
      {value.actionType === 'create_task' ? (
        <>
          <Field label="已发布模板">
            <Select
              value={value.templateVersionId}
              onChange={(templateVersionId) => onChange({ ...value, templateVersionId })}
              options={templates.filter((template) => template.latestVersionId != null).map((template) => ({ value: String(template.latestVersionId), label: template.name }))}
              placeholder="选择模板"
            />
          </Field>
          <Field label="执行人">
            <Select
              value={value.assigneeId}
              onChange={(assigneeId) => onChange({ ...value, assigneeId })}
              options={users.map((user) => ({ value: String(user.id), label: user.realName || user.username }))}
              placeholder="选择执行人"
            />
          </Field>
          <Field label="截止小时数">
            <Input type="number" min={1} value={value.dueHours} onChange={(event) => onChange({ ...value, dueHours: event.target.value })} />
          </Field>
        </>
      ) : (
        <>
          <Field label="接收人">
            <Select
              value={value.recipientId}
              onChange={(recipientId) => onChange({ ...value, recipientId })}
              options={users.map((user) => ({ value: String(user.id), label: user.realName || user.username }))}
              placeholder="选择接收人"
            />
          </Field>
          <Field label="通知标题">
            <Input value={value.notificationTitle} onChange={(event) => onChange({ ...value, notificationTitle: event.target.value })} />
          </Field>
        </>
      )}
      <Field label="条件字段（可选）">
        <Select
          value={value.conditionField}
          onChange={(conditionField) => onChange({ ...value, conditionField })}
          options={[{ value: '', label: '不设置条件' }, ...fields]}
        />
      </Field>
      {value.conditionField ? (
        <>
          <Field label="条件运算符">
            <Select
              value={value.conditionOperator}
              onChange={(conditionOperator) => onChange({ ...value, conditionOperator })}
              options={[{ value: 'eq', label: '等于' }, { value: 'ne', label: '不等于' }, { value: 'gt', label: '大于' }, { value: 'gte', label: '大于等于' }, { value: 'lt', label: '小于' }, { value: 'lte', label: '小于等于' }]}
            />
          </Field>
          <Field label="条件值">
            <Input value={value.conditionValue} onChange={(event) => onChange({ ...value, conditionValue: event.target.value })} />
          </Field>
        </>
      ) : null}
      <div>
        <Button type="button" onClick={onSubmit} disabled={busy || !valid}>{submitLabel}</Button>
      </div>
    </div>
  )
}

function RuleDetail({ rule, editDraft, onEditDraft, templates, users, canUpdate, canDelete, sourceTaskId, onSourceTaskId, metricValue, onMetricValue, onPreview, preview, previewing, executions, onRetry, retrying, onSave, saving, onStartEdit, onCancelEdit, onLifecycle, changing, onDelete }: RuleDetailProps) {
  const editing = Boolean(editDraft)
  return (
    <Card
      title={rule.name}
      description={rule.description || `${triggerLabel(rule.triggerType)} → ${actionLabel(rule.actionType)}`}
      headerAction={
        <div className="cwgsyw-designer__actions">
          {canUpdate && !editing && ['draft', 'paused'].includes(rule.status) ? <Button type="button" size="sm" variant="ghost" onClick={onStartEdit}>编辑</Button> : null}
          {canUpdate && rule.status === 'active' ? <Button type="button" size="sm" variant="secondary" onClick={() => onLifecycle('pause')} disabled={changing}>暂停</Button> : null}
          {canUpdate && rule.status !== 'active' && rule.status !== 'archived' ? <Button type="button" size="sm" variant="secondary" onClick={() => onLifecycle('activate')} disabled={changing}>激活</Button> : null}
          {canDelete ? <Button type="button" size="sm" variant="destructive" onClick={onDelete}>删除</Button> : null}
        </div>
      }
    >
      <div className="cwgsyw-form">
        {editDraft ? (
          <div className="cwgsyw-form">
            <AutomationForm value={editDraft} onChange={(value) => onEditDraft(value)} templates={templates} users={users} onSubmit={onSave} busy={saving} submitLabel="保存规则" />
            <Button type="button" size="sm" variant="ghost" onClick={onCancelEdit}>取消编辑</Button>
          </div>
        ) : null}
        <div className="cwgsyw-filter-grid">
          <Field label="来源任务 ID">
            <Input inputMode="numeric" value={sourceTaskId} onChange={(event) => onSourceTaskId(event.target.value)} />
          </Field>
          {rule.triggerType === 'metric_threshold' ? (
            <Field label="预演指标值">
              <Input type="number" step="any" value={metricValue} onChange={(event) => onMetricValue(event.target.value)} />
            </Field>
          ) : null}
          <div>
            <Button type="button" size="sm" onClick={onPreview} disabled={previewing || !sourceTaskId}>预演</Button>
          </div>
        </div>
        {preview ? (
          <Alert
            tone={preview.matched ? 'success' : 'warning'}
            title={preview.matched ? '预演命中' : '预演未命中'}
            description={`${preview.reason} · 动作：${JSON.stringify(preview.resolvedAction)}`}
            showDismiss={false}
          />
        ) : null}
        <section className="cwgsyw-form">
          <h2 className="cwgsyw-type-title-sm">执行记录</h2>
          {executions.map((item) => (
            <div key={item.id} className="cwgsyw-designer__inline">
              <StatusBadge label={item.status} status={executionTone(item.status)} />
              <span className="cwgsyw-type-body-sm">尝试 {item.attemptCount ?? 0} 次</span>
              <span className="cwgsyw-type-label-xs">{item.resultTaskId ? `生成任务 #${item.resultTaskId}` : item.lastError || new Date(item.createdAt).toLocaleString('zh-CN')}</span>
              {canUpdate && ['failed', 'dead'].includes(item.status) ? (
                <Button type="button" size="sm" variant="ghost" disabled={retrying} onClick={() => onRetry(item.id)}>重试</Button>
              ) : null}
            </div>
          ))}
          {executions.length === 0 ? <EmptyState title="规则尚未产生执行记录" description="激活后产生执行时会显示在这里。" /> : null}
        </section>
      </div>
    </Card>
  )
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
function ruleStatusLabel(status: string) { return status === 'active' ? '已激活' : status === 'paused' ? '已暂停' : status === 'archived' ? '已归档' : '草稿' }
function ruleStatusTone(status: string): 'success' | 'warning' | 'neutral' { return status === 'active' ? 'success' : status === 'paused' || status === 'draft' ? 'warning' : 'neutral' }
function executionTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' { return status === 'succeeded' ? 'success' : status === 'failed' || status === 'dead' ? 'danger' : status === 'pending' ? 'warning' : 'neutral' }

interface AutomationDraft { name: string; description: string; triggerType: 'submission_approved' | 'metric_threshold' | 'task_completed'; metricId: string; actionType: 'create_task' | 'notify'; templateVersionId: string; assigneeId: string; dueHours: string; recipientId: string; notificationTitle: string; conditionField: string; conditionOperator: string; conditionValue: string }
interface RuleDetailProps { rule: TaskAutomationRule; editDraft?: AutomationDraft; onEditDraft: (value?: AutomationDraft) => void; templates: Array<{ latestVersionId?: number; name: string }>; users: Array<{ id: number; username: string; realName?: string }>; canUpdate: boolean; canDelete: boolean; sourceTaskId: string; onSourceTaskId: (value: string) => void; metricValue: string; onMetricValue: (value: string) => void; onPreview: () => void; preview?: { matched: boolean; reason: string; resolvedAction: Record<string, unknown> }; previewing: boolean; executions: TaskAutomationExecution[]; onRetry: (id: number) => void; retrying: boolean; onSave: () => void; saving: boolean; onStartEdit: () => void; onCancelEdit: () => void; onLifecycle: (action: 'activate' | 'pause') => void; changing: boolean; onDelete: () => void }
const emptyDraft: AutomationDraft = { name: '', description: '', triggerType: 'submission_approved', metricId: '', actionType: 'create_task', templateVersionId: '', assigneeId: '', dueHours: '24', recipientId: '', notificationTitle: '任务自动化通知', conditionField: '', conditionOperator: 'gte', conditionValue: '' }
