'use client'

import { cn } from '@/lib/utils'
import { weekDays, isToday, ymd, fmtTime, WEEK_LABELS } from '@/lib/opsCalendar'
import { type CalendarWorkItem, calendarItemColor, calendarItemDate, calendarMetaText, calendarStatusLabel } from '@/lib/calendar-api'

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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
      {days.map((date, index) => {
        const key = ymd(date)
        const dayItems = byDate.get(key) ?? []
        const holiday = holidayMap?.get(key)
        return (
          <div key={key} className={cn('rounded-v2-md border border-v2-border bg-v2-surface', isToday(date) && 'ring-1 ring-v2-accent')}>
            <button type="button" onClick={() => onDateClick(key)} className="flex w-full items-center justify-between border-b border-v2-border px-3 py-2 text-left hover:bg-v2-surface-soft">
              <span className="text-xs font-medium text-v2-fg">周{WEEK_LABELS[index]}</span>
              <span className={cn('text-xs', isToday(date) ? 'font-semibold text-v2-accent' : 'text-v2-muted')}>{date.getMonth() + 1}/{date.getDate()}</span>
            </button>
            {holiday && <div className="truncate border-b border-v2-border bg-red-50 px-3 py-1 text-[10px] text-red-600" title={holiday}>{holiday}</div>}
            <div className="min-h-[80px] space-y-1.5 p-2">
              {dayItems.length === 0 && <p className="px-1 py-2 text-center text-[11px] text-v2-subtle">无事项</p>}
              {dayItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onItemClick(item)}
                  className={cn('block w-full rounded border border-v2-border px-2 py-1 text-left text-[11px] hover:bg-v2-surface-soft', item.overdue && 'border-red-400')}
                >
                  <div className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: calendarItemColor(item) }} />
                    <span className="truncate font-medium text-v2-fg">{item.title}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-v2-muted">
                    <span>{fmtTime(item.startAt).slice(11)}</span>
                    <span>{item.overdue ? '已逾期' : calendarStatusLabel(item.status)}</span>
                  </div>
                  {calendarMetaText(item, 'assigneeName') && <div className="truncate text-[10px] text-v2-subtle">{calendarMetaText(item, 'assigneeName')}</div>}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
