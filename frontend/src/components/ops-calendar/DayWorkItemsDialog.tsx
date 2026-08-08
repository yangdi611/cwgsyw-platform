'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, StatusBadge } from '@/components/design-system'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-8">
            <DialogTitle>{activeDate} <span className="ml-2 text-sm font-normal text-v2-muted">{dayOfWeek}</span></DialogTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => shiftDay(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => shiftDay(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </DialogHeader>

        {data?.summary && (
          <div className="flex flex-wrap gap-4 border-b border-v2-border pb-3 text-sm text-v2-muted">
            <span>共 <b className="text-v2-fg">{data.summary.total}</b></span>
            <span>待处理 <b className="text-amber-600">{data.summary.pending}</b></span>
            <span>逾期 <b className="text-red-600">{data.summary.overdue}</b></span>
            <span>已完成 <b className="text-green-600">{data.summary.completed}</b></span>
          </div>
        )}

        {isLoading && <p className="py-8 text-center text-sm text-v2-muted">加载中...</p>}
        {!isLoading && data?.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onItemClick(item)}
            className="flex w-full items-center gap-3 rounded-v2-md border border-v2-border px-3 py-2 text-left transition-colors hover:bg-v2-surface-soft"
          >
            <StatusBadge status="neutral">{calendarItemTypeLabel(item.itemType)}</StatusBadge>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-v2-fg">{item.title}</span>
            {calendarMetaText(item, 'assigneeName') && <span className="text-xs text-v2-muted">{calendarMetaText(item, 'assigneeName')}</span>}
            <span className="font-v2-mono text-xs text-v2-muted">{fmtTime(item.startAt).slice(11)}</span>
            <StatusBadge status={item.overdue ? 'danger' : item.status === 'completed' ? 'ok' : 'neutral'}>{item.overdue ? '已逾期' : calendarStatusLabel(item.status)}</StatusBadge>
          </button>
        ))}
        {!isLoading && (!data || data.items.length === 0) && <p className="py-8 text-center text-sm text-v2-muted">当日暂无工作项</p>}
        {onCreate && activeDate && (
          <div className="flex justify-end border-t border-v2-border pt-3">
            <Button variant="primary" onClick={() => onCreate(activeDate)}><Plus className="h-4 w-4" />在该日期创建任务</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
