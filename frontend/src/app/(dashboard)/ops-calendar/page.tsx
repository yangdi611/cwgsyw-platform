'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, CalendarOff, ChevronDown, ChevronLeft, ChevronRight, Plus, Settings2 } from 'lucide-react'
import { PageHeader, FilterBar, FilterChip } from '@/components/shared'
import { Button } from '@/components/v2/Button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CalendarMonthView } from '@/components/ops-calendar/CalendarMonthView'
import { CalendarWeekView } from '@/components/ops-calendar/CalendarWeekView'
import { CalendarListView } from '@/components/ops-calendar/CalendarListView'
import { DayWorkItemsDialog } from '@/components/ops-calendar/DayWorkItemsDialog'
import { OneOffTaskDialog } from '@/components/task-runtime/OneOffTaskDialog'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { listDirectoryGroups, listDirectoryUsers, listPublishedTemplates } from '@/lib/task-plan-api'
import {
  type CalendarScope,
  type CalendarView,
  type CalendarWorkItem,
  listCalendarWorkItems,
} from '@/lib/calendar-api'
import { endOfMonth, startOfMonth, weekDays, ymd } from '@/lib/opsCalendar'

type CalendarLayer = 'all' | 'tasks' | 'rosters' | 'holidays'
const EMPTY_ITEMS: CalendarWorkItem[] = []

