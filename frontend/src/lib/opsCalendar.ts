// 运维日历共享类型与工具函数（无第三方日期库，使用原生 Date）

export type CalendarView = 'month' | 'week' | 'list'
export type CalendarScope = 'mine' | 'group' | 'all' | 'roster' | 'public'

export interface TaskVO {
  id: number
  ruleId: number | null
  title: string
  taskType: string
  status: string
  plannedStartAt: string | null
  dueAt: string | null
  assigneeId: number | null
  assigneeName: string | null
  assigneePhone: string | null
  groupId: number | null
  groupName: string | null
  priority: string
  sourceType: string
  visibility: string
  publicSummary: string | null
  sensitive: boolean
  resultStatus: string | null
  riskLevel: string | null
  completedAt: string | null
  canViewDetail: boolean
  canOperate: boolean
}

export interface DayGroup {
  key: string
  label: string
  tasks: TaskVO[]
}

export interface DayTasksVO {
  date: string
  dayOfWeek: string
  holidayName: string | null
  summary: { total: number; pending: number; overdue: number; completed: number }
  groups: DayGroup[]
}

export interface ParticipantVO { userId: number; userName: string | null; role: string }
export interface ChecklistItemVO {
  id: number; title: string; required: boolean; inputType: string
  options: string | null; value: string | null; checked: boolean; sortOrder: number
}
export interface TaskLinkVO { id: number; linkType: string; linkId: number | null; linkTitle: string | null; linkUrl: string | null }
export interface TaskLogVO { id: number; action: string; operatorId: number | null; operatorName: string | null; content: string | null; createdAt: string }

export interface TaskDetailVO {
  task: TaskVO
  content: string | null
  resultSummary: string | null
  closeReason: string | null
  confirmedAt: string | null
  confirmedByName: string | null
  startedAt: string | null
  completedByName: string | null
  participants: ParticipantVO[]
  checklist: ChecklistItemVO[]
  links: TaskLinkVO[]
  logs: TaskLogVO[]
  canConfirm: boolean
  canStart: boolean
  canComplete: boolean
  canCancel: boolean
  canCloseException: boolean
  canEdit: boolean
}

export interface DashboardCalendarVO {
  todayTotal: number
  pendingConfirm: number
  overdue: number
  items: { id: number; title: string; taskType: string; status: string; dueAt: string | null; assigneeName: string | null }[]
  nextHints: { date: string | null; title: string; taskType: string }[]
}

export interface RuleVO {
  id: number
  name: string
  description: string | null
  taskType: string
  enabled: boolean
  triggerType: string
  triggerConfig: Record<string, unknown>
  generateDaysAhead: number
  reminderConfig: Record<string, unknown>
  dueConfig: Record<string, unknown>
  assigneeRule: Record<string, unknown>
  recipientRule: Record<string, unknown>
  escalationRule: Record<string, unknown>
  visibility: string
  sensitive: boolean
  nextGenerateAt: string | null
  lastGeneratedAt: string | null
  createdAt: string | null
}

export interface RulePreviewVO { plannedStartAt: string; dueAt: string; title: string; occurrenceKey: string }

export interface RosterVO {
  id: number
  dutyDate: string
  startAt: string | null
  endAt: string | null
  shiftName: string
  assigneeId: number | null
  assigneeName: string | null
  assigneePhone: string | null
  backupAssigneeId: number | null
  backupAssigneeName: string | null
  phoneOverride: string | null
  groupId: number | null
  groupName: string | null
  remark: string | null
}

export interface HolidayVO {
  id: number
  name: string
  startDate: string
  endDate: string
  holidayType: string
  workdayOverrides: string
  enabled: boolean
  remark: string | null
}

// ---------- 任务类型/状态展示元数据 ----------

export const TASK_TYPE_META: Record<string, { label: string; color: string }> = {
  inspection:   { label: '巡检', color: '#3b82f6' },
  roster:       { label: '排班', color: '#06b6d4' },
  report:       { label: '报表', color: '#8b5cf6' },
  compliance:   { label: '合规', color: '#f59e0b' },
  monitoring:   { label: '监控', color: '#ef4444' },
  daily_report: { label: '日报', color: '#22c55e' },
  other:        { label: '其他', color: '#94a3b8' },
}

export const STATUS_META: Record<string, { label: string; tone: 'ok' | 'warn' | 'danger' | 'neutral' }> = {
  pending_confirm:  { label: '待确认', tone: 'warn' },
  not_started:      { label: '未开始', tone: 'neutral' },
  in_progress:      { label: '进行中', tone: 'ok' },
  completed:        { label: '已完成', tone: 'ok' },
  overdue:          { label: '已逾期', tone: 'danger' },
  exception_closed: { label: '异常关闭', tone: 'danger' },
  cancelled:        { label: '已取消', tone: 'neutral' },
}

export function taskTypeLabel(t: string): string { return TASK_TYPE_META[t]?.label ?? t }
export function taskTypeColor(t: string): string { return TASK_TYPE_META[t]?.color ?? '#94a3b8' }
export function statusLabel(s: string): string { return STATUS_META[s]?.label ?? s }
export function statusTone(s: string): 'ok' | 'warn' | 'danger' | 'neutral' { return STATUS_META[s]?.tone ?? 'neutral' }

// ---------- 原生 Date 工具 ----------

export function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
export function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }

/** 月历网格：返回 6×7=42 个日期，从当月 1 号所在周的周一开始。 */
export function monthGrid(d: Date): Date[] {
  const first = startOfMonth(d)
  // 周一为一周起点：JS getDay() 周日=0
  const offset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - offset)
  const out: Date[] = []
  for (let i = 0; i < 42; i++) {
    const cur = new Date(start)
    cur.setDate(start.getDate() + i)
    out.push(cur)
  }
  return out
}

/** 一周的 7 天（周一起点）。 */
export function weekDays(d: Date): Date[] {
  const offset = (d.getDay() + 6) % 7
  const start = new Date(d)
  start.setDate(d.getDate() - offset)
  const out: Date[] = []
  for (let i = 0; i < 7; i++) {
    const cur = new Date(start)
    cur.setDate(start.getDate() + i)
    out.push(cur)
  }
  return out
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function isToday(d: Date): boolean { return isSameDay(d, new Date()) }

/** ISO datetime（无 TZ）-> 仅取日期部分用于落格。 */
export function taskDateKey(t: TaskVO): string | null {
  const src = t.plannedStartAt ?? t.dueAt
  return src ? src.slice(0, 10) : null
}

export function fmtTime(iso: string | null): string {
  if (!iso) return '-'
  // iso: 2026-07-01T09:00:00
  return iso.slice(0, 16).replace('T', ' ')
}

export const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

/** 从 axios/未知异常中提取后端错误消息，避免在 catch 中用 any。 */
export function errMsg(e: unknown, fallback = '操作失败'): string {
  const resp = (e as { response?: { data?: { message?: string } } })?.response
  return resp?.data?.message ?? fallback
}
