'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, NeutralDialog, StatusBadge } from '@/design-system/figma-neutral/components'
import { fmtTime, ymd, WEEK_LABELS } from '@/lib/opsCalendar'
import {
  type CalendarDayFilters,
  type CalendarScope,
  type CalendarWorkItem,
  calendarItemTypeLabel,
  calendarMetaText,
  calendarStatusLabel,
  getCalendarDay,
} from '@/lib/calendar-api'

interface Props {
  date: string | null
  scope: CalendarScope
  include: string
  filters: Omit<CalendarDayFilters, 'scope' | 'include'>
  open: boolean
  onOpenChange: (open: boolean) => void
  onItemClick: (item: CalendarWorkItem) => void
  onCreate?: (date: string) => void
}

export function DayWorkItemsDialog({ date, scope, include, filters, open, onOpenChange, onItemClick, onCreate }: Props) {
  const [activeDate, setActiveDate] = useState<string | null>(date)
  const [previousDate, setPreviousDate] = useState<string | null>(date)
  if (date !== previousDate) {
    setPreviousDate(date)
    setActiveDate(date)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-day', activeDate, scope, include, filters],
    queryFn: () => getCalendarDay(activeDate!, { scope, include, ...filters }),
    enabled: open && Boolean(activeDate),
  })

  function shiftDay(delta: number) {
    if (!activeDate) return
    const value = new Date(`${activeDate}T00:00:00`)
    value.setDate(value.getDate() + delta)
    setActiveDate(ymd(value))
  }

  const dayOfWeek = activeDate
    ? `星期${WEEK_LABELS[(new Date(`${activeDate}T00:00:00`).getDay() + 6) % 7]}`
    : ''

  return (
    <NeutralDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${activeDate ?? ''} ${dayOfWeek}`.trim()}
      size="lg"
      showClose
      footer={
        onCreate && activeDate ? (
          <div className="cwgsyw-form__actions">
            <Button type="button" variant="primary" onClick={() => onCreate(activeDate)}>
              在该日期创建任务
            </Button>
          </div>
        ) : null
      }
    >
      <div className="cwgsyw-form">
        <div className="cwgsyw-inline-controls">
          <Button type="button" variant="ghost" size="sm" onClick={() => shiftDay(-1)}>
            前一天
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => shiftDay(1)}>
            后一天
          </Button>
        </div>
        {data?.summary ? (
          <div className="cwgsyw-inline-controls">
            <StatusBadge label={`共 ${data.summary.total}`} status="neutral" />
            <StatusBadge label={`待处理 ${data.summary.pending}`} status="warning" />
            <StatusBadge label={`逾期 ${data.summary.overdue}`} status="danger" />
            <StatusBadge label={`已完成 ${data.summary.completed}`} status="success" />
          </div>
        ) : null}
        {isLoading ? <p className="cwgsyw-type-body-sm">加载中...</p> : null}
        {!isLoading
          ? data?.items.map((item) => (
              <Button key={item.id} type="button" variant="ghost" className="cwgsyw-ops-cal-item" data-overdue={item.overdue} onClick={() => onItemClick(item)}>
                <StatusBadge label={calendarItemTypeLabel(item.itemType)} status="neutral" />
                <span className="cwgsyw-type-label-md">{item.title}</span>
                {calendarMetaText(item, 'assigneeName') ? <span className="cwgsyw-type-label-xs">{calendarMetaText(item, 'assigneeName')}</span> : null}
                <span className="cwgsyw-type-label-xs">{fmtTime(item.startAt).slice(11)}</span>
                <StatusBadge
                  label={item.overdue ? '已逾期' : calendarStatusLabel(item.status)}
                  status={item.overdue ? 'danger' : item.status === 'completed' ? 'success' : 'neutral'}
                />
              </Button>
            ))
          : null}
        {!isLoading && (!data || data.items.length === 0) ? <p className="cwgsyw-type-body-sm">当日暂无工作项</p> : null}
      </div>
    </NeutralDialog>
  )
}
