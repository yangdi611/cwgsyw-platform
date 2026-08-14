'use client'

import { Button, StatusBadge } from '@/design-system/figma-neutral/components'
import { monthGrid, isToday, ymd, WEEK_LABELS } from '@/lib/opsCalendar'
import { type CalendarWorkItem, calendarItemDate } from '@/lib/calendar-api'

interface Props {
  currentDate: Date
  items: CalendarWorkItem[]
  holidayMap?: Map<string, string>
  onDateClick: (date: string) => void
  onItemClick: (item: CalendarWorkItem) => void
}

export function CalendarMonthView({ currentDate, items, holidayMap, onDateClick, onItemClick }: Props) {
  const grid = monthGrid(currentDate)
  const month = currentDate.getMonth()
  const byDate = new Map<string, CalendarWorkItem[]>()
  for (const item of items.filter((value) => value.itemType !== 'holiday')) {
    const key = calendarItemDate(item)
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(item)
  }

  return (
    <div className="cwgsyw-ops-cal">
      <div className="cwgsyw-ops-cal__head">
        {WEEK_LABELS.map((week) => (
          <div key={week} className="cwgsyw-ops-cal__label cwgsyw-type-label-xs">
            周{week}
          </div>
        ))}
      </div>
      <div className="cwgsyw-ops-cal__grid">
        {grid.map((date) => {
          const key = ymd(date)
          const dayItems = byDate.get(key) ?? []
          const visible = dayItems.slice(0, 3)
          const more = dayItems.length - visible.length
          const holiday = holidayMap?.get(key)
          return (
            <Button
              key={key}
              type="button"
              variant="ghost"
              className="cwgsyw-ops-cal__cell"
              data-outside={date.getMonth() !== month}
              data-today={isToday(date)}
              onClick={() => onDateClick(key)}
            >
              <span className="cwgsyw-type-label-md">{date.getDate()}</span>
              {holiday ? <StatusBadge label={`休 ${holiday}`} status="danger" /> : null}
              {visible.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant="ghost"
                  title={item.title}
                  className="cwgsyw-ops-cal-item"
                  data-overdue={item.overdue}
                  onClick={(event) => {
                    event.stopPropagation()
                    onItemClick(item)
                  }}
                >
                  {item.itemType === 'roster' ? '[班] ' : ''}
                  {item.title}
                </Button>
              ))}
              {more > 0 ? <div className="cwgsyw-type-label-xs">+{more} 更多</div> : null}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
