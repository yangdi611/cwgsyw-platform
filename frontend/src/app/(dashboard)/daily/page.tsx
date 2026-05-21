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
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'

interface DailyReport {
  id: number
  report_date: string
  completed_items: string
  status: string
  work_hours: number
  reporter_name?: string
  group_name?: string
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
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function DailyReportsPage() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const groupScope = useAuthStore((s) => s.groupScope)
  const { hasPermission } = usePermission()

  // 管理员/超管/组长 能看到他人日报；组员只看自己
  const canViewOthers = hasPermission('daily_report', 'approve')
  // 是否是管理员以上（可看全部，不限组）
  const isAdmin = groupScope === 'tenant' || groupScope === 'platform'

  const monthParam = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`

  const { data, isLoading } = useQuery({
    queryKey: ['daily-reports', monthParam, canViewOthers ? 'group' : 'my'],
    queryFn: () => {
      if (canViewOthers) {
        return api.get('/daily-reports/group', { params: { month: monthParam, page: 1, size: 200 } })
          .then(r => r.data.data.records as DailyReport[])
      }
      return api.get('/daily-reports/my', { params: { month: monthParam, page: 1, size: 31 } })
        .then(r => r.data.data.records as DailyReport[])
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: number) => api.post(`/daily-reports/${id}/submit`),
    onSuccess: () => {
      toast.success('日报已提交审批')
      queryClient.invalidateQueries({ queryKey: ['daily-reports', monthParam] })
      setSelectedDate(null)
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '提交失败')
    },
  })

  // date -> reports[] map（同一天可能有多条，组长/管理员视角）
  const reportsByDate = new Map<string, DailyReport[]>()
  ;(data ?? []).forEach(r => {
    const list = reportsByDate.get(r.report_date) ?? []
    list.push(r)
    reportsByDate.set(r.report_date, list)
  })

  const cells = buildCalendar(viewYear, viewMonth)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const selectedReports = selectedDate ? (reportsByDate.get(selectedDate) ?? []) : []

  const prevMonth = () => {
    setSelectedDate(null)
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    setSelectedDate(null)
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const viewLabel = canViewOthers
    ? (isAdmin ? '全部日报' : '本组日报')
    : '我的日报'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">工作日报</h1>
          <p className="text-sm text-muted-foreground mt-0.5">当前视图：{viewLabel}</p>
        </div>
        <Link href="/daily/new" className={buttonVariants({ variant: 'default', size: 'sm' })}>
          <Plus className="h-4 w-4 mr-1" />新建日报
        </Link>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-semibold text-lg">{viewYear} 年 {viewMonth + 1} 月</span>
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

      {isLoading ? (
        <p className="text-muted-foreground py-12 text-center">加载中...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-muted">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y border-t">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} className="h-20 bg-muted/30" />

              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const reports = reportsByDate.get(dateStr) ?? []
              const isToday = dateStr === todayStr
              const isSelected = selectedDate === dateStr

              return (
                <div
                  key={dateStr}
                  onClick={() => reports.length > 0 ? setSelectedDate(isSelected ? null : dateStr) : undefined}
                  className={cn(
                    'h-20 p-1.5 transition-colors relative',
                    reports.length > 0 ? 'cursor-pointer' : 'cursor-default',
                    isSelected ? 'bg-primary/10 ring-2 ring-inset ring-primary' : reports.length > 0 ? 'hover:bg-muted/50' : ''
                  )}
                >
                  <span className={cn(
                    'text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full',
                    isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                  )}>
                    {day}
                  </span>

                  {/* 同一天多条日报（组长/管理员视角）*/}
                  {reports.length > 0 && (
                    <div className="mt-1 space-y-0.5 overflow-hidden">
                      {reports.slice(0, 2).map(r => {
                        const cfg = statusConfig[r.status]
                        return (
                          <div key={r.id} className="flex items-center gap-1">
                            <span className={cn('inline-block w-1.5 h-1.5 rounded-full flex-shrink-0', cfg?.dot ?? 'bg-gray-400')} />
                            <span className="text-xs text-muted-foreground truncate">
                              {canViewOthers && r.reporter_name ? r.reporter_name : cfg?.label}
                            </span>
                          </div>
                        )
                      })}
                      {reports.length > 2 && (
                        <span className="text-xs text-muted-foreground">+{reports.length - 2} 条</span>
                      )}
                    </div>
                  )}

                  {/* 未填日报的历史日期，悬停显示 + */}
                  {reports.length === 0 && dateStr <= todayStr && !canViewOthers && (
                    <div className="absolute bottom-1 right-1 opacity-0 hover:opacity-100 transition-opacity">
                      <Link
                        href={`/daily/new?date=${dateStr}`}
                        onClick={e => e.stopPropagation()}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Plus className="h-3 w-3" />
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 点击某天展开该天所有日报 */}
      {selectedDate && selectedReports.length > 0 && (
        <div className="mt-4 space-y-3">
          {selectedReports.map(report => {
            const cfg = statusConfig[report.status]
            const isOwn = !canViewOthers
            return (
              <div key={report.id} className="p-4 border rounded-lg bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{selectedDate}</span>
                    {canViewOthers && report.reporter_name && (
                      <span className="text-sm font-medium text-foreground">
                        {report.reporter_name}
                        {report.group_name && (
                          <span className="text-muted-foreground font-normal"> · {report.group_name}</span>
                        )}
                      </span>
                    )}
                    <Badge variant={cfg?.badge ?? 'secondary'}>{cfg?.label ?? report.status}</Badge>
                    {report.work_hours && (
                      <span className="text-sm text-muted-foreground">{report.work_hours}h</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/daily/${report.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                      查看详情
                    </Link>
                    {(isOwn || (!isOwn && false)) &&
                      (report.status === 'DRAFT' || report.status === 'REJECTED') && (
                      <Button size="sm" onClick={() => submitMutation.mutate(report.id)}
                        disabled={submitMutation.isPending}>
                        提交审批
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{report.completed_items}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
