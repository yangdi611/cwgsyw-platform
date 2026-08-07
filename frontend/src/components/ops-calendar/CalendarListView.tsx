'use client'

import { DataTable, type ColumnDef } from '@/components/shared'
import { StatusBadge } from '@/components/design-system'
import { fmtTime } from '@/lib/opsCalendar'
import { type CalendarWorkItem, calendarItemTypeLabel, calendarMetaText, calendarStatusLabel } from '@/lib/calendar-api'

interface Props {
  items: CalendarWorkItem[]
  loading: boolean
  onItemClick: (item: CalendarWorkItem) => void
}

export function CalendarListView({ items, loading, onItemClick }: Props) {
  const columns: ColumnDef<CalendarWorkItem>[] = [
    { key: 'title', title: '事项', render: (item) => <span className="font-semibold text-v2-fg">{item.title}</span> },
    { key: 'itemType', title: '类型', render: (item) => <StatusBadge status="neutral">{calendarItemTypeLabel(item.itemType)}</StatusBadge> },
    { key: 'startAt', title: '开始时间', render: (item) => <span className="font-v2-mono text-xs text-v2-fg">{fmtTime(item.startAt)}</span> },
    { key: 'endAt', title: '结束/截止', render: (item) => <span className="font-v2-mono text-xs text-v2-fg">{fmtTime(item.endAt)}</span> },
    {
      key: 'assigneeName', title: '负责人',
      render: (item) => calendarMetaText(item, 'assigneeName')
        ? <span className="text-sm text-v2-fg">{calendarMetaText(item, 'assigneeName')}</span>
        : <span className="text-v2-subtle">-</span>,
    },
    { key: 'status', title: '状态', render: (item) => <StatusBadge status={item.overdue ? 'danger' : item.status === 'completed' ? 'ok' : 'neutral'}>{item.overdue ? '已逾期' : calendarStatusLabel(item.status)}</StatusBadge> },
  ]

  return (
    <DataTable
      columns={columns}
      data={items}
      rowKey={(item) => item.id}
      loading={loading}
      onRowClick={onItemClick}
      empty={{ title: '暂无日历事项', description: '当前筛选范围内没有任务、排班或节假日' }}
    />
  )
}