const STATUS_LABELS: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  submitted: '已提交',
  changes_requested: '待修改',
  completed: '已完成',
  cancelled: '已取消',
  exception_closed: '异常关闭',
}

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
  const groupScope = useAuthStore((state) => state.groupScope)

  useEffect(() => {
    if (!hasPermission('task', 'read')) router.replace('/')
  }, [hasPermission, router])

  const defaultScope: CalendarScope = groupScope === 'tenant' || groupScope === 'platform' ? 'all' : 'my'
  const [view, setView] = useState<CalendarView>(() => {
    if (typeof window === 'undefined') return 'month'
    const saved = window.localStorage.getItem('ops-calendar-view')
    return saved === 'week' || saved === 'list' ? saved : 'month'
  })
  const [scope, setScope] = useState<CalendarScope>(defaultScope)
  const [cursor, setCursor] = useState(new Date())
  const [layer, setLayer] = useState<CalendarLayer>('all')
  const [status, setStatus] = useState('')
  const [templateId, setTemplateId] = useState('all')
  const [assigneeId, setAssigneeId] = useState('all')
  const [groupId, setGroupId] = useState('all')
  const [selectedDate, setSelectedDate] = useState<string | null>(
    () => searchParams.get('date') && searchParams.get('dayDialog') ? searchParams.get('date') : null,
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [createDate, setCreateDate] = useState<string | undefined>()

  useEffect(() => {
    window.localStorage.setItem('ops-calendar-view', view)
  }, [view])

  useEffect(() => {
    const taskId = searchParams.get('taskId')
    if (taskId) router.replace(`/tasks/${taskId}`)
  }, [router, searchParams])

  const range = useMemo(() => {
    if (view === 'week') {
      const days = weekDays(cursor)
      return { start: ymd(days[0]), end: ymd(days[6]) }
    }
    const first = startOfMonth(cursor)
    const last = endOfMonth(cursor)
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - ((first.getDay() + 6) % 7))
    const gridEnd = new Date(gridStart)
    gridEnd.setDate(gridStart.getDate() + 41)
    return { start: ymd(view === 'list' ? first : gridStart), end: ymd(view === 'list' ? last : gridEnd) }
  }, [view, cursor])

  const include = layer === 'all' ? 'tasks,rosters,holidays' : layer
  const templates = useQuery({
    queryKey: ['calendar-template-options'],
    queryFn: listPublishedTemplates,
    enabled: hasPermission('task', 'read'),
  })
  const users = useQuery({
    queryKey: ['calendar-user-options'],
    queryFn: listDirectoryUsers,
    enabled: hasPermission('user', 'read'),
  })
  const groups = useQuery({
    queryKey: ['calendar-group-options'],
    queryFn: listDirectoryGroups,
    enabled: hasPermission('group', 'read'),
  })
  const itemFilters = {
    templateId: templateId === 'all' ? undefined : Number(templateId),
    executionStatus: status || undefined,
    assigneeId: assigneeId === 'all' ? undefined : Number(assigneeId),
    groupId: groupId === 'all' ? undefined : Number(groupId),
  }
  const workItems = useQuery({
    queryKey: ['calendar-work-items', { range, view, scope, include, ...itemFilters }],
    queryFn: () => listCalendarWorkItems({
      from: range.start,
      to: range.end,
      view,
      scope,
      ...itemFilters,
      include,
    }),
    enabled: hasPermission('task', 'read'),
  })
  const items = workItems.data ?? EMPTY_ITEMS

  const holidayMap = useMemo(() => {
    const result = new Map<string, string>()
    for (const item of items.filter((value) => value.itemType === 'holiday')) {
      const start = new Date(item.startAt)
      const end = new Date(item.endAt)
      end.setDate(end.getDate() - 1)
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        result.set(ymd(date), item.title)
      }
    }
    return result
  }, [items])

  const periodTitle = useMemo(() => {
    if (view === 'week') {
      const days = weekDays(cursor)
      return `${ymd(days[0])} ~ ${ymd(days[6])}`
    }
    return `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`
  }, [view, cursor])

  const scopeOptions: Array<{ value: CalendarScope; label: string }> = [
    { value: 'my', label: '我的' },
    { value: 'group', label: '本组' },
    ...(groupScope === 'tenant' || groupScope === 'platform' ? [{ value: 'all' as const, label: '全部' }] : []),
  ]
  const settings = hasPermission('calendar_settings', 'read') ? [
    { label: '排班管理', path: '/ops-calendar/rosters', icon: CalendarClock },
    { label: '节假日历', path: '/ops-calendar/holidays', icon: CalendarOff },
  ] : []

  function step(direction: number) {
    const date = new Date(cursor)
    if (view === 'week') date.setDate(date.getDate() + direction * 7)
    else date.setMonth(date.getMonth() + direction)
    setCursor(date)
  }

  function openCreate(date?: string) {
    setCreateDate(date)
    setCreateOpen(true)
  }

  function openItem(item: CalendarWorkItem) {
    router.push(item.href)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="运维运营"
        title="运维日历"
        subtitle="按时间查看统一任务、排班与节假日，复杂执行和审批进入任务详情完成。"
        className="flex-col gap-4 sm:flex-row sm:items-start sm:gap-6"
        actions={
          <div className="flex items-center gap-2">
            {settings.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-10 items-center justify-center gap-1.5 rounded-v2-md border border-v2-border bg-v2-surface px-4 text-sm font-semibold text-v2-fg shadow-v2-sm transition-all hover:border-v2-border-strong hover:bg-v2-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary/40">
                  <Settings2 className="h-4 w-4" />设置<ChevronDown className="h-4 w-4 text-v2-muted" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuGroup><DropdownMenuLabel>日历设置</DropdownMenuLabel></DropdownMenuGroup>
                  {settings.map((item) => {
                    const Icon = item.icon
                    return <DropdownMenuItem key={item.path} onClick={() => router.push(item.path)} className="gap-2"><Icon className="h-4 w-4 text-v2-muted" />{item.label}</DropdownMenuItem>
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {hasPermission('task', 'create') && <Button variant="primary" onClick={() => openCreate()}><Plus className="h-4 w-4" />新建任务</Button>}
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>今天</Button>
          <Button variant="ghost" size="sm" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
          <span className="ml-1 text-base font-semibold text-v2-fg">{periodTitle}</span>
        </div>
        <FilterBar>
          <FilterChip active={view === 'month'} onClick={() => setView('month')}>月</FilterChip>
          <FilterChip active={view === 'week'} onClick={() => setView('week')}>周</FilterChip>
          <FilterChip active={view === 'list'} onClick={() => setView('list')}>列表</FilterChip>
        </FilterBar>
      </div>

      <FilterBar>
        {scopeOptions.map((option) => <FilterChip key={option.value} active={scope === option.value} onClick={() => setScope(option.value)}>{option.label}</FilterChip>)}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={templateId} onValueChange={(value) => setTemplateId(value ?? 'all')}>
            <SelectTrigger className="w-44"><SelectValue placeholder="任务模板" /></SelectTrigger>
            <SelectContent><SelectItem value="all">全部模板</SelectItem>{templates.data?.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>)}</SelectContent>
          </Select>
          {hasPermission('user', 'read') && (
            <Select value={assigneeId} onValueChange={(value) => setAssigneeId(value ?? 'all')}>
              <SelectTrigger className="w-40"><SelectValue placeholder="负责人" /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部人员</SelectItem>{users.data?.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.realName || user.username}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {hasPermission('group', 'read') && (
            <Select value={groupId} onValueChange={(value) => setGroupId(value ?? 'all')}>
              <SelectTrigger className="w-40"><SelectValue placeholder="所属组" /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部组</SelectItem>{groups.data?.map((group) => <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={layer} onValueChange={(value) => setLayer((value ?? 'all') as CalendarLayer)}>
            <SelectTrigger className="w-32"><SelectValue placeholder="显示内容" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部内容</SelectItem>
              <SelectItem value="tasks">任务</SelectItem>
              <SelectItem value="rosters">排班</SelectItem>
              <SelectItem value="holidays">节假日</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status || 'all'} onValueChange={(value) => setStatus(value === 'all' ? '' : value ?? '')}>
            <SelectTrigger className="w-32"><SelectValue placeholder="状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {view === 'month' && <CalendarMonthView currentDate={cursor} items={items} holidayMap={holidayMap} onDateClick={setSelectedDate} onItemClick={openItem} />}
      {view === 'week' && <CalendarWeekView currentDate={cursor} items={items} holidayMap={holidayMap} onDateClick={setSelectedDate} onItemClick={openItem} />}
      {view === 'list' && <CalendarListView items={items} loading={workItems.isLoading} onItemClick={openItem} />}

      <DayWorkItemsDialog
        date={selectedDate}
        scope={scope}
        include={include}
        filters={itemFilters}
        open={Boolean(selectedDate)}
        onOpenChange={(open) => { if (!open) setSelectedDate(null) }}
        onItemClick={openItem}
        onCreate={hasPermission('task', 'create') ? (date) => { setSelectedDate(null); openCreate(date) } : undefined}
      />
      {createOpen && <OneOffTaskDialog open={createOpen} onOpenChange={setCreateOpen} initialDate={createDate} />}
    </div>
  )
}
