'use client'

import { cn } from '@/lib/utils'
import { monthGrid, isToday, ymd, WEEK_LABELS } from '@/lib/opsCalendar'
import { type CalendarWorkItem, calendarItemColor, calendarItemDate } from '@/lib/calendar-api'

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
    <div className="overflow-hidden rounded-v2-md border border-v2-border bg-v2-surface">
      <div className="grid grid-cols-7 border-b border-v2-border bg-v2-surface-soft">
        {WEEK_LABELS.map((week, index) => (
          <div key={week} className={cn('px-2 py-2 text-center text-xs font-medium text-v2-muted', index >= 5 && 'text-v2-subtle')}>
            周{week}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((date, index) => {
          const key = ymd(date)
          const dayItems = byDate.get(key) ?? []
          const visible = dayItems.slice(0, 3)
          const more = dayItems.length - visible.length
          const holiday = holidayMap?.get(key)
          return (
            <div
              key={key}
              onClick={() => onDateClick(key)}
              className={cn(
                'min-h-[104px] cursor-pointer border-b border-r border-v2-border p-1.5 transition-colors hover:bg-v2-surface-soft',
                date.getMonth() !== month && 'bg-v2-surface-soft/40',
                index % 7 === 6 && 'border-r-0',
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  date.getMonth() !== month ? 'text-v2-subtle' : 'text-v2-fg',
                  isToday(date) && 'bg-v2-accent font-semibold text-white',
                )}>{date.getDate()}</span>
                {dayItems.length > 0 && <span className="text-[10px] text-v2-muted">{dayItems.length}</span>}
              </div>
              {holiday && <div className="mt-0.5 truncate text-[10px] text-red-600" title={holiday}>休 {holiday}</div>}
              <div className="mt-1 space-y-1">
                {visible.map((item) => {
                  const color = calendarItemColor(item)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.title}
                      onClick={(event) => { event.stopPropagation(); onItemClick(item) }}
                      className={cn('block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight', item.overdue && 'ring-1 ring-red-400')}
                      style={{ background: `${color}1a`, color }}
                    >
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: color }} />
                      {item.itemType === 'roster' && <span className="mr-0.5">[班]</span>}
                      {item.title}
                    </button>
                  )
                })}
                {more > 0 && <div className="px-1.5 text-[10px] text-v2-muted">+{more} 更多</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
