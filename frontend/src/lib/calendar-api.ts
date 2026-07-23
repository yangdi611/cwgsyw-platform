import api from '@/lib/api'

export type CalendarView = 'month' | 'week' | 'list'
export type CalendarScope = 'my' | 'group' | 'all'
export type CalendarItemType = 'task' | 'roster' | 'holiday'

export interface CalendarWorkItem {
  itemType: CalendarItemType
  id: string
  title: string
  startAt: string
  endAt: string
  status: string
  overdue: boolean
  href: string
  meta: Record<string, unknown>
}

export interface CalendarSummary {
  total: number
  pending: number
  overdue: number
  completed: number
}

export interface CalendarDay {
  date: string
  summary: CalendarSummary
  items: CalendarWorkItem[]
}

export interface CalendarWorkItemFilters {
  from: string
  to: string
  view: CalendarView
  scope: CalendarScope
  templateId?: number
  executionStatus?: string
  approvalStatus?: string
  assigneeId?: number
  groupId?: number
  include: string
}

export type CalendarDayFilters = Omit<CalendarWorkItemFilters, 'from' | 'to' | 'view'>

export async function listCalendarWorkItems(filters: CalendarWorkItemFilters) {
  return api.get('/calendar/work-items', { params: filters })
    .then((response) => response.data.data as CalendarWorkItem[])
}

export async function getCalendarDay(date: string, filters: CalendarDayFilters) {
  return api.get('/calendar/day', { params: { date, ...filters } })
    .then((response) => response.data.data as CalendarDay)
}

export function calendarItemDate(item: CalendarWorkItem) {
  return item.startAt.slice(0, 10)
}

export function calendarItemColor(item: CalendarWorkItem) {
  if (item.itemType === 'holiday') return '#dc2626'
  if (item.itemType === 'roster') return '#0891b2'
  if (item.meta.templateCode === 'daily_work_report') return '#16a34a'
  return '#2563eb'
}

export function calendarItemTypeLabel(type: CalendarItemType) {
  return { task: '任务', roster: '排班', holiday: '节假日' }[type]
}

export function calendarStatusLabel(status: string) {
  return {
    not_started: '未开始',
    in_progress: '进行中',
    submitted: '已提交',
    changes_requested: '待修改',
    completed: '已完成',
    cancelled: '已取消',
    exception_closed: '异常关闭',
    scheduled: '已排班',
    active: '有效',
  }[status] ?? status
}

export function calendarMetaText(item: CalendarWorkItem, key: string) {
  const value = item.meta[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}
