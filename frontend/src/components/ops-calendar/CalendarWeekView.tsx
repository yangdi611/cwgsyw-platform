'use client'

import { cn } from '@/lib/utils'
import {
  type TaskVO, weekDays, isToday, ymd, taskDateKey,
  taskTypeColor, statusLabel, fmtTime, WEEK_LABELS,
} from '@/lib/opsCalendar'

interface Props {
  currentDate: Date
  tasks: TaskVO[]
  holidayMap?: Map<string, string>
  onDateClick: (date: string) => void
  onTaskClick: (taskId: number) => void
}

export function CalendarWeekView({ currentDate, tasks, holidayMap, onDateClick, onTaskClick }: Props) {
  const days = weekDays(currentDate)
  const byDate = new Map<string, TaskVO[]>()
  for (const t of tasks) {
    const key = taskDateKey(t)
    if (!key) continue
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(t)
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
      {days.map((d, i) => {
        const key = ymd(d)
        const dayTasks = byDate.get(key) ?? []
        const today = isToday(d)
        const holiday = holidayMap?.get(key)
        return (
          <div key={key} className={cn(
            'rounded-lg border border-v2-border bg-v2-surface',
            today && 'ring-1 ring-v2-accent',
          )}>
            <button
              onClick={() => onDateClick(key)}
              className="flex w-full items-center justify-between border-b border-v2-border px-3 py-2 text-left hover:bg-v2-surface-soft"
            >
              <span className="text-xs font-medium text-v2-fg">周{WEEK_LABELS[i]}</span>
              <span className={cn('text-xs', today ? 'font-semibold text-v2-accent' : 'text-v2-muted')}>
                {d.getMonth() + 1}/{d.getDate()}
              </span>
            </button>
            {holiday && (
              <div className="px-3 py-1 text-[10px] text-red-600 bg-red-50 border-b border-v2-border truncate" title={holiday}>
                {holiday}
              </div>
            )}
            <div className="space-y-1.5 p-2 min-h-[80px]">
              {dayTasks.length === 0 && (
                <p className="px-1 py-2 text-center text-[11px] text-v2-subtle">无任务</p>
              )}
              {dayTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onTaskClick(t.id)}
                  className={cn(
                    'block w-full rounded border border-v2-border px-2 py-1 text-left text-[11px] hover:bg-v2-surface-soft',
                    t.status === 'overdue' && 'border-red-400',
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: taskTypeColor(t.taskType) }} />
                    <span className="truncate font-medium text-v2-fg">{t.title}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-v2-muted">
                    <span>{fmtTime(t.plannedStartAt ?? t.dueAt).slice(11)}</span>
                    <span>{statusLabel(t.status)}</span>
                  </div>
                  {t.assigneeName && (
                    <div className="text-[10px] text-v2-subtle truncate">{t.assigneeName}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
