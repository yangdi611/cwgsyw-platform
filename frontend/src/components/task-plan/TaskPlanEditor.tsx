'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CalendarClock, Check, Eye, Save, Users } from 'lucide-react'
import { toast } from 'sonner'
import { CiScopeSelector } from '@/components/task-plan/CiScopeSelector'
import { DetailHeader, ErrorState, FormShell, LoadingState } from '@/components/shared'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/components/design-system'
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

interface TaskPlanEditorProps { planId?: number }

const STEPS = ['基础信息', '周期与截止', '执行对象与 CI', '提醒与预览']
const SCHEDULE_OPTIONS: Array<{ value: ScheduleType; label: string }> = [
  { value: 'once', label: '一次性' }, { value: 'daily', label: '每日' }, { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' }, { value: 'quarterly', label: '每季度' }, { value: 'semiannual', label: '每半年' },
  { value: 'yearly', label: '每年' }, { value: 'cron', label: '高级 Cron' }, { value: 'holiday_relative', label: '节假日前后' },
]
const PRIORITY_LABELS: Record<string, string> = { low: '低', normal: '普通', high: '高', critical: '紧急' }
const GENERATION_MODE_LABELS: Record<string, string> = { per_user: '每人一份', per_group: '每组一份', shared: '多人共享一份', single: '单人一份' }
const ASSIGNMENT_STRATEGY_LABELS: Record<string, string> = { users: '指定人员', group_members: '组内所有成员', group_leaders: '组负责人', duty_roster: '当日值班人' }
const WEEKDAY_LABELS: Record<string, string> = { MON: '周一', TUE: '周二', WED: '周三', THU: '周四', FRI: '周五', SAT: '周六', SUN: '周日' }
const POSITION_LABELS: Record<string, string> = { first_day: '首日', last_day: '末日', day_of_month: '指定日期' }
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

  if ((planId && detail.isLoading) || templates.isLoading || approvalSchemes.isLoading) return <LoadingState />
  if (planId && detail.isError) return <ErrorState title="计划加载失败" onRetry={() => detail.refetch()} />
  if (templates.isError) return <ErrorState title="模板选项加载失败" onRetry={() => templates.refetch()} />
  if (approvalSchemes.isError) return <ErrorState title="审批方案加载失败" onRetry={() => approvalSchemes.refetch()} />

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

  const basicValid = payload.name.trim() && payload.templateVersionId > 0
  const assignmentValid = payload.generationMode === 'per_group' ? selectedGroupIds.length > 0
    : payload.assignmentRule.strategy === 'users' ? selectedUserIds.length > 0 : selectedGroupIds.length > 0
  const canNext = step === 0 ? basicValid : step === 2 ? assignmentValid : true
  const scheduleDescription = useMemo(() => SCHEDULE_OPTIONS.find((item) => item.value === payload.scheduleType)?.label, [payload.scheduleType])

  return (
    <FormShell width="wide">
      <DetailHeader
        backHref="/tasks/plans"
        eyebrow="统一任务平台"
        title={planId ? `编辑计划：${initial.name}` : '新建任务计划'}
        subtitle={editable ? '按步骤配置模板、周期、执行对象、CI 范围和提醒，并在保存前预览实际生成结果。' : '已生效或结束的计划只读；暂停后可继续编辑。'}
      />
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="h-fit p-3">
          {STEPS.map((label, index) => <button key={label} type="button" onClick={() => setStep(index)} className={`flex w-full items-center gap-3 rounded-v2-md px-3 py-2 text-left text-sm ${step === index ? 'bg-v2-primary-soft font-semibold text-v2-primary' : 'text-v2-muted hover:bg-v2-surface-hover'}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${index < step ? 'border-v2-success bg-v2-success text-white' : 'border-v2-border'}`}>{index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>{label}</button>)}
        </Card>

        <div className="space-y-4">
          {step === 0 && <Card><CardHeader><CardTitle>基础信息</CardTitle><CardDescription>选择已发布模板和可选审批方案；计划激活后始终固化对应版本。</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>计划名称 *</Label><Input disabled={!editable} value={payload.name} onChange={(event) => setPayload({ ...payload, name: event.target.value })} placeholder="例如：数据库每日巡检" /></div><div className="space-y-2"><Label>任务模板 *</Label><Select disabled={!editable} value={String(payload.templateVersionId || '')} onValueChange={(value) => setPayload({ ...payload, templateVersionId: Number(value) })}><SelectTrigger><SelectValue placeholder="选择已发布模板">{(value: string) => templates.find((template) => String(template.latestVersionId) === value)?.name ?? '选择已发布模板'}</SelectValue></SelectTrigger><SelectContent>{templates.filter((template) => template.latestVersionId).map((template) => <SelectItem key={template.id} value={String(template.latestVersionId)}>{template.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>审批方案</Label><Select disabled={!editable} value={payload.approvalSchemeVersionId ? String(payload.approvalSchemeVersionId) : 'none'} onValueChange={(value) => setPayload({ ...payload, approvalSchemeVersionId: value === 'none' ? undefined : Number(value) })}><SelectTrigger><SelectValue>{(value: string) => { const scheme = approvalSchemes.find((item) => String(item.latestVersionId) === value); return value === 'none' ? '无需审批' : scheme ? `${scheme.name} · v${scheme.latestVersion?.version ?? '-'}` : '选择审批方案' }}</SelectValue></SelectTrigger><SelectContent><SelectItem value="none">无需审批</SelectItem>{approvalSchemes.map((scheme) => <SelectItem key={scheme.latestVersionId} value={String(scheme.latestVersionId)}>{scheme.name} · v{scheme.latestVersion?.version ?? '-'}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-2"><Label>计划说明</Label><Textarea disabled={!editable} rows={4} value={payload.description || ''} onChange={(event) => setPayload({ ...payload, description: event.target.value })} placeholder="说明任务目的、适用范围和执行要求" /></div></CardContent></Card>}

          {step === 1 && <Card><CardHeader><CardTitle>周期与截止时间</CardTitle><CardDescription>支持一次性、常用周期、高级 Cron 和节假日前后规则。</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label>周期类型</Label><Select disabled={!editable} value={payload.scheduleType} onValueChange={(value) => selectScheduleType(value as ScheduleType)}><SelectTrigger><SelectValue>{(value: string) => SCHEDULE_OPTIONS.find((item) => item.value === value)?.label ?? value}</SelectValue></SelectTrigger><SelectContent>{SCHEDULE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>生效日期</Label><Input disabled={!editable} type="date" value={payload.startDate || ''} onChange={(event) => setPayload({ ...payload, startDate: event.target.value })} /></div><div className="space-y-2"><Label>结束日期</Label><Input disabled={!editable} type="date" value={payload.endDate || ''} onChange={(event) => setPayload({ ...payload, endDate: event.target.value || undefined })} /></div></div><ScheduleFields type={payload.scheduleType} config={schedule} disabled={!editable} onChange={setSchedule} /><div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label>截止偏移（小时）</Label><Input disabled={!editable} type="number" min={0} max={8760} value={numberValue(schedule.dueAfterHours, 24)} onChange={(event) => setSchedule('dueAfterHours', Number(event.target.value))} /></div><div className="space-y-2"><Label>提前生成（天）</Label><Input disabled={!editable} type="number" min={0} max={365} value={payload.generateAheadDays ?? 7} onChange={(event) => setPayload({ ...payload, generateAheadDays: Number(event.target.value) })} /></div><div className="space-y-2"><Label>优先级</Label><Select disabled={!editable} value={textValue(schedule.priority, 'normal')} onValueChange={(value) => setSchedule('priority', value)}><SelectTrigger><SelectValue>{(value: string) => PRIORITY_LABELS[value] ?? value}</SelectValue></SelectTrigger><SelectContent><SelectItem value="low">低</SelectItem><SelectItem value="normal">普通</SelectItem><SelectItem value="high">高</SelectItem><SelectItem value="critical">紧急</SelectItem></SelectContent></Select></div></div></CardContent></Card>}

          {step === 2 && <div className="space-y-4"><Card><CardHeader><CardTitle>执行对象</CardTitle><CardDescription>决定每个 occurrence 生成每人一份、每组一份、共享一份或单人一份任务。</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>生成模式</Label><Select disabled={!editable} value={payload.generationMode} onValueChange={(value) => setPayload({ ...payload, generationMode: value as GenerationMode })}><SelectTrigger><SelectValue>{(value: string) => GENERATION_MODE_LABELS[value] ?? value}</SelectValue></SelectTrigger><SelectContent><SelectItem value="per_user">每人一份</SelectItem><SelectItem value="per_group">每组一份</SelectItem><SelectItem value="shared">多人共享一份</SelectItem><SelectItem value="single">单人一份</SelectItem></SelectContent></Select></div>{payload.generationMode !== 'per_group' && <div className="space-y-2"><Label>解析策略</Label><Select disabled={!editable} value={textValue(payload.assignmentRule.strategy, 'group_members')} onValueChange={(value) => setAssignment('strategy', value)}><SelectTrigger><SelectValue>{(value: string) => ASSIGNMENT_STRATEGY_LABELS[value] ?? value}</SelectValue></SelectTrigger><SelectContent><SelectItem value="users">指定人员</SelectItem><SelectItem value="group_members">组内所有成员</SelectItem><SelectItem value="group_leaders">组负责人</SelectItem><SelectItem value="duty_roster">当日值班人</SelectItem></SelectContent></Select></div>}</div>{payload.assignmentRule.strategy === 'users' && payload.generationMode !== 'per_group' ? <OptionGrid title="选择人员" options={users.data?.map((user) => ({ id: user.id, label: user.realName || user.username, meta: `@${user.username}` })) ?? []} selected={selectedUserIds} disabled={!editable} onToggle={(id) => toggleId('userIds', id)} /> : <OptionGrid title="选择用户组" options={groups.data?.map((group) => ({ id: group.id, label: group.name, meta: group.code })) ?? []} selected={selectedGroupIds} disabled={!editable} onToggle={(id) => toggleId('groupIds', id)} />}</CardContent></Card><Card><CardHeader><CardTitle>CI 范围（可选）</CardTitle><CardDescription>模型组、模型和单个 CI 可混合多选；上级范围自动覆盖下级并去重。</CardDescription></CardHeader><CardContent>{editable ? <CiScopeSelector value={ciSelections} onChange={(selections: CiScopeSelection[]) => setPayload({ ...payload, ciScopeConfig: { ...payload.ciScopeConfig, selections } })} /> : <p className="text-sm text-v2-muted">已配置 {ciSelections.length} 个范围选择。</p>}</CardContent></Card></div>}

          {step === 3 && <div className="space-y-4"><Card><CardHeader><CardTitle>提醒与升级</CardTitle><CardDescription>提醒配置随计划保存，后续由统一通知 outbox 幂等投递。</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label>到期前提醒（小时）</Label><Input disabled={!editable} type="number" min={0} value={numberList(payload.reminderConfig?.beforeDueHours)[0] ?? 2} onChange={(event) => setPayload({ ...payload, reminderConfig: { ...payload.reminderConfig, beforeDueHours: [Number(event.target.value)] } })} /></div><div className="space-y-2"><Label>逾期升级（小时）</Label><Input disabled={!editable} type="number" min={0} value={numberValue(payload.escalationConfig?.afterOverdueHours, 24)} onChange={(event) => setPayload({ ...payload, escalationConfig: { ...payload.escalationConfig, afterOverdueHours: Number(event.target.value) } })} /></div><div className="flex items-end"><label className="flex h-10 items-center gap-2 text-sm text-v2-fg"><input disabled={!editable} type="checkbox" checked={payload.reminderConfig?.onOverdue !== false} onChange={(event) => setPayload({ ...payload, reminderConfig: { ...payload.reminderConfig, onOverdue: event.target.checked } })} />逾期时提醒</label></div></CardContent></Card><Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>生成预览</CardTitle><CardDescription>{scheduleDescription} · 展示 occurrence、执行对象、截止时间与 CI 命中。</CardDescription></div><Button type="button" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending || !basicValid || !assignmentValid}><Eye className="h-4 w-4" />{previewMutation.isPending ? '计算中' : '刷新预览'}</Button></div></CardHeader><CardContent>{preview ? <PreviewPanel preview={preview} /> : <div className="py-10 text-center text-sm text-v2-muted"><CalendarClock className="mx-auto mb-2 h-8 w-8" />点击“刷新预览”验证计划配置。</div>}</CardContent></Card></div>}

          <div className="flex items-center justify-between"><Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft className="h-4 w-4" />上一步</Button><div className="flex gap-2">{step < STEPS.length - 1 ? <Button type="button" variant="primary" disabled={!canNext} onClick={() => setStep((value) => value + 1)}>下一步<ArrowRight className="h-4 w-4" /></Button> : editable && <Button type="button" variant="primary" disabled={save.isPending || !basicValid || !assignmentValid} onClick={() => save.mutate()}><Save className="h-4 w-4" />{save.isPending ? '保存中' : '保存计划'}</Button>}</div></div>
        </div>
      </div>
    </FormShell>
  )
}

function ScheduleFields({ type, config, disabled, onChange }: { type: ScheduleType; config: Record<string, unknown>; disabled: boolean; onChange: (key: string, value: unknown) => void }) {
  if (type === 'once') return <div className="space-y-2"><Label>执行时间</Label><Input disabled={disabled} type="datetime-local" value={textValue(config.datetime)} onChange={(event) => onChange('datetime', event.target.value)} /></div>
  if (type === 'cron') return <div className="space-y-2"><Label>Spring 六段 Cron</Label><Input disabled={disabled} value={textValue(config.expression)} onChange={(event) => onChange('expression', event.target.value)} placeholder="0 0 9 * * MON-FRI" /></div>
  if (type === 'holiday_relative') return <div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label>相对方向</Label><Select disabled={disabled} value={textValue(config.relative, 'before')} onValueChange={(value) => onChange('relative', value)}><SelectTrigger><SelectValue>{(value: string) => RELATIVE_LABELS[value] ?? value}</SelectValue></SelectTrigger><SelectContent><SelectItem value="before">节前</SelectItem><SelectItem value="after">节后</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>第 N 个工作日</Label><Input disabled={disabled} type="number" min={1} value={numberValue(config.offsetWorkdays, 1)} onChange={(event) => onChange('offsetWorkdays', Number(event.target.value))} /></div><TimeField config={config} disabled={disabled} onChange={onChange} /></div>
  return <div className="grid gap-4 md:grid-cols-3"><TimeField config={config} disabled={disabled} onChange={onChange} />{type === 'weekly' && <div className="space-y-2"><Label>星期</Label><Select disabled={disabled} value={textValue(config.weekday, 'MON')} onValueChange={(value) => onChange('weekday', value)}><SelectTrigger><SelectValue>{(value: string) => WEEKDAY_LABELS[value] ?? value}</SelectValue></SelectTrigger><SelectContent>{Object.entries(WEEKDAY_LABELS).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>}{['monthly','quarterly','semiannual'].includes(type) && <div className="space-y-2"><Label>周期位置</Label><Select disabled={disabled} value={textValue(config.position, 'last_day')} onValueChange={(value) => onChange('position', value)}><SelectTrigger><SelectValue>{(value: string) => POSITION_LABELS[value] ?? value}</SelectValue></SelectTrigger><SelectContent><SelectItem value="first_day">首日</SelectItem><SelectItem value="last_day">末日</SelectItem>{type === 'monthly' && <SelectItem value="day_of_month">指定日期</SelectItem>}</SelectContent></Select></div>}{type === 'monthly' && config.position === 'day_of_month' && <div className="space-y-2"><Label>每月第几日</Label><Input disabled={disabled} type="number" min={1} max={31} value={numberValue(config.day, 1)} onChange={(event) => onChange('day', Number(event.target.value))} /></div>}{type === 'yearly' && <><div className="space-y-2"><Label>月份</Label><Input disabled={disabled} type="number" min={1} max={12} value={numberValue(config.month, 1)} onChange={(event) => onChange('month', Number(event.target.value))} /></div><div className="space-y-2"><Label>日期</Label><Input disabled={disabled} type="number" min={1} max={31} value={numberValue(config.day, 1)} onChange={(event) => onChange('day', Number(event.target.value))} /></div></>}</div>
}

function TimeField({ config, disabled, onChange }: { config: Record<string, unknown>; disabled: boolean; onChange: (key: string, value: unknown) => void }) { return <div className="space-y-2"><Label>执行时间</Label><Input disabled={disabled} type="time" value={textValue(config.time, '09:00')} onChange={(event) => onChange('time', event.target.value)} /></div> }

function OptionGrid({ title, options, selected, disabled, onToggle }: { title: string; options: Array<{ id: number; label: string; meta?: string }>; selected: number[]; disabled: boolean; onToggle: (id: number) => void }) {
  return <div className="space-y-2"><Label>{title}</Label><div className="grid max-h-56 gap-2 overflow-y-auto rounded-v2-md border border-v2-border p-2 md:grid-cols-2">{options.map((option) => <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-v2-md px-3 py-2 hover:bg-v2-surface-hover"><input disabled={disabled} type="checkbox" checked={selected.includes(option.id)} onChange={() => onToggle(option.id)} /><Users className="h-4 w-4 text-v2-muted" /><span className="min-w-0 flex-1 truncate text-sm text-v2-fg">{option.label}</span><span className="text-xs text-v2-muted">{option.meta}</span></label>)}</div></div>
}

function PreviewPanel({ preview }: { preview: TaskPlanPreview }) {
  return <div className="space-y-3"><div className="rounded-v2-md bg-v2-primary-soft px-3 py-2 text-sm text-v2-primary">模板“{preview.templateName}”将在以下 5 个 occurrence 共生成 {preview.totalTaskCount} 份任务。</div>{preview.warnings.map((warning) => <p key={warning} className="text-xs text-v2-warning">{warning}</p>)}<div className="space-y-2">{preview.occurrences.map((occurrence) => <div key={occurrence.occurrenceAt} className="rounded-v2-md border border-v2-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-v2-fg">{new Date(occurrence.occurrenceAt).toLocaleString('zh-CN')}</p><p className="text-xs text-v2-muted">截止：{new Date(occurrence.dueAt).toLocaleString('zh-CN')}</p></div><div className="text-right text-xs text-v2-muted"><p>{occurrence.taskCount} 份任务</p><p>{occurrence.ciCount} 个 CI</p></div></div><div className="mt-2 flex flex-wrap gap-1">{occurrence.targets.slice(0, 12).map((target) => <span key={`${target.subjectType}:${target.subjectId ?? 'shared'}`} className="rounded bg-v2-surface-soft px-2 py-1 text-xs text-v2-muted">{target.displayName}</span>)}{occurrence.targets.length > 12 && <span className="px-2 py-1 text-xs text-v2-muted">+{occurrence.targets.length - 12}</span>}</div></div>)}</div></div>
}
