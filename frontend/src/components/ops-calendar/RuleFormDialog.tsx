'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/v2/Dialog'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Textarea } from '@/components/v2/Textarea'
import { Switch } from '@/components/v2/Switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { type RuleVO, type RulePreviewVO, TASK_TYPE_META, fmtTime, errMsg } from '@/lib/opsCalendar'

interface Props {
  open: boolean
  rule: RuleVO | null
  onOpenChange: (open: boolean) => void
}

const TRIGGER_TYPES = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'quarterly', label: '每季度' },
  { value: 'semiannual', label: '每半年' },
  { value: 'yearly', label: '每年' },
  { value: 'cron', label: 'Cron 高级' },
  { value: 'holiday_relative', label: '节假日相对' },
]

const WEEKDAYS = [
  { value: 'MON', label: '周一' }, { value: 'TUE', label: '周二' }, { value: 'WED', label: '周三' },
  { value: 'THU', label: '周四' }, { value: 'FRI', label: '周五' }, { value: 'SAT', label: '周六' }, { value: 'SUN', label: '周日' },
]

export function RuleFormDialog({ open, rule, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const isEdit = !!rule

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [taskType, setTaskType] = useState('inspection')
  const [triggerType, setTriggerType] = useState('weekly')
  const [time, setTime] = useState('09:00')
  const [weekday, setWeekday] = useState('FRI')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [quarterPosition, setQuarterPosition] = useState('last_day')
  const [offsetDays, setOffsetDays] = useState('-5')
  const [cronExpr, setCronExpr] = useState('0 0 9 * * MON-FRI')
  const [generateDaysAhead, setGenerateDaysAhead] = useState('7')
  const [dueOffsetDays, setDueOffsetDays] = useState('5')
  const [assigneeType, setAssigneeType] = useState('group_leader')
  const [assigneeGroupId, setAssigneeGroupId] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [visibility, setVisibility] = useState('group')
  const [sensitive, setSensitive] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [checklistTemplateId, setChecklistTemplateId] = useState('')
  // holiday_relative 配置
  const [hrRelative, setHrRelative] = useState('before')
  const [hrOffsetWorkdays, setHrOffsetWorkdays] = useState('2')
  const [preview, setPreview] = useState<RulePreviewVO[]>([])

  // 检查项模板列表（供规则关联 SOP 模板）
  const { data: templates = [] } = useQuery({
    queryKey: ['ops-templates-for-rule'],
    queryFn: () => api.get('/ops-calendar/templates', { params: { templateType: 'checklist' } })
      .then((r) => (r.data.data ?? []) as { id: number; name: string }[])
      .catch(() => [] as { id: number; name: string }[]),
    enabled: open,
  })

  // 打开时 / 切换编辑目标时，render 期同步表单（避免 effect 内 setState 触发级联渲染）
  const formKey = open ? (rule ? `edit-${rule.id}` : 'create') : 'closed'
  const [prevKey, setPrevKey] = useState<string | null>(null)
  if (open && formKey !== prevKey) {
    setPrevKey(formKey)
    if (rule) {
      const tc = rule.triggerConfig || {}
      const ar = rule.assigneeRule || {}
      setName(rule.name); setDescription(rule.description ?? '')
      setTaskType(rule.taskType); setTriggerType(rule.triggerType)
      setTime(String(tc.time ?? '09:00'))
      setWeekday(String(tc.weekday ?? 'FRI'))
      setDayOfMonth(String(tc.dayOfMonth ?? '1'))
      setQuarterPosition(String(tc.quarterPosition ?? tc.position ?? 'last_day'))
      setOffsetDays(String(tc.offsetDays ?? '-5'))
      setCronExpr(String(tc.expression ?? '0 0 9 * * MON-FRI'))
      setGenerateDaysAhead(String(rule.generateDaysAhead ?? 7))
      setDueOffsetDays(String((rule.dueConfig as Record<string, unknown>)?.offsetDays ?? 5))
      setAssigneeType(String(ar.type ?? 'group_leader'))
      setAssigneeGroupId(ar.groupId != null ? String(ar.groupId) : '')
      setAssigneeUserId(ar.userId != null ? String(ar.userId) : '')
      setVisibility(rule.visibility); setSensitive(rule.sensitive); setEnabled(rule.enabled)
      setChecklistTemplateId((rule as { checklistTemplateId?: number }).checklistTemplateId != null
        ? String((rule as { checklistTemplateId?: number }).checklistTemplateId) : '')
      setHrRelative(String(tc.relative ?? 'before'))
      setHrOffsetWorkdays(String(tc.offsetWorkdays ?? '2'))
    } else {
      setName(''); setDescription(''); setTaskType('inspection'); setTriggerType('weekly')
      setTime('09:00'); setWeekday('FRI'); setDayOfMonth('1'); setQuarterPosition('last_day')
      setOffsetDays('-5'); setCronExpr('0 0 9 * * MON-FRI'); setGenerateDaysAhead('7')
      setDueOffsetDays('5'); setAssigneeType('group_leader'); setAssigneeGroupId('')
      setAssigneeUserId(''); setVisibility('group'); setSensitive(false); setEnabled(true)
      setChecklistTemplateId(''); setHrRelative('before'); setHrOffsetWorkdays('2')
    }
    setPreview([])
  }

  function buildTriggerConfig(): Record<string, unknown> {
    switch (triggerType) {
      case 'daily': return { time }
      case 'weekly': return { weekday, time, interval: 1 }
      case 'monthly': return { dayOfMonth: Number(dayOfMonth), time }
      case 'quarterly': return { quarterPosition, offsetDays: Number(offsetDays), time }
      case 'semiannual': return { position: quarterPosition, offsetDays: Number(offsetDays), time }
      case 'yearly': return { month: 1, day: Number(dayOfMonth), time }
      case 'cron': return { expression: cronExpr }
      case 'holiday_relative': return { relative: hrRelative, offsetWorkdays: Number(hrOffsetWorkdays), time }
      default: return { time }
    }
  }

  function buildPayload() {
    const assigneeRule: Record<string, unknown> = { type: assigneeType }
    if (assigneeGroupId) assigneeRule.groupId = Number(assigneeGroupId)
    if (assigneeType === 'fixed' && assigneeUserId) assigneeRule.userId = Number(assigneeUserId)
    return {
      name, description, taskType, triggerType,
      triggerConfig: buildTriggerConfig(),
      generateDaysAhead: Number(generateDaysAhead),
      reminderConfig: { stages: [{ stage: 'created', offsetHours: 0 }, { stage: 'remind_1d', offsetHoursBeforeDue: 24 }] },
      dueConfig: { offsetDays: Number(dueOffsetDays), time: '18:00' },
      assigneeRule,
      recipientRule: { type: 'assignee' },
      escalationRule: { overdueHours: 24 },
      checklistTemplateId: checklistTemplateId ? Number(checklistTemplateId) : null,
      visibility, sensitive, enabled,
    }
  }

  const previewMutation = useMutation({
    mutationFn: () => api.post('/ops-calendar/rules/preview', buildPayload()).then((r) => r.data.data as RulePreviewVO[]),
    onSuccess: (data) => setPreview(data),
    onError: (e: unknown) => toast.error(errMsg(e, '预览失败')),
  })

  const saveMutation = useMutation({
    mutationFn: () => isEdit
      ? api.put(`/ops-calendar/rules/${rule!.id}`, buildPayload())
      : api.post('/ops-calendar/rules', buildPayload()),
    onSuccess: () => {
      toast.success(isEdit ? '规则已更新' : '规则已创建')
      queryClient.invalidateQueries({ queryKey: ['ops-calendar-rules'] })
      onOpenChange(false)
    },
    onError: (e: unknown) => toast.error(errMsg(e, '保存失败')),
  })

  function save() {
    if (!name.trim()) { toast.error('请填写规则名称'); return }
    saveMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑周期规则' : '新建周期规则'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>规则名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：季报提醒" />
            </div>
            <div className="col-span-2">
              <Label>描述</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>任务类型</Label>
              <Select value={taskType} onValueChange={(v) => setTaskType(v ?? 'inspection')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_TYPE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>触发周期</Label>
              <Select value={triggerType} onValueChange={(v) => setTriggerType(v ?? 'weekly')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* trigger-specific fields */}
            {triggerType === 'weekly' && (
              <div>
                <Label>星期</Label>
                <Select value={weekday} onValueChange={(v) => setWeekday(v ?? 'FRI')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(triggerType === 'monthly' || triggerType === 'yearly') && (
              <div>
                <Label>日期（几号）</Label>
                <Input type="number" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
              </div>
            )}
            {(triggerType === 'quarterly' || triggerType === 'semiannual') && (
              <>
                <div>
                  <Label>锚点</Label>
                  <Select value={quarterPosition} onValueChange={(v) => setQuarterPosition(v ?? 'last_day')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first_day">周期首日</SelectItem>
                      <SelectItem value="last_day">周期末日</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>偏移天数（负=提前）</Label>
                  <Input type="number" value={offsetDays} onChange={(e) => setOffsetDays(e.target.value)} />
                </div>
              </>
            )}
            {triggerType === 'cron' && (
              <div className="col-span-2">
                <Label>Cron 表达式（Spring 6 段）</Label>
                <Input value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} className="font-v2-mono" />
              </div>
            )}
            {triggerType === 'holiday_relative' && (
              <>
                <div>
                  <Label>相对节假日</Label>
                  <Select value={hrRelative} onValueChange={(v) => setHrRelative(v ?? 'before')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">节前</SelectItem>
                      <SelectItem value="after">节后</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>第 N 个工作日</Label>
                  <Input type="number" value={hrOffsetWorkdays} onChange={(e) => setHrOffsetWorkdays(e.target.value)} />
                </div>
              </>
            )}
            {triggerType !== 'cron' && (
              <div>
                <Label>触发时间</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            )}

            <div>
              <Label>提前生成天数</Label>
              <Input type="number" value={generateDaysAhead} onChange={(e) => setGenerateDaysAhead(e.target.value)} />
            </div>
            <div>
              <Label>截止偏移天数</Label>
              <Input type="number" value={dueOffsetDays} onChange={(e) => setDueOffsetDays(e.target.value)} />
            </div>

            <div>
              <Label>负责人规则</Label>
              <Select value={assigneeType} onValueChange={(v) => setAssigneeType(v ?? 'group_leader')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="group_leader">组长</SelectItem>
                  <SelectItem value="fixed">指定用户</SelectItem>
                  <SelectItem value="creator">创建者</SelectItem>
                  <SelectItem value="roster_next_week">排班负责人</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>负责人组 ID（可选）</Label>
              <Input type="number" value={assigneeGroupId} onChange={(e) => setAssigneeGroupId(e.target.value)} placeholder="组级规则填组 ID" />
            </div>
            {assigneeType === 'fixed' && (
              <div>
                <Label>指定用户 ID</Label>
                <Input type="number" value={assigneeUserId} onChange={(e) => setAssigneeUserId(e.target.value)} />
              </div>
            )}

            <div>
              <Label>可见性</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v ?? 'group')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">私有</SelectItem>
                  <SelectItem value="group">本组</SelectItem>
                  <SelectItem value="public">公共</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>SOP 检查项模板（可选）</Label>
              <Select value={checklistTemplateId || 'none'} onValueChange={(v) => setChecklistTemplateId(v === 'none' ? '' : (v ?? ''))}>
                <SelectTrigger><SelectValue placeholder="不绑定" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不绑定</SelectItem>
                  {templates.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-6 pt-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={sensitive} onCheckedChange={setSensitive} />敏感
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={enabled} onCheckedChange={setEnabled} />启用
              </label>
            </div>
          </div>

          {/* preview */}
          <div className="border-t border-v2-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-v2-fg">未来触发预览</span>
              <Button variant="secondary" size="sm" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
                生成预览
              </Button>
            </div>
            {preview.length === 0 ? (
              <p className="text-xs text-v2-muted">点击「生成预览」查看未来触发时间。</p>
            ) : (
              <ul className="space-y-1">
                {preview.map((p, i) => (
                  <li key={i} className="text-xs text-v2-muted flex gap-3">
                    <span className="font-v2-mono text-v2-fg">{fmtTime(p.plannedStartAt)}</span>
                    <span>→ 截止 {fmtTime(p.dueAt)}</span>
                    <span className="truncate">{p.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="primary" onClick={save} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
