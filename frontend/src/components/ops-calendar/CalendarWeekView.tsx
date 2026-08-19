'use client'

import { Button, StatusBadge } from '@/design-system/figma-neutral/components'
import { weekDays, isToday, ymd, fmtTime, WEEK_LABELS } from '@/lib/opsCalendar'
import { type CalendarWorkItem, calendarItemDate, calendarMetaText, calendarStatusLabel } from '@/lib/calendar-api'

interface Props {
  currentDate: Date
  items: CalendarWorkItem[]
  holidayMap?: Map<string, string>
  onDateClick: (date: string) => void
  onItemClick: (item: CalendarWorkItem) => void
}

export function CalendarWeekView({ currentDate, items, holidayMap, onDateClick, onItemClick }: Props) {
  const days = weekDays(currentDate)
  const byDate = new Map<string, CalendarWorkItem[]>()
  for (const item of items.filter((value) => value.itemType !== 'holiday')) {
    const key = calendarItemDate(item)
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(item)
  }

  return (
    <div className="cwgsyw-ops-week">
      {days.map((date, index) => {
        const key = ymd(date)
        const dayItems = byDate.get(key) ?? []
        const holiday = holidayMap?.get(key)
        return (
          <article key={key} className="cwgsyw-card cwgsyw-card--sm" data-today={isToday(date)}>
            <Button type="button" variant="ghost" size="sm" className="cwgsyw-ops-week__head" onClick={() => onDateClick(key)}>
              <span>周{WEEK_LABELS[index]}</span>
              <span>
                {date.getMonth() + 1}/{date.getDate()}
              </span>
            </Button>
            {holiday ? <StatusBadge size="sm" label={holiday} status="danger" /> : null}
            {dayItems.length === 0 ? <p className="cwgsyw-ops-week__empty">无事项</p> : null}
            {dayItems.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                className="cwgsyw-ops-cal-item"
                data-overdue={item.overdue}
                onClick={() => onItemClick(item)}
              >
                <div className="cwgsyw-ops-cal__item-title">{item.title}</div>
                <div className="cwgsyw-ops-cal__item-meta">
                  {fmtTime(item.startAt).slice(11)} · {item.overdue ? '已逾期' : calendarStatusLabel(item.status)}
                </div>
                {calendarMetaText(item, 'assigneeName') ? (
                  <div className="cwgsyw-ops-cal__item-meta">{calendarMetaText(item, 'assigneeName')}</div>
                ) : null}
              </Button>
            ))}
          </article>
        )
      })}
    </div>
  )
}
