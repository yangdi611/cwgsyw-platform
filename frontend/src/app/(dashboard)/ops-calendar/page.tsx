'use client'

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
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
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DataManagementPage,
  DropdownMenu,
  MenuItem,
  FilterBar,
  LoadingState,
  NeutralTooltip,
  PageHeader,
  Select,
  Tabs,
} from '@/design-system/figma-neutral/components'

type CalendarLayer = 'all' | 'tasks' | 'rosters' | 'holidays'
const EMPTY_ITEMS: CalendarWorkItem[] = []
const PERIOD_DIGIT_PX = 16

function shiftCalendarCursor(cursor: Date, view: CalendarView, direction: number) {
  const date = new Date(cursor)
  if (view === 'week') date.setDate(date.getDate() + direction * 7)
  else date.setMonth(date.getMonth() + direction)
  return date
}

function calendarRangeFor(view: CalendarView, cursor: Date) {
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
}

function adjacentMonth(month: number, delta: number) {
  return ((month - 1 + delta + 12) % 12) + 1
}

function monthStep(from: number, to: number) {
  if (from === 12 && to === 1) return 1
  if (from === 1 && to === 12) return -1
  return to - from
}

function PeriodMonthReel({ month }: { month: number }) {
  const restOffset = -PERIOD_DIGIT_PX
  const monthRef = useRef(month)
  const [reel, setReel] = useState(() => [adjacentMonth(month, -1), month, adjacentMonth(month, 1)])
  const [offset, setOffset] = useState(restOffset)
  const [animate, setAnimate] = useState(false)

  useLayoutEffect(() => {
    if (monthRef.current === month) return
    const step = monthStep(monthRef.current, month)
    if (step !== 1 && step !== -1) {
      monthRef.current = month
      setAnimate(false)
      setOffset(restOffset)
      setReel([adjacentMonth(month, -1), month, adjacentMonth(month, 1)])
      return
    }
    setAnimate(true)
    setOffset(restOffset + step * -PERIOD_DIGIT_PX)
    const timer = window.setTimeout(() => {
      monthRef.current = month
      setAnimate(false)
      setOffset(restOffset)
      setReel([adjacentMonth(month, -1), month, adjacentMonth(month, 1)])
    }, 220)
    return () => window.clearTimeout(timer)
  }, [month, restOffset])

  return (
    <span className="cwgsyw-ops__period-digit">
      <span
        className="cwgsyw-ops__period-digit-reel"
        style={{
          transform: `translate3d(0, ${offset}px, 0)`,
          transition: animate ? 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        }}
      >
        {reel.map((value, index) => (
          <span key={`${index}-${value}`} className="cwgsyw-ops__period-digit-value">
            {value}
          </span>
        ))}
      </span>
    </span>
  )
}


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
    <Suspense fallback={<LoadingState label="正在加载运维日历…" />}>
      <OpsCalendarInner />
    </Suspense>
  )
}

function OpsCalendarInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
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
    () => (searchParams.get('date') && searchParams.get('dayDialog') ? searchParams.get('date') : null),
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

  const range = useMemo(() => calendarRangeFor(view, cursor), [view, cursor])

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
    queryFn: () =>
      listCalendarWorkItems({
        from: range.start,
        to: range.end,
        view,
        scope,
        ...itemFilters,
        include,
      }),
    enabled: hasPermission('task', 'read'),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (!hasPermission('task', 'read')) return
    for (const direction of [-1, 1] as const) {
      const adjacentRange = calendarRangeFor(view, shiftCalendarCursor(cursor, view, direction))
      void queryClient.prefetchQuery({
        queryKey: ['calendar-work-items', { range: adjacentRange, view, scope, include, ...itemFilters }],
        queryFn: () =>
          listCalendarWorkItems({
            from: adjacentRange.start,
            to: adjacentRange.end,
            view,
            scope,
            ...itemFilters,
            include,
          }),
      })
    }
  }, [assigneeId, cursor, groupId, hasPermission, include, queryClient, scope, status, templateId, view])
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
  const settings = hasPermission('calendar_settings', 'read')
    ? [
        { label: '排班管理', path: '/ops-calendar/rosters' },
        { label: '节假日历', path: '/ops-calendar/holidays' },
      ]
    : []

  function step(direction: number) {
    setCursor(shiftCalendarCursor(cursor, view, direction))
  }

  function goToday() {
    setCursor(new Date())
  }

  function openCreate(date?: string) {
    setCreateDate(date)
    setCreateOpen(true)
  }

  function openItem(item: CalendarWorkItem) {
    router.push(item.href)
  }

  return (
    <>
      <DataManagementPage
        className="cwgsyw-ops"
        embedded
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="运维日历"
            subtitle="按时间查看统一任务、排班与节假日。"
            actions={
              <div className="cwgsyw-ops__actions">
                {settings.length > 0 ? (
                  <DropdownMenu trigger={<Button type="button" size="sm" variant="secondary">设置</Button>}>
                    {settings.map((item) => (
                      <MenuItem key={item.path} label={item.label} onClick={() => router.push(item.path)} />
                    ))}
                  </DropdownMenu>
                ) : null}
                {hasPermission('task', 'create') ? (
                  <Button type="button" size="sm" variant="primary" onClick={() => openCreate()}>
                    新建任务
                  </Button>
                ) : null}
              </div>
            }
          />
        }
        filter={
          <div className="cwgsyw-ops__toolbar">
            <div className="cwgsyw-ops__period">
              <div className="cwgsyw-ops__period-nav">
                <NeutralTooltip content="上一期" className="cwgsyw-tooltip--pill" followCursor>
                  <button type="button" className="cwgsyw-ops__icon-btn" aria-label="上一期" onClick={() => step(-1)}>
                    <span aria-hidden="true" className="cwgsyw-ops__icon cwgsyw-ops__icon--prev" data-figma-node="6:23381" />
                  </button>
                </NeutralTooltip>
                <NeutralTooltip content="回到本月" className="cwgsyw-tooltip--pill" followCursor>
                  <button
                    type="button"
                    className="cwgsyw-ops__period-frame"
                    aria-live="polite"
                    aria-label="回到本月"
                    onClick={goToday}
                  >
                    {view === 'week' ? (
                      <span className="cwgsyw-ops__period-title">{periodTitle}</span>
                    ) : (
                      <span className="cwgsyw-ops__period-title">
                        {cursor.getFullYear()} 年
                        <PeriodMonthReel month={cursor.getMonth() + 1} />
                        月
                      </span>
                    )}
                  </button>
                </NeutralTooltip>
                <NeutralTooltip content="下一期" className="cwgsyw-tooltip--pill" followCursor>
                  <button type="button" className="cwgsyw-ops__icon-btn" aria-label="下一期" onClick={() => step(1)}>
                    <span aria-hidden="true" className="cwgsyw-ops__icon cwgsyw-ops__icon--next" data-figma-node="6:23403" />
                  </button>
                </NeutralTooltip>
              </div>
            </div>
            <FilterBar
              filterItems={
                <div className="cwgsyw-ops__filters">
                  <Select
                    overlay
                    size="sm"
                    aria-label="模板"
                    value={templateId}
                    options={[{ value: 'all', label: '全部模板' }, ...(templates.data ?? []).map((template) => ({ value: String(template.id), label: template.name }))]}
                    onChange={setTemplateId}
                  />
                  {hasPermission('user', 'read') ? (
                    <Select
                      overlay
                      size="sm"
                      aria-label="人员"
                      value={assigneeId}
                      options={[{ value: 'all', label: '全部人员' }, ...(users.data ?? []).map((user) => ({ value: String(user.id), label: user.realName || user.username }))]}
                      onChange={setAssigneeId}
                    />
                  ) : null}
                  {hasPermission('group', 'read') ? (
                    <Select
                      overlay
                      size="sm"
                      aria-label="组"
                      value={groupId}
                      options={[{ value: 'all', label: '全部组' }, ...(groups.data ?? []).map((group) => ({ value: String(group.id), label: group.name }))]}
                      onChange={setGroupId}
                    />
                  ) : null}
                  <Select
                    overlay
                    size="sm"
                    aria-label="内容层"
                    value={layer}
                    options={[
                      { value: 'all', label: '全部内容' },
                      { value: 'tasks', label: '任务' },
                      { value: 'rosters', label: '排班' },
                      { value: 'holidays', label: '节假日' },
                    ]}
                    onChange={(value) => setLayer(value as CalendarLayer)}
                  />
                  <Select
                    overlay
                    size="sm"
                    aria-label="状态"
                    value={status || 'all'}
                    options={[{ value: 'all', label: '全部状态' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
                    onChange={(value) => setStatus(value === 'all' ? '' : value)}
                  />
                </div>
              }
              actions={
                <div className="cwgsyw-ops__tabs">
                  <Tabs
                    style="cmdb"
                    size="sm"
                    value={view}
                    onChange={(id) => setView(id as CalendarView)}
                    items={[
                      { id: 'month', label: '月', panel: null },
                      { id: 'week', label: '周', panel: null },
                      { id: 'list', label: '列表', panel: null },
                    ]}
                  />
                  <Tabs
                    style="cmdb"
                    size="sm"
                    value={scope}
                    onChange={(id) => setScope(id as CalendarScope)}
                    items={scopeOptions.map((option) => ({ id: option.value, label: option.label, panel: null }))}
                  />
                </div>
              }
            />
          </div>
        }
        content={
          <>
            {view === 'month' ? (
              <CalendarMonthView currentDate={cursor} items={items} holidayMap={holidayMap} onDateClick={setSelectedDate} onItemClick={openItem} />
            ) : null}
            {view === 'week' ? (
              <CalendarWeekView currentDate={cursor} items={items} holidayMap={holidayMap} onDateClick={setSelectedDate} onItemClick={openItem} />
            ) : null}
            {view === 'list' ? <CalendarListView items={items} loading={workItems.isLoading} onItemClick={openItem} /> : null}
          </>
        }
      />

      <DayWorkItemsDialog
        date={selectedDate}
        scope={scope}
        include={include}
        filters={itemFilters}
        open={Boolean(selectedDate)}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null)
        }}
        onItemClick={openItem}
        onCreate={
          hasPermission('task', 'create')
            ? (date) => {
                setSelectedDate(null)
                openCreate(date)
              }
            : undefined
        }
      />
      {createOpen ? <OneOffTaskDialog open={createOpen} onOpenChange={setCreateOpen} initialDate={createDate} /> : null}
    </>
  )
}
