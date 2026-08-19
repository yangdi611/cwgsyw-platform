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
import '@/components/task-runtime/tasks.css'
import { TaskEmpty, TaskPanel, TASK_ZAP_ICON, TASK_ZAP_NODE } from '@/components/task-runtime/TaskEmpty'
import {
  Button,
  ErrorState,
  Field,
  IconButton,
  Input,
  LoadingState,
  NeutralTooltip,
  PageHeader,
  Select,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

const AUTOMATION_STEPS = ['规则定义', '预演验证', '执行记录']

export function TaskAutomationsManager() {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const [createDraft, setCreateDraft] = useState<AutomationDraft>(emptyDraft)
  const [editingDraft, setEditingDraft] = useState<AutomationDraft>()
  const [selectedId, setSelectedId] = useState<number>()
  const [sourceTaskId, setSourceTaskId] = useState('')
  const [metricValue, setMetricValue] = useState('')
  const [step, setStep] = useState(0)
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
      setStep(1)
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
      setStep(0)
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

  const detail = selected ? {
    rule: selected,
    editDraft: editingDraft,
    onEditDraft: setEditingDraft,
    templates: templates.data ?? [],
    users: users.data ?? [],
    canUpdate: permissions.update,
    canDelete: permissions.delete,
    sourceTaskId,
    onSourceTaskId: setSourceTaskId,
    metricValue,
    onMetricValue: setMetricValue,
    onPreview: () => preview.mutate(),
    preview: preview.data,
    previewing: preview.isPending,
    executions: executions.data ?? [],
    onRetry: (id: number) => retry.mutate(id),
    retrying: retry.isPending,
    onSave: () => update.mutate(),
    saving: update.isPending,
    onStartEdit: () => setEditingDraft(draftFrom(selected)),
    onCancelEdit: () => setEditingDraft(undefined),
    onLifecycle: (action: 'activate' | 'pause') => lifecycle.mutate({ id: selected.id, action }),
    changing: lifecycle.isPending,
    onDelete: () => remove.mutate(selected.id),
  } : null

  return (
    <div className="cwgsyw-tasks-page">
      <PageHeader showEyebrow={false} showBreadcrumb={false} showSubtitle={false} title="任务自动化" />
      <div className="cwgsyw-tasks-wizard" data-steps="3">
        <ol className="cwgsyw-cmdb-wizard-steps" aria-label="自动化配置步骤">
          {AUTOMATION_STEPS.map((label, index) => (
            <li key={label} data-state={index < step ? 'complete' : index === step ? 'current' : 'upcoming'} aria-current={step === index ? 'step' : undefined}>
              <button type="button" className="cwgsyw-tasks-wizard-step" onClick={() => setStep(index)}>
                <span className="cwgsyw-cmdb-wizard-steps__index" aria-hidden="true">{index + 1}</span>
                <span className="cwgsyw-cmdb-wizard-steps__label">{label}</span>
              </button>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <TaskPanel title="规则定义" description="触发器、条件和动作均为受控字段，不执行脚本、SQL 或任意地址。">
            {permissions.create ? (
              <div className="cwgsyw-tasks-section">
                <h3 className="cwgsyw-tasks-section__title">新建规则</h3>
                <AutomationForm value={createDraft} onChange={setCreateDraft} templates={templates.data ?? []} users={users.data ?? []} onSubmit={() => create.mutate()} busy={create.isPending} submitLabel="创建草稿规则" />
              </div>
            ) : (
              <p className="cwgsyw-tasks-cell-meta">你没有创建自动化规则的权限。</p>
            )}
            <div className="cwgsyw-tasks-section">
              <h3 className="cwgsyw-tasks-section__title">已有规则</h3>
              <div className="cwgsyw-tasks-pick-list">
                {(rules.data ?? []).map((rule) => (
                  <button
                    key={rule.id}
                    type="button"
                    className="cwgsyw-tasks-pick"
                    data-selected={selectedId === rule.id}
                    onClick={() => { setSelectedId(rule.id); setEditingDraft(undefined) }}
                  >
                    <span className="cwgsyw-tasks-cell-title">{rule.name}</span>
                    <span className="cwgsyw-tasks-cell-meta">{triggerLabel(rule.triggerType)} → {actionLabel(rule.actionType)}</span>
                    <StatusBadge label={ruleStatusLabel(rule.status)} status={ruleStatusTone(rule.status)} />
                  </button>
                ))}
              </div>
              {(rules.data ?? []).length === 0 ? <TaskEmpty iconSrc={TASK_ZAP_ICON} figmaNode={TASK_ZAP_NODE} title="暂无自动化规则" description="创建一条草稿规则后即可预演和激活。" /> : null}
            </div>
          </TaskPanel>
        ) : null}

        {step === 1 ? (
          detail ? <RuleDetail {...detail} section="preview" /> : (
            <TaskPanel title="预演验证">
              <TaskEmpty iconSrc={TASK_ZAP_ICON} figmaNode={TASK_ZAP_NODE} title="先选择规则" description="回到上一步选择或新建规则后，再预演和编辑。" />
            </TaskPanel>
          )
        ) : null}

        {step === 2 ? (
          detail ? <RuleDetail {...detail} section="executions" /> : (
            <TaskPanel title="执行记录">
              <TaskEmpty iconSrc={TASK_ZAP_ICON} figmaNode={TASK_ZAP_NODE} title="先选择规则" description="回到第一步选择规则后，再查看执行记录。" />
            </TaskPanel>
          )
        ) : null}

        <div className="cwgsyw-form__actions cwgsyw-tasks-create-actions">
          <Button type="button" size="sm" variant="secondary" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>上一步</Button>
          {step < AUTOMATION_STEPS.length - 1 ? (
            <Button type="button" size="sm" variant="primary" disabled={!selectedId} onClick={() => setStep((value) => value + 1)}>下一步</Button>
          ) : null}
        </div>
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
  return (
    <div className="cwgsyw-tasks-form-grid cwgsyw-tasks-form-grid--wide">
      <div className="cwgsyw-tasks-form-grid__full">
        <Field label="规则名称" required>
          <Input size="sm" value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} />
        </Field>
      </div>
      <div className="cwgsyw-tasks-form-grid__full">
        <Field label="说明">
          <Input size="sm" value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} />
        </Field>
      </div>
      <Field label="触发器">
        <Select size="sm" overlay value={value.triggerType} onChange={(triggerType) => onChange({ ...value, triggerType: triggerType as AutomationDraft['triggerType'], conditionField: '' })} options={[{ value: 'submission_approved', label: '审批通过' }, { value: 'task_completed', label: '任务完成' }, { value: 'metric_threshold', label: '指标阈值' }]} />
      </Field>
      {value.triggerType === 'metric_threshold' ? (
        <Field label="指标编号">
          <Input size="sm" inputMode="numeric" value={value.metricId} onChange={(event) => onChange({ ...value, metricId: event.target.value })} />
        </Field>
      ) : null}
      <Field label="动作">
        <Select size="sm" overlay value={value.actionType} onChange={(actionType) => onChange({ ...value, actionType: actionType as AutomationDraft['actionType'] })} options={[{ value: 'create_task', label: '创建任务' }, { value: 'notify', label: '发送通知' }]} />
      </Field>
      {value.actionType === 'create_task' ? (
        <>
          <Field label="已发布模板">
            <Select size="sm" overlay value={value.templateVersionId} onChange={(templateVersionId) => onChange({ ...value, templateVersionId })} options={templates.filter((template) => template.latestVersionId != null).map((template) => ({ value: String(template.latestVersionId), label: template.name }))} placeholder="选择模板" />
          </Field>
          <Field label="执行人">
            <Select size="sm" overlay value={value.assigneeId} onChange={(assigneeId) => onChange({ ...value, assigneeId })} options={users.map((user) => ({ value: String(user.id), label: user.realName || user.username }))} placeholder="选择执行人" />
          </Field>
          <Field label="截止小时数">
            <Input size="sm" type="number" min={1} value={value.dueHours} onChange={(event) => onChange({ ...value, dueHours: event.target.value })} />
          </Field>
        </>
      ) : (
        <>
          <Field label="接收人">
            <Select size="sm" overlay value={value.recipientId} onChange={(recipientId) => onChange({ ...value, recipientId })} options={users.map((user) => ({ value: String(user.id), label: user.realName || user.username }))} placeholder="选择接收人" />
          </Field>
          <Field label="通知标题">
            <Input size="sm" value={value.notificationTitle} onChange={(event) => onChange({ ...value, notificationTitle: event.target.value })} />
          </Field>
        </>
      )}
      <Field label="条件字段（可选）">
        <Select size="sm" overlay value={value.conditionField} onChange={(conditionField) => onChange({ ...value, conditionField })} options={[{ value: '', label: '不设置条件' }, ...fields]} />
      </Field>
      {value.conditionField ? (
        <>
          <Field label="条件运算符">
            <Select size="sm" overlay value={value.conditionOperator} onChange={(conditionOperator) => onChange({ ...value, conditionOperator })} options={[{ value: 'eq', label: '等于' }, { value: 'ne', label: '不等于' }, { value: 'gt', label: '大于' }, { value: 'gte', label: '大于等于' }, { value: 'lt', label: '小于' }, { value: 'lte', label: '小于等于' }]} />
          </Field>
          <Field label="条件值">
            <Input size="sm" value={value.conditionValue} onChange={(event) => onChange({ ...value, conditionValue: event.target.value })} />
          </Field>
        </>
      ) : null}
      <div className="cwgsyw-tasks-form-grid__full">
        <Button type="button" size="sm" onClick={onSubmit} disabled={busy || !valid}>{submitLabel}</Button>
      </div>
    </div>
  )
}

function RuleDetail({ rule, editDraft, onEditDraft, templates, users, canUpdate, canDelete, sourceTaskId, onSourceTaskId, metricValue, onMetricValue, onPreview, preview, previewing, executions, onRetry, retrying, onSave, saving, onStartEdit, onCancelEdit, onLifecycle, changing, onDelete, section = 'all' }: RuleDetailProps) {
  const editing = Boolean(editDraft)
  const showPreview = section === 'all' || section === 'preview'
  const showExecutions = section === 'all' || section === 'executions'
  return (
    <TaskPanel
      title={rule.name}
      description={rule.description || `${triggerLabel(rule.triggerType)} → ${actionLabel(rule.actionType)}`}
      action={(
        <span className="cwgsyw-inline-controls">
          {canUpdate && !editing && ['draft', 'paused'].includes(rule.status) ? <TaskIconAction label="编辑规则" icon="edit" onClick={onStartEdit} /> : null}
          {canUpdate && rule.status === 'active' ? <TaskIconAction label="暂停" icon="pause" onClick={() => onLifecycle('pause')} /> : null}
          {canUpdate && rule.status !== 'active' && rule.status !== 'archived' ? <TaskIconAction label="激活" icon="play" onClick={() => onLifecycle('activate')} /> : null}
          {canDelete ? <TaskIconAction label="删除规则" icon="trash" danger onClick={onDelete} /> : null}
        </span>
      )}
    >
      {showPreview ? (
        <>
          {editDraft ? (
            <div className="cwgsyw-tasks-form-stack">
              <AutomationForm value={editDraft} onChange={(value) => onEditDraft(value)} templates={templates} users={users} onSubmit={onSave} busy={saving} submitLabel="保存规则" />
              <Button type="button" size="sm" variant="secondary" onClick={onCancelEdit}>取消编辑</Button>
            </div>
          ) : null}
          <div className="cwgsyw-tasks-preview-controls">
            <Field label="来源任务编号">
              <Input size="sm" inputMode="numeric" value={sourceTaskId} onChange={(event) => onSourceTaskId(event.target.value)} />
            </Field>
            {rule.triggerType === 'metric_threshold' ? (
              <Field label="预演指标值">
                <Input size="sm" type="number" step="any" value={metricValue} onChange={(event) => onMetricValue(event.target.value)} />
              </Field>
            ) : null}
            <Button type="button" size="sm" onClick={onPreview} disabled={previewing || !sourceTaskId}>{previewing ? '预演中' : '预演'}</Button>
          </div>
          {preview ? (
            <p className="cwgsyw-tasks-cell-meta">
              {preview.matched ? '预演命中' : '预演未命中'} · {preview.reason} · {describeResolvedAction(preview.resolvedAction)}
            </p>
          ) : (
            <p className="cwgsyw-tasks-cell-meta">填写来源任务编号后预演，确认规则是否命中。</p>
          )}
        </>
      ) : null}
      {showExecutions ? (
        <div className="cwgsyw-tasks-row-list">
          {executions.map((item) => (
            <div key={item.id} className="cwgsyw-tasks-row">
              <StatusBadge label={executionStatusLabel(item.status)} status={executionTone(item.status)} />
              <span className="cwgsyw-tasks-cell-meta">尝试 {item.attemptCount ?? 0} 次</span>
              <span className="cwgsyw-tasks-cell-meta">{item.resultTaskId ? `生成任务 ${item.resultTaskId}` : item.lastError || new Date(item.createdAt).toLocaleString('zh-CN')}</span>
              {canUpdate && ['failed', 'dead'].includes(item.status) ? (
                <Button type="button" size="sm" variant="secondary" disabled={retrying} onClick={() => onRetry(item.id)}>重试</Button>
              ) : null}
            </div>
          ))}
          {executions.length === 0 ? <TaskEmpty iconSrc={TASK_ZAP_ICON} figmaNode={TASK_ZAP_NODE} title="规则尚未产生执行记录" description="激活后产生执行时会显示在这里。" /> : null}
        </div>
      ) : null}
    </TaskPanel>
  )
}

function TaskIconAction({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string
  icon: 'edit' | 'trash' | 'play' | 'pause'
  onClick: () => void
  danger?: boolean
}) {
  return (
    <NeutralTooltip content={label} className="cwgsyw-tooltip--pill" followCursor>
      <IconButton
        type="button"
        size="sm"
        variant="ghost"
        aria-label={label}
        className={['cwgsyw-tasks-icon-action', danger ? 'cwgsyw-tasks-icon-action--danger' : ''].filter(Boolean).join(' ')}
        icon={<span aria-hidden="true" className={['cwgsyw-tasks-figma-icon', `cwgsyw-tasks-figma-icon--${icon}`].join(' ')} />}
        onClick={onClick}
      />
    </NeutralTooltip>
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
function executionStatusLabel(status: string) { return status === 'succeeded' ? '成功' : status === 'failed' ? '失败' : status === 'dead' ? '已终止' : status === 'pending' ? '等待中' : status }
function describeResolvedAction(action: Record<string, unknown>) {
  if (action.templateVersionId != null) return `将创建任务，模板版本 ${action.templateVersionId}`
  if (action.recipientId != null) return `将通知用户 ${action.recipientId}`
  if (action.title) return `将执行「${action.title}」`
  return '将执行已配置动作'
}

interface AutomationDraft { name: string; description: string; triggerType: 'submission_approved' | 'metric_threshold' | 'task_completed'; metricId: string; actionType: 'create_task' | 'notify'; templateVersionId: string; assigneeId: string; dueHours: string; recipientId: string; notificationTitle: string; conditionField: string; conditionOperator: string; conditionValue: string }
interface RuleDetailProps { rule: TaskAutomationRule; editDraft?: AutomationDraft; onEditDraft: (value?: AutomationDraft) => void; templates: Array<{ latestVersionId?: number; name: string }>; users: Array<{ id: number; username: string; realName?: string }>; canUpdate: boolean; canDelete: boolean; sourceTaskId: string; onSourceTaskId: (value: string) => void; metricValue: string; onMetricValue: (value: string) => void; onPreview: () => void; preview?: { matched: boolean; reason: string; resolvedAction: Record<string, unknown> }; previewing: boolean; executions: TaskAutomationExecution[]; onRetry: (id: number) => void; retrying: boolean; onSave: () => void; saving: boolean; onStartEdit: () => void; onCancelEdit: () => void; onLifecycle: (action: 'activate' | 'pause') => void; changing: boolean; onDelete: () => void; section?: 'all' | 'preview' | 'executions' }
const emptyDraft: AutomationDraft = { name: '', description: '', triggerType: 'submission_approved', metricId: '', actionType: 'create_task', templateVersionId: '', assigneeId: '', dueHours: '24', recipientId: '', notificationTitle: '任务自动化通知', conditionField: '', conditionOperator: 'gte', conditionValue: '' }
