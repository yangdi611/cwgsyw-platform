'use client'

import { cn } from '@/lib/utils'
import {
  type TaskVO, monthGrid, isToday, ymd, taskDateKey,
  taskTypeColor, taskTypeLabel, WEEK_LABELS,
} from '@/lib/opsCalendar'

interface Props {
  currentDate: Date
  tasks: TaskVO[]
  onDateClick: (date: string) => void
  onTaskClick: (taskId: number) => void
}

export function CalendarMonthView({ currentDate, tasks, onDateClick, onTaskClick }: Props) {
  const grid = monthGrid(currentDate)
  const month = currentDate.getMonth()

  // group tasks by date key
  const byDate = new Map<string, TaskVO[]>()
  for (const t of tasks) {
    const key = taskDateKey(t)
    if (!key) continue
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(t)
  }

  return (
    <div className="rounded-lg border border-v2-border bg-v2-surface overflow-hidden">
      {/* weekday header */}
      <div className="grid grid-cols-7 border-b border-v2-border bg-v2-surface-soft">
        {WEEK_LABELS.map((w, i) => (
          <div key={w} className={cn(
            'px-2 py-2 text-center text-xs font-medium text-v2-muted',
            i >= 5 && 'text-v2-subtle'
          )}>
            周{w}
          </div>
        ))}
      </div>
      {/* 6 rows × 7 cols */}
      <div className="grid grid-cols-7">
        {grid.map((d, idx) => {
          const key = ymd(d)
          const dayTasks = byDate.get(key) ?? []
          const inMonth = d.getMonth() === month
          const today = isToday(d)
          const visible = dayTasks.slice(0, 3)
          const more = dayTasks.length - visible.length
          return (
            <div
              key={idx}
              onClick={() => onDateClick(key)}
              className={cn(
                'min-h-[104px] border-b border-r border-v2-border p-1.5 cursor-pointer transition-colors hover:bg-v2-surface-soft',
                !inMonth && 'bg-v2-surface-soft/40',
                idx % 7 === 6 && 'border-r-0',
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                  !inMonth ? 'text-v2-subtle' : 'text-v2-fg',
                  today && 'bg-v2-accent text-white font-semibold',
                )}>
                  {d.getDate()}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] text-v2-muted">{dayTasks.length}</span>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {visible.map((t) => {
                  const overdue = t.status === 'overdue'
                  const isPublic = t.visibility === 'public'
                  return (
                    <button
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); onTaskClick(t.id) }}
                      title={t.title}
                      className={cn(
                        'block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-tight',
                        overdue && 'ring-1 ring-red-400',
                        isPublic && 'opacity-80',
                      )}
                      style={{
                        background: `${taskTypeColor(t.taskType)}1a`,
                        color: taskTypeColor(t.taskType),
                      }}
                    >
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                        style={{ background: taskTypeColor(t.taskType) }} />
                      {isPublic && <span className="mr-0.5">[公共]</span>}
                      {t.title}
                    </button>
                  )
                })}
                {more > 0 && (
                  <div className="px-1.5 text-[10px] text-v2-muted">+{more} 更多</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
