'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DailyReport {
  id: number
  report_date: string
  completed_items: string
  status: string
  work_hours: number
}

const statusConfig: Record<string, {
  label: string
  dot: string
  badge: 'default' | 'secondary' | 'destructive' | 'outline'
}> = {
  DRAFT:     { label: '草稿',   dot: 'bg-gray-400',   badge: 'secondary' },
  SUBMITTED: { label: '待审批', dot: 'bg-blue-500',   badge: 'default' },
  APPROVED:  { label: '已通过', dot: 'bg-green-500',  badge: 'outline' },
  REJECTED:  { label: '已拒绝', dot: 'bg-red-500',    badge: 'destructive' },
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function buildCalendar(year: number, month: number) {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function DailyReportsPage() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed
  const [selected, setSelected] = useState<DailyReport | null>(null)
  const queryClient = useQueryClient()

  const monthParam = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`

  const { data, isLoading } = useQuery({
    queryKey: ['my-daily-reports', monthParam],
    queryFn: () =>
      api.get('/daily-reports/my', { params: { month: monthParam, page: 1, size: 31 } })
        .then(r => r.data.data.records as DailyReport[]),
  })

  const submitMutation = useMutation({
    mutationFn: (id: number) => api.post(`/daily-reports/${id}/submit`),
    onSuccess: () => {
      toast.success('日报已提交审批')
      queryClient.invalidateQueries({ queryKey: ['my-daily-reports', monthParam] })
      setSelected(null)
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '提交失败')
    },
  })

  // Build a date -> report map for quick lookup
  const reportMap = new Map<string, DailyReport>()
  ;(data ?? []).forEach(r => reportMap.set(r.report_date, r))

  const cells = buildCalendar(viewYear, viewMonth)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelected(null)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelected(null)
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const monthLabel = `${viewYear} 年 ${viewMonth + 1} 月`

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">我的日报</h1>
        <Link href="/daily/new" className={buttonVariants({ variant: 'default', size: 'sm' })}>
          <Plus className="h-4 w-4 mr-1" />新建日报
        </Link>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-lg">{monthLabel}</span>
        <Button variant="ghost" size="sm" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
        {Object.entries(statusConfig).map(([, cfg]) => (
          <span key={cfg.label} className="flex items-center gap-1">
            <span className={cn('inline-block w-2 h-2 rounded-full', cfg.dot)} />
            {cfg.label}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <p className="text-muted-foreground py-12 text-center">加载中...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-muted">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 divide-x divide-y border-t">
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-20 bg-muted/30" />
              }
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const report = reportMap.get(dateStr)
              const isToday = dateStr === todayStr
              const isSelected = selected?.report_date === dateStr
              const cfg = report ? statusConfig[report.status] : null

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelected(report && isSelected ? null : (report ?? null))}
                  className={cn(
                    'h-20 p-1.5 cursor-pointer transition-colors relative',
                    isSelected ? 'bg-primary/10 ring-2 ring-inset ring-primary' : 'hover:bg-muted/50',
                    !report && 'cursor-default'
                  )}
                >
                  {/* Day number */}
                  <span className={cn(
                    'text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full',
                    isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                  )}>
                    {day}
                  </span>

                  {/* Report indicator */}
                  {cfg && (
                    <div className="mt-1">
                      <span className={cn('inline-block w-2 h-2 rounded-full', cfg.dot)} />
                      <span className="ml-1 text-xs text-muted-foreground">{cfg.label}</span>
                    </div>
                  )}

                  {/* No report on weekday — subtle hint */}
                  {!report && day <= new Date(viewYear, viewMonth + 1, 0).getDate() && (
                    <div className="absolute bottom-1 right-1 opacity-0 hover:opacity-100 transition-opacity">
                      {dateStr <= todayStr && (
                        <Link
                          href={`/daily/new?date=${dateStr}`}
                          onClick={e => e.stopPropagation()}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Plus className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected report detail panel */}
      {selected && (
        <div className="mt-4 p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{selected.report_date}</span>
              <Badge variant={statusConfig[selected.status]?.badge ?? 'secondary'}>
                {statusConfig[selected.status]?.label ?? selected.status}
              </Badge>
              {selected.work_hours && (
                <span className="text-sm text-muted-foreground">{selected.work_hours}h</span>
              )}
            </div>
            <div className="flex gap-2">
              <Link
                href={`/daily/${selected.id}`}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                查看详情
              </Link>
              {(selected.status === 'DRAFT' || selected.status === 'REJECTED') && (
                <Button
                  size="sm"
                  onClick={() => submitMutation.mutate(selected.id)}
                  disabled={submitMutation.isPending}
                >
                  提交审批
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3">{selected.completed_items}</p>
        </div>
      )}
    </div>
  )
}
