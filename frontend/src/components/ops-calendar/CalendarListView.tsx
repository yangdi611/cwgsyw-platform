'use client'

import { EmptyState, StatusBadge, Table } from '@/design-system/figma-neutral/components'
import { fmtTime } from '@/lib/opsCalendar'
import { type CalendarWorkItem, calendarItemTypeLabel, calendarMetaText, calendarStatusLabel } from '@/lib/calendar-api'

interface Props {
  items: CalendarWorkItem[]
  loading: boolean
  onItemClick: (item: CalendarWorkItem) => void
}

export function CalendarListView({ items, loading, onItemClick }: Props) {
  return (
    <Table
      className="cwgsyw-cmdb-table cwgsyw-ops__table"
      density="compact"
      showSearch={false}
      columns={[
        { key: 'title', label: '事项' },
        { key: 'itemType', label: '类型' },
        { key: 'startAt', label: '开始时间' },
        { key: 'endAt', label: '结束/截止' },
        { key: 'assigneeName', label: '负责人' },
        { key: 'status', label: '状态' },
      ]}
      rows={items.map((item) => ({
        id: item.id,
        cells: {
          title: item.title,
          itemType: <StatusBadge size="sm" label={calendarItemTypeLabel(item.itemType)} status="neutral" />,
          startAt: fmtTime(item.startAt),
          endAt: fmtTime(item.endAt),
          assigneeName: calendarMetaText(item, 'assigneeName') || '-',
          status: (
            <StatusBadge
              size="sm"
              label={item.overdue ? '已逾期' : calendarStatusLabel(item.status)}
              status={item.overdue ? 'danger' : item.status === 'completed' ? 'success' : 'neutral'}
            />
          ),
        },
      }))}
      state={loading ? 'loading' : items.length === 0 ? 'empty' : 'data'}
      empty={
        <div className="cwgsyw-ops__empty">
          <img src="/figma-icons/home-calendar.svg" width={22} height={22} alt="" data-figma-node="6:24162" />
          <EmptyState showIcon={false} title="暂无日历事项" description="当前筛选范围内没有任务、排班或节假日。" showAction={false} />
        </div>
      }
      onRowClick={(id) => {
        const item = items.find((entry) => entry.id === id)
        if (item) onItemClick(item)
      }}
    />
  )
}
