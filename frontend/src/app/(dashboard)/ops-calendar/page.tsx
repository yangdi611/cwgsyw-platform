'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { PageHeader, FilterBar, FilterChip } from '@/components/shared'
import { Button } from '@/components/v2/Button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  CalendarMonthView,
} from '@/components/ops-calendar/CalendarMonthView'
import { CalendarWeekView } from '@/components/ops-calendar/CalendarWeekView'
import { CalendarListView } from '@/components/ops-calendar/CalendarListView'
import { DayWorkItemsDialog } from '@/components/ops-calendar/DayWorkItemsDialog'
import { TaskDetailDrawer } from '@/components/ops-calendar/TaskDetailDrawer'
import { TaskFormDialog } from '@/components/ops-calendar/TaskFormDialog'
import {
  type CalendarScope, type CalendarView, type TaskVO, type HolidayVO,
  startOfMonth, endOfMonth, weekDays, ymd, TASK_TYPE_META, STATUS_META,
} from '@/lib/opsCalendar'
import {
  BarChart2, CalendarClock, CalendarOff, ChevronDown, ChevronLeft, ChevronRight,
  FileText, FolderArchive, Plus, Settings2,
} from 'lucide-react'

export default function OpsCalendarPage() {
  return (
    <Suspense fallback={null}>
      <OpsCalendarInner />
    </Suspense>
  )
}

function OpsCalendarInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission } = usePermission()
  const groupScope = useAuthStore((s) => s.groupScope)

  useEffect(() => {
    if (!hasPermission('ops_calendar', 'read')) router.replace('/')
  }, [hasPermission, router])

  const defaultScope: CalendarScope =
    groupScope === 'tenant' || groupScope === 'platform' ? 'all'
      : hasPermission('ops_calendar', 'read_group') ? 'group' : 'mine'

  const [view, setView] = useState<CalendarView>('month')
  const [scope, setScope] = useState<CalendarScope>(defaultScope)
  const [cursor, setCursor] = useState(new Date())
  const [taskType, setTaskType] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  // 从工作台跳转的 query 参数（?taskId / ?date / ?dayDialog）作为初始值惰性读取
  const [selectedDate, setSelectedDate] = useState<string | null>(
    () => (searchParams.get('date') && searchParams.get('dayDialog')) ? searchParams.get('date') : null
  )
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(
    () => { const t = searchParams.get('taskId'); return t ? Number(t) : null }
  )
  const [createOpen, setCreateOpen] = useState(false)

  // Compute query range from view
  const range = useMemo(() => {
    if (view === 'week') {
      const days = weekDays(cursor)
      return { start: ymd(days[0]), end: ymd(days[6]) }
    }
    // month + list: full month grid range (6 weeks) for month, month for list
    const first = startOfMonth(cursor)
    const last = endOfMonth(cursor)
    // include leading/trailing days shown in the 6x7 grid
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - ((first.getDay() + 6) % 7))
    const gridEnd = new Date(gridStart)
    gridEnd.setDate(gridStart.getDate() + 41)
    return { start: ymd(view === 'list' ? first : gridStart), end: ymd(view === 'list' ? last : gridEnd) }
  }, [view, cursor])

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['ops-calendar-tasks', range.start, range.end, scope, taskType, status],
    queryFn: () =>
      api.get('/ops-calendar/tasks', {
        params: {
          startDate: range.start, endDate: range.end, scope,
          taskType: taskType || undefined, status: status || undefined,
        },
      }).then((r) => r.data.data as TaskVO[]),
    enabled: hasPermission('ops_calendar', 'read'),
  })

  // 节假日（用于月历/周历格子红标）
  const { data: holidays = [] } = useQuery({
    queryKey: ['ops-calendar-holidays-mark'],
    queryFn: () => api.get('/ops-calendar/holidays')
      .then((r) => r.data.data as HolidayVO[])
      .catch(() => [] as HolidayVO[]),
    enabled: hasPermission('ops_calendar', 'read'),
  })

  // date(yyyy-MM-dd) -> 节假日名称
  const holidayMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const h of holidays) {
      if (!h.enabled) continue
      const start = new Date(h.startDate + 'T00:00:00')
      const end = new Date(h.endDate + 'T00:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        m.set(ymd(d), h.name)
      }
    }
    return m
  }, [holidays])

  const title = useMemo(() => {
    if (view === 'week') {
      const days = weekDays(cursor)
      return `${ymd(days[0])} ~ ${ymd(days[6])}`
    }
    return `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`
  }, [view, cursor])

  function step(dir: number) {
    const d = new Date(cursor)
    if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setCursor(d)
  }

  const scopeOptions: { value: CalendarScope; label: string }[] = [
    { value: 'mine', label: '我的' },
    ...(hasPermission('ops_calendar', 'read_group') || groupScope !== 'group'
      ? [{ value: 'group' as CalendarScope, label: '本组' }] : []),
    ...(groupScope === 'tenant' || groupScope === 'platform' || hasPermission('ops_calendar', 'read_all')
      ? [{ value: 'all' as CalendarScope, label: '全部' }] : []),
    { value: 'roster', label: '排班' },
    { value: 'public', label: '公共' },
  ]

  const managementItems = [
    ...(hasPermission('ops_calendar', 'manage') ? [
      { label: '周期规则', path: '/ops-calendar/rules', icon: Settings2 },
      { label: '排班管理', path: '/ops-calendar/rosters', icon: CalendarClock },
      { label: '节假日历', path: '/ops-calendar/holidays', icon: CalendarOff },
      { label: '模板管理', path: '/ops-calendar/templates', icon: FileText },
    ] : []),
    ...(hasPermission('ops_calendar', 'manage') && hasPermission('ops_calendar', 'export') ? ['separator' as const] : []),
    ...(hasPermission('ops_calendar', 'export') ? [
      { label: '统计复盘', path: '/ops-calendar/stats', icon: BarChart2 },
      { label: '素材归集', path: '/ops-calendar/materials', icon: FolderArchive },
    ] : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="运维运营"
        title="运维日历"
        subtitle="统一管理周期巡检、排班值守、报表归集与合规核查的计划与执行闭环。"
        actions={
          <div className="flex items-center gap-2">
            {managementItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-10 items-center justify-center gap-1.5 rounded-v2-md border border-v2-border bg-v2-surface px-4 text-sm font-semibold text-v2-fg shadow-v2-sm transition-all hover:border-v2-border-strong hover:bg-v2-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary/40">
                  <Settings2 className="h-4 w-4" />
                  管理
                  <ChevronDown className="h-4 w-4 text-v2-muted" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>运维日历</DropdownMenuLabel>
                  </DropdownMenuGroup>
                  {managementItems.map((item, index) => {
                    if (item === 'separator') return <DropdownMenuSeparator key={`separator-${index}`} />
                    const Icon = item.icon
                    return (
                      <DropdownMenuItem key={item.path} onClick={() => router.push(item.path)} className="gap-2">
                        <Icon className="h-4 w-4 text-v2-muted" />
                        {item.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {hasPermission('ops_calendar', 'create') && (
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />新建任务
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>今天</Button>
          <Button variant="ghost" size="sm" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
          <span className="text-base font-semibold text-v2-fg ml-1">{title}</span>
        </div>
        <FilterBar>
          <FilterChip active={view === 'month'} onClick={() => setView('month')}>月</FilterChip>
          <FilterChip active={view === 'week'} onClick={() => setView('week')}>周</FilterChip>
          <FilterChip active={view === 'list'} onClick={() => setView('list')}>列表</FilterChip>
        </FilterBar>
      </div>

      <FilterBar>
        {scopeOptions.map((o) => (
          <FilterChip key={o.value} active={scope === o.value} onClick={() => setScope(o.value)}>{o.label}</FilterChip>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Select value={taskType || 'all'} onValueChange={(v) => setTaskType(v === 'all' ? '' : v ?? '')}>
            <SelectTrigger className="w-32"><SelectValue placeholder="类型" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {Object.entries(TASK_TYPE_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v ?? '')}>
            <SelectTrigger className="w-32"><SelectValue placeholder="状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {view === 'month' && (
        <CalendarMonthView
          currentDate={cursor} tasks={tasks} holidayMap={holidayMap}
          onDateClick={(d) => setSelectedDate(d)}
          onTaskClick={(id) => setSelectedTaskId(id)}
        />
      )}
      {view === 'week' && (
        <CalendarWeekView
          currentDate={cursor} tasks={tasks} holidayMap={holidayMap}
          onDateClick={(d) => setSelectedDate(d)}
          onTaskClick={(id) => setSelectedTaskId(id)}
        />
      )}
      {view === 'list' && (
        <CalendarListView tasks={tasks} loading={isLoading} onTaskClick={(id) => setSelectedTaskId(id)} />
      )}

      <DayWorkItemsDialog
        date={selectedDate} scope={scope}
        open={!!selectedDate}
        onOpenChange={(o) => { if (!o) setSelectedDate(null) }}
        onTaskClick={(id) => setSelectedTaskId(id)}
      />

      <TaskDetailDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />

      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
