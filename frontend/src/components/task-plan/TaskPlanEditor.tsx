'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from '@/design-system/figma-neutral/toast'
import { CiScopeSelector, localizeScopeWarning } from '@/components/task-plan/CiScopeSelector'
import { listPublishedApprovalSchemes, type PublishedApprovalScheme } from '@/lib/approval-api'
import {
  createTaskPlan,
  getTaskPlan,
  listDirectoryGroups,
  listDirectoryUsers,
  listPublishedTemplates,
  previewTaskPlan,
  updateTaskPlan,
  type CiScopeSelection,
  type GenerationMode,
  type ScheduleType,
  type TaskPlanDetail,
  type TaskPlanPayload,
  type TaskPlanPreview,
} from '@/lib/task-plan-api'
import type { TaskTemplateSummary } from '@/lib/task-template-api'
import { TaskPanel } from '@/components/task-runtime/TaskEmpty'
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import {
  Button,
  Checkbox,
  Chip,
  ErrorState,
  Field,
  FormSettingsPage,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
  Switch,
  Textarea,
} from '@/design-system/figma-neutral/components'

interface TaskPlanEditorProps { planId?: number }

const STEPS = ['基础信息', '周期与截止', '执行对象与 CI', '提醒与预览']
const SCHEDULE_OPTIONS: Array<{ value: ScheduleType; label: string }> = [
  { value: 'once', label: '一次性' }, { value: 'daily', label: '每日' }, { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' }, { value: 'quarterly', label: '每季度' }, { value: 'semiannual', label: '每半年' },
  { value: 'yearly', label: '每年' }, { value: 'cron', label: '自定义周期' }, { value: 'holiday_relative', label: '节假日前后' },
]
const PRIORITY_LABELS: Record<string, string> = { low: '低', normal: '普通', high: '高', critical: '紧急' }
const GENERATION_MODE_LABELS: Record<string, string> = { per_user: '每人一份', per_group: '每组一份', shared: '多人共享一份', single: '单人一份' }
const ASSIGNMENT_STRATEGY_LABELS: Record<string, string> = { users: '指定人员', group_members: '组内所有成员', group_leaders: '组负责人', duty_roster: '当日值班人' }
const WEEKDAY_LABELS: Record<string, string> = { MON: '周一', TUE: '周二', WED: '周三', THU: '周四', FRI: '周五', SAT: '周六', SUN: '周日' }
const RELATIVE_LABELS: Record<string, string> = { before: '节前', after: '节后' }

function localDate(offsetDays = 0) {
  const date = new Date(); date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

function initialPayload(): TaskPlanPayload {
  return {
    name: '', description: '', templateVersionId: 0, scheduleType: 'daily',
    scheduleConfig: { time: '09:00', weekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI'], dueAfterHours: 10, priority: 'normal' },
    generationMode: 'per_user', assignmentRule: { strategy: 'group_members', groupIds: [] },
    ciScopeConfig: { selections: [], filters: { status: ['active'] } }, reminderConfig: { beforeDueHours: [2], onOverdue: true },
    escalationConfig: {}, generateAheadDays: 7, startDate: localDate(),
  }
}

function numberList(value: unknown): number[] {
  return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : []
}
function textValue(value: unknown, fallback = '') { return typeof value === 'string' ? value : fallback }
function numberValue(value: unknown, fallback: number) { return typeof value === 'number' ? value : Number(value) || fallback }

export function TaskPlanEditor({ planId }: TaskPlanEditorProps) {
  const detail = useQuery({ queryKey: ['task-plan', planId], queryFn: () => getTaskPlan(planId!), enabled: !!planId })
  const templates = useQuery({ queryKey: ['task-plan-template-options'], queryFn: listPublishedTemplates })
  const approvalSchemes = useQuery({ queryKey: ['task-plan-approval-options'], queryFn: listPublishedApprovalSchemes })

  if ((planId && detail.isLoading) || templates.isLoading || approvalSchemes.isLoading) return <LoadingState label="正在加载计划配置…" />
  if (planId && detail.isError) {
    return <ErrorState title="计划加载失败" description="无法读取任务计划。" retry={<Button type="button" size="sm" variant="secondary" onClick={() => void detail.refetch()}>重试</Button>} />
  }
  if (templates.isError) {
    return <ErrorState title="模板选项加载失败" description="无法读取已发布模板。" retry={<Button type="button" size="sm" variant="secondary" onClick={() => void templates.refetch()}>重试</Button>} />
  }
  if (approvalSchemes.isError) {
    return <ErrorState title="审批方案加载失败" description="无法读取审批方案。" retry={<Button type="button" size="sm" variant="secondary" onClick={() => void approvalSchemes.refetch()}>重试</Button>} />
  }

  const initial = detail.data
    ? payloadFromDetail(detail.data)
    : { ...initialPayload(), templateVersionId: templates.data?.[0]?.latestVersionId ?? 0 }

  return (
    <TaskPlanEditorForm
      key={planId ? `${planId}:${detail.data?.updatedAt}` : `new:${initial.templateVersionId}`}
      planId={planId}
      initial={initial}
      status={detail.data?.status}
      templates={templates.data ?? []}
      approvalSchemes={approvalSchemes.data ?? []}
    />
  )
}

function payloadFromDetail(detail: TaskPlanDetail): TaskPlanPayload {
  return {
    name: detail.name, description: detail.description, templateVersionId: detail.templateVersionId,
    approvalSchemeVersionId: detail.approvalSchemeVersionId, scheduleType: detail.scheduleType,
    scheduleConfig: detail.scheduleConfig, generationMode: detail.generationMode,
    assignmentRule: detail.assignmentRule, ciScopeConfig: detail.ciScopeConfig ?? { selections: [] },
    reminderConfig: detail.reminderConfig, escalationConfig: detail.escalationConfig,
    generateAheadDays: detail.generateAheadDays, startDate: detail.startDate, endDate: detail.endDate,
  }
}

function TaskPlanEditorForm({
  planId,
  initial,
  status,
  templates,
  approvalSchemes,
}: {
  planId?: number
  initial: TaskPlanPayload
  status?: TaskPlanDetail['status']
  templates: TaskTemplateSummary[]
  approvalSchemes: PublishedApprovalScheme[]
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [payload, setPayload] = useState<TaskPlanPayload>(initial)
  const [preview, setPreview] = useState<TaskPlanPreview>()
  const users = useQuery({ queryKey: ['task-plan-user-options'], queryFn: listDirectoryUsers })
  const groups = useQuery({ queryKey: ['task-plan-group-options'], queryFn: listDirectoryGroups })

  const editable = !status || ['draft', 'paused'].includes(status)
  const selectedUserIds = numberList(payload.assignmentRule.userIds)
  const selectedGroupIds = numberList(payload.assignmentRule.groupIds)
  const schedule = payload.scheduleConfig
  const ciSelections = payload.ciScopeConfig?.selections ?? []

  const save = useMutation({
    mutationFn: () => planId ? updateTaskPlan(planId, payload) : createTaskPlan(payload),
    onSuccess: async (saved) => {
      toast.success('计划已保存')
      await queryClient.invalidateQueries({ queryKey: ['task-plans'] })
      router.push(`/tasks/plans/${saved.id}`)
    },
    onError: () => toast.error('计划保存失败，请检查配置'),
  })
  const previewMutation = useMutation({
    mutationFn: () => previewTaskPlan(payload, 5),
    onSuccess: (data) => { setPreview(data); toast.success('预览已刷新') },
    onError: () => toast.error('预览失败，请检查周期和执行对象'),
  })

  const setSchedule = (key: string, value: unknown) => setPayload((current) => ({ ...current, scheduleConfig: { ...current.scheduleConfig, [key]: value } }))
  const setAssignment = (key: string, value: unknown) => setPayload((current) => ({ ...current, assignmentRule: { ...current.assignmentRule, [key]: value } }))
  const toggleId = (key: 'userIds' | 'groupIds', id: number) => {
    const values = numberList(payload.assignmentRule[key])
    setAssignment(key, values.includes(id) ? values.filter((value) => value !== id) : [...values, id])
  }
  const selectScheduleType = (value: ScheduleType) => {
    const defaults: Record<ScheduleType, Record<string, unknown>> = {
      once: { datetime: `${localDate(1)}T09:00`, dueAfterHours: 24, priority: 'normal' },
      daily: { time: '09:00', weekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI'], dueAfterHours: 10, priority: 'normal' },
      weekly: { time: '09:00', weekday: 'MON', dueAfterHours: 24, priority: 'normal' },
      monthly: { time: '09:00', position: 'last_day', dueAfterHours: 48, priority: 'normal' },
      quarterly: { time: '09:00', position: 'last_day', dueAfterHours: 72, priority: 'normal' },
      semiannual: { time: '09:00', position: 'last_day', dueAfterHours: 120, priority: 'normal' },
      yearly: { time: '09:00', month: 12, day: 31, dueAfterHours: 168, priority: 'normal' },
      cron: { expression: '0 0 9 * * MON-FRI', dueAfterHours: 10, priority: 'normal' },
      holiday_relative: { time: '09:00', relative: 'before', offsetWorkdays: 1, holidayType: 'legal', dueAfterHours: 24, priority: 'normal' },
    }
    setPayload((current) => ({ ...current, scheduleType: value, scheduleConfig: defaults[value] }))
  }

  const basicValid = Boolean(payload.name.trim() && payload.templateVersionId > 0)
  const assignmentValid = payload.generationMode === 'per_group' ? selectedGroupIds.length > 0
    : payload.assignmentRule.strategy === 'users' ? selectedUserIds.length > 0 : selectedGroupIds.length > 0
  const canNext = step === 0 ? basicValid : step === 2 ? assignmentValid : true
  const scheduleDescription = useMemo(() => SCHEDULE_OPTIONS.find((item) => item.value === payload.scheduleType)?.label, [payload.scheduleType])
  const templateOptions = templates.filter((template) => template.latestVersionId).map((template) => ({
    value: String(template.latestVersionId),
    label: template.name,
  }))
  const approvalOptions = [
    { value: 'none', label: '无需审批' },
    ...approvalSchemes.map((scheme) => ({
      value: String(scheme.latestVersionId),
      label: `${scheme.name} · 第 ${scheme.latestVersion?.version ?? '-'} 版`,
    })),
  ]

  return (
    <FormSettingsPage
      embedded
      className="cwgsyw-tasks-page cwgsyw-tasks-page--plan-editor"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          showSubtitle={false}
          title={planId ? `编辑计划：${initial.name}` : '新建任务计划'}
          status={<StatusBadge label={editable ? (status ? statusLabel(status) : '未保存') : statusLabel(status)} status={editable ? (status === 'paused' ? 'warning' : 'neutral') : 'neutral'} />}
          actions={
            editable ? (
              <Button type="button" size="sm" variant="primary" disabled={save.isPending || !basicValid || !assignmentValid} onClick={() => save.mutate()}>
                {save.isPending ? '保存中' : planId ? '保存计划' : '创建计划'}
              </Button>
            ) : null
          }
        />
      }
      form={
        <div className="cwgsyw-tasks-plan-editor">
          <ol className="cwgsyw-cmdb-wizard-steps" aria-label="计划配置步骤">
            {STEPS.map((label, index) => (
              <li
                key={label}
                data-state={index < step ? 'complete' : index === step ? 'current' : 'upcoming'}
                aria-current={step === index ? 'step' : undefined}
              >
                <button type="button" className="cwgsyw-tasks-wizard-step" onClick={() => setStep(index)}>
                  <span className="cwgsyw-cmdb-wizard-steps__index" aria-hidden="true">{index + 1}</span>
                  <span className="cwgsyw-cmdb-wizard-steps__label">{label}</span>
                </button>
              </li>
            ))}
          </ol>

          {step === 0 ? (
            <TaskPanel title="基础信息" description="选择已发布模板和可选审批方案；计划激活后始终固化对应版本。">
              <div className="cwgsyw-form cwgsyw-tasks-create-form">
                <div className="cwgsyw-tasks-create-grid">
                  <Field label="计划名称" required state={editable ? 'default' : 'disabled'}>
                    <Input size="sm" disabled={!editable} value={payload.name} placeholder="例如：数据库每日巡检" onChange={(event) => setPayload({ ...payload, name: event.target.value })} />
                  </Field>
                  <Field label="任务模板" required state={editable ? 'default' : 'disabled'}>
                    <Select
                      size="sm"
                      overlay
                      disabled={!editable}
                      value={payload.templateVersionId ? String(payload.templateVersionId) : undefined}
                      placeholder="选择已发布模板"
                      options={templateOptions}
                      onChange={(value) => setPayload({ ...payload, templateVersionId: Number(value) })}
                    />
                  </Field>
                  <div className="cwgsyw-tasks-create-grid__wide">
                    <Field label="审批方案" state={editable ? 'default' : 'disabled'}>
                      <Select
                        size="sm"
                        overlay
                        disabled={!editable}
                        value={payload.approvalSchemeVersionId ? String(payload.approvalSchemeVersionId) : 'none'}
                        options={approvalOptions}
                        onChange={(value) => setPayload({ ...payload, approvalSchemeVersionId: value === 'none' ? undefined : Number(value) })}
                      />
                    </Field>
                  </div>
                  <div className="cwgsyw-tasks-create-grid__wide">
                    <Field label="计划说明" state={editable ? 'default' : 'disabled'}>
                      <Textarea size="sm" disabled={!editable} rows={4} value={payload.description || ''} placeholder="说明任务目的、适用范围和执行要求" onChange={(event) => setPayload({ ...payload, description: event.target.value })} />
                    </Field>
                  </div>
                </div>
              </div>
            </TaskPanel>
          ) : null}

          {step === 1 ? (
            <TaskPanel title="周期与截止时间" description="支持一次性、常用周期、自定义周期和节假日前后规则。">
              <div className="cwgsyw-form cwgsyw-tasks-create-form">
                <div className="cwgsyw-tasks-create-grid">
                  <Field label="周期类型" state={editable ? 'default' : 'disabled'}>
                    <Select size="sm" overlay disabled={!editable} value={payload.scheduleType} options={SCHEDULE_OPTIONS} onChange={(value) => selectScheduleType(value as ScheduleType)} />
                  </Field>
                  <Field label="生效日期" state={editable ? 'default' : 'disabled'}>
                    <Input size="sm" disabled={!editable} type="date" value={payload.startDate || ''} onChange={(event) => setPayload({ ...payload, startDate: event.target.value })} />
                  </Field>
                  <Field label="结束日期" state={editable ? 'default' : 'disabled'}>
                    <Input size="sm" disabled={!editable} type="date" value={payload.endDate || ''} onChange={(event) => setPayload({ ...payload, endDate: event.target.value || undefined })} />
                  </Field>
                </div>
                <ScheduleFields type={payload.scheduleType} config={schedule} disabled={!editable} onChange={setSchedule} />
                <div className="cwgsyw-tasks-create-grid">
                  <Field label="截止偏移（小时）" state={editable ? 'default' : 'disabled'}>
                    <Input size="sm" disabled={!editable} type="number" min={0} max={8760} value={numberValue(schedule.dueAfterHours, 24)} onChange={(event) => setSchedule('dueAfterHours', Number(event.target.value))} />
                  </Field>
                  <Field label="提前生成（天）" state={editable ? 'default' : 'disabled'}>
                    <Input size="sm" disabled={!editable} type="number" min={0} max={365} value={payload.generateAheadDays ?? 7} onChange={(event) => setPayload({ ...payload, generateAheadDays: Number(event.target.value) })} />
                  </Field>
                  <Field label="优先级" state={editable ? 'default' : 'disabled'}>
                    <Select
                      size="sm"
                      overlay
                      disabled={!editable}
                      value={textValue(schedule.priority, 'normal')}
                      options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
                      onChange={(value) => setSchedule('priority', value)}
                    />
                  </Field>
                </div>
              </div>
            </TaskPanel>
          ) : null}

          {step === 2 ? (
            <>
              <TaskPanel title="执行对象" description="决定每个周期生成每人一份、每组一份、共享一份或单人一份任务。">
                <div className="cwgsyw-form cwgsyw-tasks-create-form">
                  <div className="cwgsyw-tasks-create-grid">
                    <Field label="生成模式" state={editable ? 'default' : 'disabled'}>
                      <Select
                        size="sm"
                        overlay
                        disabled={!editable}
                        value={payload.generationMode}
                        options={Object.entries(GENERATION_MODE_LABELS).map(([value, label]) => ({ value, label }))}
                        onChange={(value) => setPayload({ ...payload, generationMode: value as GenerationMode })}
                      />
                    </Field>
                    {payload.generationMode !== 'per_group' ? (
                      <Field label="解析策略" state={editable ? 'default' : 'disabled'}>
                        <Select
                          size="sm"
                          overlay
                          disabled={!editable}
                          value={textValue(payload.assignmentRule.strategy, 'group_members')}
                          options={Object.entries(ASSIGNMENT_STRATEGY_LABELS).map(([value, label]) => ({ value, label }))}
                          onChange={(value) => setAssignment('strategy', value)}
                        />
                      </Field>
                    ) : null}
                  </div>
                  {payload.assignmentRule.strategy === 'users' && payload.generationMode !== 'per_group' ? (
                    <OptionGrid title="选择人员" options={users.data?.map((user) => ({ id: user.id, label: user.realName || user.username, meta: user.username })) ?? []} selected={selectedUserIds} disabled={!editable} onToggle={(id) => toggleId('userIds', id)} />
                  ) : (
                    <OptionGrid title="选择用户组" options={groups.data?.map((group) => ({ id: group.id, label: group.name, meta: group.code })) ?? []} selected={selectedGroupIds} disabled={!editable} onToggle={(id) => toggleId('groupIds', id)} />
                  )}
                </div>
              </TaskPanel>
              <TaskPanel title="CI 范围（可选）" description="模型组、模型和单个配置项可混合多选；上级范围自动覆盖下级并去重。">
                {editable ? (
                  <CiScopeSelector value={ciSelections} onChange={(selections: CiScopeSelection[]) => setPayload({ ...payload, ciScopeConfig: { ...payload.ciScopeConfig, selections } })} />
                ) : (
                  <p className="cwgsyw-tasks-cell-meta">已配置 {ciSelections.length} 个范围选择。</p>
                )}
              </TaskPanel>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <TaskPanel title="提醒与升级" description="提醒配置随计划保存，后续由统一通知投递。">
                <div className="cwgsyw-tasks-create-grid">
                  <Field label="到期前提醒（小时）" state={editable ? 'default' : 'disabled'}>
                    <Input size="sm" disabled={!editable} type="number" min={0} value={numberList(payload.reminderConfig?.beforeDueHours)[0] ?? 2} onChange={(event) => setPayload({ ...payload, reminderConfig: { ...payload.reminderConfig, beforeDueHours: [Number(event.target.value)] } })} />
                  </Field>
                  <Field label="逾期升级（小时）" state={editable ? 'default' : 'disabled'}>
                    <Input size="sm" disabled={!editable} type="number" min={0} value={numberValue(payload.escalationConfig?.afterOverdueHours, 24)} onChange={(event) => setPayload({ ...payload, escalationConfig: { ...payload.escalationConfig, afterOverdueHours: Number(event.target.value) } })} />
                  </Field>
                  <Switch
                    disabled={!editable}
                    checked={payload.reminderConfig?.onOverdue !== false}
                    label="逾期时提醒"
                    onChange={(event) => setPayload({ ...payload, reminderConfig: { ...payload.reminderConfig, onOverdue: event.target.checked } })}
                  />
                </div>
              </TaskPanel>
              <TaskPanel
                title="生成预览"
                description={`${scheduleDescription} · 展示周期、执行对象、截止时间与配置项命中。`}
                action={
                  <Button type="button" variant="secondary" size="sm" disabled={previewMutation.isPending || !basicValid || !assignmentValid} onClick={() => previewMutation.mutate()}>
                    {previewMutation.isPending ? '计算中' : '刷新预览'}
                  </Button>
                }
              >
                {preview ? <PreviewPanel preview={preview} selections={ciSelections} /> : <p className="cwgsyw-tasks-cell-meta">点击“刷新预览”验证计划配置。</p>}
              </TaskPanel>
            </>
          ) : null}

          <div className="cwgsyw-form__actions cwgsyw-tasks-create-actions">
            <Button type="button" size="sm" variant="secondary" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>上一步</Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" size="sm" variant="primary" disabled={!canNext} onClick={() => setStep((value) => value + 1)}>下一步</Button>
            ) : editable ? (
              <Button type="button" size="sm" variant="primary" disabled={save.isPending || !basicValid || !assignmentValid} onClick={() => save.mutate()}>
                {save.isPending ? '保存中' : planId ? '保存计划' : '创建计划'}
              </Button>
            ) : null}
          </div>
        </div>
      }
    />
  )
}

function ScheduleFields({ type, config, disabled, onChange }: { type: ScheduleType; config: Record<string, unknown>; disabled: boolean; onChange: (key: string, value: unknown) => void }) {
  if (type === 'once') {
    return (
      <Field label="执行时间" state={disabled ? 'disabled' : 'default'}>
        <Input size="sm" disabled={disabled} type="datetime-local" value={textValue(config.datetime)} onChange={(event) => onChange('datetime', event.target.value)} />
      </Field>
    )
  }
  if (type === 'cron') {
    return (
      <Field label="自定义周期表达式" state={disabled ? 'disabled' : 'default'}>
        <Input size="sm" disabled={disabled} value={textValue(config.expression)} placeholder="0 0 9 * * MON-FRI" onChange={(event) => onChange('expression', event.target.value)} />
      </Field>
    )
  }
  if (type === 'holiday_relative') {
    return (
      <div className="cwgsyw-tasks-create-grid">
        <Field label="相对方向" state={disabled ? 'disabled' : 'default'}>
          <Select size="sm" overlay disabled={disabled} value={textValue(config.relative, 'before')} options={Object.entries(RELATIVE_LABELS).map(([value, label]) => ({ value, label }))} onChange={(value) => onChange('relative', value)} />
        </Field>
        <Field label="第 N 个工作日" state={disabled ? 'disabled' : 'default'}>
          <Input size="sm" disabled={disabled} type="number" min={1} value={numberValue(config.offsetWorkdays, 1)} onChange={(event) => onChange('offsetWorkdays', Number(event.target.value))} />
        </Field>
        <TimeField config={config} disabled={disabled} onChange={onChange} />
      </div>
    )
  }
  return (
    <div className="cwgsyw-tasks-create-grid">
      <TimeField config={config} disabled={disabled} onChange={onChange} />
      {type === 'weekly' ? (
        <Field label="星期" state={disabled ? 'disabled' : 'default'}>
          <Select size="sm" overlay disabled={disabled} value={textValue(config.weekday, 'MON')} options={Object.entries(WEEKDAY_LABELS).map(([value, label]) => ({ value, label }))} onChange={(value) => onChange('weekday', value)} />
        </Field>
      ) : null}
      {['monthly', 'quarterly', 'semiannual'].includes(type) ? (
        <Field label="周期位置" state={disabled ? 'disabled' : 'default'}>
          <Select
            size="sm"
            overlay
            disabled={disabled}
            value={textValue(config.position, 'last_day')}
            options={[
              { value: 'first_day', label: '首日' },
              { value: 'last_day', label: '末日' },
              ...(type === 'monthly' ? [{ value: 'day_of_month', label: '指定日期' }] : []),
            ]}
            onChange={(value) => onChange('position', value)}
          />
        </Field>
      ) : null}
      {type === 'monthly' && config.position === 'day_of_month' ? (
        <Field label="每月第几日" state={disabled ? 'disabled' : 'default'}>
          <Input size="sm" disabled={disabled} type="number" min={1} max={31} value={numberValue(config.day, 1)} onChange={(event) => onChange('day', Number(event.target.value))} />
        </Field>
      ) : null}
      {type === 'yearly' ? (
        <>
          <Field label="月份" state={disabled ? 'disabled' : 'default'}>
            <Input size="sm" disabled={disabled} type="number" min={1} max={12} value={numberValue(config.month, 1)} onChange={(event) => onChange('month', Number(event.target.value))} />
          </Field>
          <Field label="日期" state={disabled ? 'disabled' : 'default'}>
            <Input size="sm" disabled={disabled} type="number" min={1} max={31} value={numberValue(config.day, 1)} onChange={(event) => onChange('day', Number(event.target.value))} />
          </Field>
        </>
      ) : null}
    </div>
  )
}

function TimeField({ config, disabled, onChange }: { config: Record<string, unknown>; disabled: boolean; onChange: (key: string, value: unknown) => void }) {
  return (
    <Field label="执行时间" state={disabled ? 'disabled' : 'default'}>
      <Input size="sm" disabled={disabled} type="time" value={textValue(config.time, '09:00')} onChange={(event) => onChange('time', event.target.value)} />
    </Field>
  )
}

function OptionGrid({ title, options, selected, disabled, onToggle }: { title: string; options: Array<{ id: number; label: string; meta?: string }>; selected: number[]; disabled: boolean; onToggle: (id: number) => void }) {
  return (
    <div className="cwgsyw-tasks-option-grid">
      <p className="cwgsyw-tasks-cell-meta">{title}</p>
      <div className="cwgsyw-tasks-option-grid__list">
        {options.map((option) => (
          <Checkbox
            key={option.id}
            disabled={disabled}
            checked={selected.includes(option.id)}
            label={`${option.label}${option.meta ? ` ${option.meta}` : ''}`}
            onChange={() => onToggle(option.id)}
          />
        ))}
      </div>
    </div>
  )
}

function PreviewPanel({ preview, selections }: { preview: TaskPlanPreview; selections: CiScopeSelection[] }) {
  return (
    <div className="cwgsyw-tasks-preview">
      <p className="cwgsyw-tasks-preview__summary">模板「{preview.templateName}」将生成任务，以下 5 个周期共 {preview.totalTaskCount} 份。</p>
      {preview.warnings.map((warning) => (
        <p key={warning} className="cwgsyw-tasks-preview__warning">{localizeScopeWarning(warning, selections)}</p>
      ))}
      <div className="cwgsyw-tasks-preview-list">
        {preview.occurrences.map((occurrence) => (
          <article key={occurrence.occurrenceAt} className="cwgsyw-tasks-preview-item">
            <div className="cwgsyw-inline-controls">
              <p className="cwgsyw-tasks-preview__time">{new Date(occurrence.occurrenceAt).toLocaleString('zh-CN')}</p>
              <span>截止：{new Date(occurrence.dueAt).toLocaleString('zh-CN')}</span>
              <span>{occurrence.taskCount} 份任务 · {occurrence.ciCount} 个配置项</span>
            </div>
            <div className="cwgsyw-inline-controls">
              {occurrence.targets.slice(0, 12).map((target) => (
                <Chip key={`${target.subjectType}:${target.subjectId ?? 'shared'}`} label={target.displayName} />
              ))}
              {occurrence.targets.length > 12 ? <Chip label={`+${occurrence.targets.length - 12}`} /> : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function statusLabel(status?: string) {
  return { draft: '草稿', active: '运行中', paused: '已暂停', finished: '已结束', archived: '已归档' }[status ?? ''] ?? (status || '未保存')
}
