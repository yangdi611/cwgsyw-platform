'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/v2/Dialog'
import { Button } from '@/components/v2/Button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TaskTypeBadge, TaskStatusBadge } from './TaskBadges'
import { type CalendarScope, type DayTasksVO, type TaskVO, fmtTime, ymd, WEEK_LABELS } from '@/lib/opsCalendar'

interface Props {
  date: string | null
  scope: CalendarScope
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskClick: (taskId: number) => void
}

export function DayWorkItemsDialog({ date, scope, open, onOpenChange, onTaskClick }: Props) {
  const [activeDate, setActiveDate] = useState<string | null>(date)
  // 当外部传入的 date 变化时，同步重置内部步进状态（render 期重置，避免 effect 内 setState）
  const [prevDate, setPrevDate] = useState<string | null>(date)
  if (date !== prevDate) {
    setPrevDate(date)
    setActiveDate(date)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['ops-calendar-day', activeDate, scope],
    queryFn: () => api.get('/ops-calendar/tasks/day', { params: { date: activeDate, scope } })
      .then((r) => r.data.data as DayTasksVO),
    enabled: open && !!activeDate,
  })

  function shiftDay(delta: number) {
    if (!activeDate) return
    const d = new Date(activeDate + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setActiveDate(ymd(d))
  }

  const dowLabel = activeDate
    ? '星期' + WEEK_LABELS[(new Date(activeDate + 'T00:00:00').getDay() + 6) % 7]
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 pr-8">
            <DialogTitle>
              {activeDate} <span className="text-sm font-normal text-v2-muted ml-2">{dowLabel}</span>
              {data?.holidayName && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">{data.holidayName}</span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => shiftDay(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => shiftDay(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </DialogHeader>

        {data?.summary && (
          <div className="flex gap-4 text-sm text-v2-muted border-b border-v2-border pb-3">
            <span>共 <b className="text-v2-fg">{data.summary.total}</b></span>
            <span>待处理 <b className="text-amber-600">{data.summary.pending}</b></span>
            <span>逾期 <b className="text-red-600">{data.summary.overdue}</b></span>
            <span>已完成 <b className="text-green-600">{data.summary.completed}</b></span>
          </div>
        )}

        {isLoading && <p className="py-8 text-center text-sm text-v2-muted">加载中…</p>}

        {!isLoading && data?.groups?.map((g) => (
          g.tasks.length === 0 ? null : (
            <div key={g.key} className="space-y-2">
              <h4 className="text-xs font-semibold text-v2-muted uppercase tracking-wide">{g.label}（{g.tasks.length}）</h4>
              <div className="space-y-1.5">
                {g.tasks.map((t: TaskVO) => (
                  <button
                    key={t.id}
                    onClick={() => onTaskClick(t.id)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg border border-v2-border hover:bg-v2-surface-soft transition-colors"
                  >
                    <TaskTypeBadge taskType={t.taskType} />
                    <span className="flex-1 text-sm text-v2-fg truncate">{t.title}</span>
                    {t.assigneeName && <span className="text-xs text-v2-muted">{t.assigneeName}</span>}
                    {(t.taskType === 'roster' && t.assigneePhone) && (
                      <span className="text-xs text-v2-muted font-v2-mono">{t.assigneePhone}</span>
                    )}
                    <span className="text-xs text-v2-muted">{fmtTime(t.dueAt).slice(11)}</span>
                    <TaskStatusBadge status={t.status} />
                  </button>
                ))}
              </div>
            </div>
          )
        ))}

        {!isLoading && (!data || data.groups.every((g) => g.tasks.length === 0)) && (
          <p className="py-8 text-center text-sm text-v2-muted">当日暂无工作项</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
