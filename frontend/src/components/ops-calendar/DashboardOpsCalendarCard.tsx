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
import { Button, Card, EmptyState, MetricCard, StatusBadge, Table } from '@/design-system/figma-neutral/components'

function toNeutralTone(tone: 'ok' | 'warn' | 'danger' | 'neutral'): 'success' | 'warning' | 'danger' | 'neutral' {
  if (tone === 'ok') return 'success'
  if (tone === 'warn') return 'warning'
  return tone
}

export function DashboardOpsCalendarCard() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const canReadCalendar = hasPermission('task', 'read')
  const query = useQuery<CalendarDashboardVO>({
    queryKey: ['calendar-dashboard'],
    queryFn: () => api.get('/calendar/dashboard').then((response) => response.data.data as CalendarDashboardVO),
    enabled: canReadCalendar,
  })

  if (!canReadCalendar) return null
  const items = query.data?.items ?? []
  const featuredTask = query.data?.featuredTask

  return (
    <Card
      title="运维日历"
      description="今日统一任务与工作日报。"
      headerAction={<Button type="button" size="sm" variant="ghost" onClick={() => router.push('/ops-calendar')}>查看日历</Button>}
    >
      <div className="cwgsyw-inline-controls">
        <MetricCard label="今日任务" value={String(query.data?.summary.total ?? 0)} />
        <MetricCard label="待处理" value={String(query.data?.summary.pending ?? 0)} tone="warning" />
        <MetricCard label="逾期" value={String(query.data?.summary.overdue ?? 0)} tone="danger" />
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => router.push(featuredTask?.href ?? '/work?tab=execute&keyword=%E5%B7%A5%E4%BD%9C%E6%97%A5%E6%8A%A5')}
      >
        今日工作日报 · {featuredTask ? calendarMetaText(featuredTask, 'groupName') ?? '个人任务' : '查看待执行任务'}
      </Button>
      {items.length === 0 ? (
        <EmptyState title="今日暂无任务" />
      ) : (
        <Table
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
              type: <StatusBadge label={calendarItemTypeLabel(item.itemType)} status="neutral" />,
              title: item.title,
              assignee: calendarMetaText(item, 'assigneeName') ?? '-',
              time: fmtTime(item.endAt).slice(5),
              status: <StatusBadge label={item.overdue ? '已逾期' : statusLabel(item.status)} status={item.overdue ? 'danger' : toNeutralTone(statusTone(item.status))} />,
            },
          }))}
          onRowClick={(id) => {
            const hit = items.find((item) => String(item.id) === id)
            if (hit) router.push(hit.href)
          }}
        />
      )}
    </Card>
  )
}
