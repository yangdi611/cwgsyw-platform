'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  type CalendarDashboardVO,
  calendarItemTypeLabel,
  calendarMetaText,
  fmtTime,
  statusLabel,
  statusTone,
} from '@/lib/opsCalendar'
import { usePermission } from '@/hooks/usePermission'
import { Button, EmptyState, ErrorState, LoadingState, MetricCard, StatusBadge, Table } from '@/design-system/figma-neutral/components'

const EMPTY_CALENDAR_ICON = '/figma-icons/home-calendar.svg'

function toNeutralTone(tone: 'ok' | 'warn' | 'danger' | 'neutral'): 'success' | 'warning' | 'danger' | 'neutral' {
  if (tone === 'ok') return 'success'
  if (tone === 'warn') return 'warning'
  return tone
}

export function DashboardOpsCalendarCard() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const canReadCalendar = hasPermission('task', 'read')
  const query = useQuery<CalendarDashboardVO>({
    queryKey: ['calendar-dashboard'],
    queryFn: () => api.get('/calendar/dashboard').then((response) => response.data.data as CalendarDashboardVO),
    enabled: isHydrated && canReadCalendar,
  })

  if (!canReadCalendar) return null
  const items = query.data?.items ?? []
  const featuredTask = query.data?.featuredTask

  return (
    <section className="cwgsyw-home__panel cwgsyw-home-calendar" aria-labelledby="home-calendar-title">
      <header>
        <h2 id="home-calendar-title">运维日历</h2>
        <Button type="button" size="sm" variant="secondary" onClick={() => router.push('/ops-calendar')}>
          查看日历
        </Button>
      </header>
      <div className="cwgsyw-home__panel-body">
        {!isHydrated || query.isLoading ? (
          <LoadingState label="加载今日日历" />
        ) : query.isError ? (
          <ErrorState
            title="日历加载失败"
            description="无法读取今日统一任务和工作日报。"
            retry={<Button type="button" size="sm" variant="secondary" onClick={() => void query.refetch()}>重试</Button>}
          />
        ) : (
          <>
            <div className="cwgsyw-home-calendar__metrics">
              <MetricCard label="今日任务" value={String(query.data?.summary.total ?? 0)} />
              <MetricCard label="待处理" value={String(query.data?.summary.pending ?? 0)} tone="warning" />
              <MetricCard label="逾期" value={String(query.data?.summary.overdue ?? 0)} tone="danger" />
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => router.push(featuredTask?.href ?? '/work?tab=execute&keyword=%E5%B7%A5%E4%BD%9C%E6%97%A5%E6%8A%A5')}
            >
              今日工作日报 · {featuredTask ? calendarMetaText(featuredTask, 'groupName') ?? '个人任务' : '查看待执行任务'}
            </Button>
            {items.length === 0 ? (
              <div className="cwgsyw-home__empty">
                {/* The exact 22px Figma SVG should be served directly; image optimization adds no value here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={EMPTY_CALENDAR_ICON} width={22} height={22} alt="" data-figma-node="6:24162" />
                <EmptyState showIcon={false} title="今日暂无任务" description="今天还没有需要在日历中处理的事项。" />
              </div>
            ) : (
              <Table
                className="cwgsyw-home__table cwgsyw-cmdb-table"
                showSearch={false}
                density="compact"
                columns={[
                  { key: 'type', label: '类型' },
                  { key: 'title', label: '标题' },
                  { key: 'assignee', label: '负责人' },
                  { key: 'time', label: '时间' },
                  { key: 'status', label: '状态' },
                ]}
                rows={items.slice(0, 6).map((item) => ({
                  id: String(item.id),
                  cells: {
                    type: <StatusBadge size="sm" label={calendarItemTypeLabel(item.itemType)} status="neutral" />,
                    title: item.title,
                    assignee: calendarMetaText(item, 'assigneeName') ?? '-',
                    time: fmtTime(item.endAt).slice(5),
                    status: <StatusBadge size="sm" label={item.overdue ? '已逾期' : statusLabel(item.status)} status={item.overdue ? 'danger' : toNeutralTone(statusTone(item.status))} />,
                  },
                }))}
                onRowClick={(id) => {
                  const hit = items.find((item) => String(item.id) === id)
                  if (hit) router.push(hit.href)
                }}
              />
            )}
          </>
        )}
      </div>
    </section>
  )
}
