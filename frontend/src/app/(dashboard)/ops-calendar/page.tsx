'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
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
  Breadcrumb,
  Button,
  Chip,
  DataManagementPage,
  DropdownMenu,
  MenuItem,
  FilterBar,
  LoadingState,
  PageHeader,
  Select,
} from '@/design-system/figma-neutral/components'

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
    <Suspense fallback={<LoadingState label="正在加载运维日历…" />}>
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
  const settings = hasPermission('calendar_settings', 'read')
    ? [
        { label: '排班管理', path: '/ops-calendar/rosters' },
        { label: '节假日历', path: '/ops-calendar/holidays' },
      ]
    : []

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
    <>
      <DataManagementPage
        embedded
        header={
          <PageHeader
            eyebrow="运维运营"
            title="运维日历"
            subtitle="按时间查看统一任务、排班与节假日，复杂执行和审批进入任务详情完成。"
            breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: '运维日历' }]} />}
            actions={
              <div className="cwgsyw-inline-controls">
                {settings.length > 0 ? (
                  <DropdownMenu trigger={<Button type="button" variant="secondary">设置</Button>}>
                    {settings.map((item) => (
                      <MenuItem key={item.path} label={item.label} onClick={() => router.push(item.path)} />
                    ))}
                  </DropdownMenu>
                ) : null}
                {hasPermission('task', 'create') ? (
                  <Button type="button" variant="primary" onClick={() => openCreate()}>
                    新建任务
                  </Button>
                ) : null}
              </div>
            }
          />
        }
        filter={
          <div className="cwgsyw-form">
            <div className="cwgsyw-inline-controls">
              <Button type="button" variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
                今天
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => step(-1)}>
                上一期
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => step(1)}>
                下一期
              </Button>
              <span className="cwgsyw-type-title-sm">{periodTitle}</span>
            </div>
            <FilterBar
              filterItems={
                <div className="cwgsyw-inline-controls">
                  <Chip label="月" selected={view === 'month'} onClick={() => setView('month')} />
                  <Chip label="周" selected={view === 'week'} onClick={() => setView('week')} />
                  <Chip label="列表" selected={view === 'list'} onClick={() => setView('list')} />
                  {scopeOptions.map((option) => (
                    <Chip key={option.value} label={option.label} selected={scope === option.value} onClick={() => setScope(option.value)} />
                  ))}
                </div>
              }
              actions={
                <div className="cwgsyw-inline-controls">
                  <Select
                    value={templateId}
                    options={[{ value: 'all', label: '全部模板' }, ...(templates.data ?? []).map((template) => ({ value: String(template.id), label: template.name }))]}
                    onChange={setTemplateId}
                  />
                  {hasPermission('user', 'read') ? (
                    <Select
                      value={assigneeId}
                      options={[{ value: 'all', label: '全部人员' }, ...(users.data ?? []).map((user) => ({ value: String(user.id), label: user.realName || user.username }))]}
                      onChange={setAssigneeId}
                    />
                  ) : null}
                  {hasPermission('group', 'read') ? (
                    <Select
                      value={groupId}
                      options={[{ value: 'all', label: '全部组' }, ...(groups.data ?? []).map((group) => ({ value: String(group.id), label: group.name }))]}
                      onChange={setGroupId}
                    />
                  ) : null}
                  <Select
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
                    value={status || 'all'}
                    options={[{ value: 'all', label: '全部状态' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
                    onChange={(value) => setStatus(value === 'all' ? '' : value)}
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
