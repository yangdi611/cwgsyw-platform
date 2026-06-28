'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { Card } from '@/components/v2/Card'
import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { PageHeader } from '@/components/shared'
import Link from 'next/link'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'

interface DailyReport {
  id: number
  reportDate: string
  completedItems: string
  status: string
  workHours: number
  reporterName?: string
  groupName?: string
}

type StatusVariant = 'ok' | 'warn' | 'danger' | 'neutral'

const statusConfig: Record<string, { label: string; dot: string; badge: StatusVariant }> = {
  DRAFT: { label: '草稿', dot: 'bg-v2-subtle', badge: 'neutral' },
  SUBMITTED: { label: '待审批', dot: 'bg-v2-primary', badge: 'warn' },
  APPROVED: { label: '已通过', dot: 'bg-v2-success', badge: 'ok' },
  REJECTED: { label: '已拒绝', dot: 'bg-v2-danger', badge: 'danger' },
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

  const canViewOthers = hasPermission('daily_report', 'approve')
  const isAdmin = groupScope === 'tenant' || groupScope === 'platform'

  const monthParam = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`

  const { data, isLoading } = useQuery({
    queryKey: ['daily-reports', monthParam, canViewOthers ? 'group' : 'my'],
    queryFn: () => {
      if (canViewOthers) {
        return api
          .get('/daily-reports/group', { params: { month: monthParam, page: 1, size: 200 } })
          .then((r) => r.data.data.records as DailyReport[])
      }
      return api
        .get('/daily-reports/my', { params: { month: monthParam, page: 1, size: 31 } })
        .then((r) => r.data.data.records as DailyReport[])
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

  const reportsByDate = new Map<string, DailyReport[]>()
  ;(data ?? []).forEach((r) => {
    const list = reportsByDate.get(r.reportDate) ?? []
    list.push(r)
    reportsByDate.set(r.reportDate, list)
  })

  const cells = buildCalendar(viewYear, viewMonth)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`
  const selectedReports = selectedDate ? reportsByDate.get(selectedDate) ?? [] : []

  const prevMonth = () => {
    setSelectedDate(null)
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    setSelectedDate(null)
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else setViewMonth((m) => m + 1)
  }

  const viewLabel = canViewOthers ? (isAdmin ? '全部日报' : '本组日报') : '我的日报'

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="流程中心"
        title="工作日报"
        subtitle={`当前视图：${viewLabel}。在日历中查看每日填写状态，点击日期展开详情。`}
        actions={
          <Link
            href="/daily/new"
            className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold rounded-v2-md bg-v2-primary text-white shadow-v2-sm transition-colors hover:bg-v2-primary-hover"
          >
            <Plus className="h-4 w-4" />
            新建日报
          </Link>
        }
      />

      <Card className="p-5">
        {/* Month navigator */}
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-bold text-v2-fg tabular-nums">
            {viewYear} 年 {viewMonth + 1} 月
          </span>
          <Button variant="ghost" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Legend */}
        <div className="mb-4 flex flex-wrap gap-4 text-xs text-v2-muted">
          {Object.entries(statusConfig).map(([, cfg]) => (
            <span key={cfg.label} className="flex items-center gap-1.5">
              <span className={cn('inline-block w-2 h-2 rounded-full', cfg.dot)} />
              {cfg.label}
            </span>
          ))}
        </div>

        {isLoading ? (
          <p className="py-12 text-center text-v2-muted">加载中…</p>
        ) : (
          <div className="overflow-hidden rounded-v2-md border border-v2-border">
            <div className="grid grid-cols-7 bg-v2-surface-soft">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-v2-muted">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y border-t border-v2-border">
              {cells.map((day, idx) => {
                if (day === null)
                  return <div key={`empty-${idx}`} className="h-20 bg-v2-surface-soft/50" />

                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const reports = reportsByDate.get(dateStr) ?? []
                const isToday = dateStr === todayStr
                const isSelected = selectedDate === dateStr

                return (
                  <div
                    key={dateStr}
                    onClick={() => (reports.length > 0 ? setSelectedDate(isSelected ? null : dateStr) : undefined)}
                    className={cn(
                      'relative h-20 p-1.5 transition-colors',
                      reports.length > 0 ? 'cursor-pointer' : 'cursor-default',
                      isSelected
                        ? 'bg-v2-primary-soft ring-2 ring-inset ring-v2-primary'
                        : reports.length > 0
                          ? 'hover:bg-v2-surface-hover'
                          : '',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                        isToday ? 'bg-v2-primary text-white' : 'text-v2-fg',
                      )}
                    >
                      {day}
                    </span>

                    {reports.length > 0 && (
                      <div className="mt-1 space-y-0.5 overflow-hidden">
                        {reports.slice(0, 2).map((r) => {
                          const cfg = statusConfig[r.status]
                          return (
                            <div key={r.id} className="flex items-center gap-1">
                              <span
                                className={cn(
                                  'inline-block w-1.5 h-1.5 flex-shrink-0 rounded-full',
                                  cfg?.dot ?? 'bg-v2-subtle',
                                )}
                              />
                              <span className="truncate text-xs text-v2-muted">
                                {canViewOthers && r.reporterName ? r.reporterName : cfg?.label}
                              </span>
                            </div>
                          )
                        })}
                        {reports.length > 2 && (
                          <span className="text-xs text-v2-muted">+{reports.length - 2} 条</span>
                        )}
                      </div>
                    )}

                    {reports.length === 0 && dateStr <= todayStr && !canViewOthers && (
                      <div className="absolute bottom-1 right-1 opacity-0 transition-opacity hover:opacity-100">
                        <Link
                          href={`/daily/new?date=${dateStr}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-v2-muted hover:text-v2-primary"
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
      </Card>

      {/* 点击某天展开该天所有日报 */}
      {selectedDate && selectedReports.length > 0 && (
        <div className="space-y-3">
          {selectedReports.map((report) => {
            const cfg = statusConfig[report.status]
            const isOwn = !canViewOthers
            return (
              <Card key={report.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-v2-fg tabular-nums">{selectedDate}</span>
                    {canViewOthers && report.reporterName && (
                      <span className="text-sm font-medium text-v2-fg">
                        {report.reporterName}
                        {report.groupName && (
                          <span className="font-normal text-v2-muted"> · {report.groupName}</span>
                        )}
                      </span>
                    )}
                    {cfg && <StatusBadge status={cfg.badge}>{cfg.label}</StatusBadge>}
                    {report.workHours && (
                      <span className="text-sm text-v2-muted tabular-nums">{report.workHours}h</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/daily/${report.id}`}
                      className="inline-flex items-center h-9 px-3 text-sm font-semibold rounded-v2-md border border-v2-border bg-v2-surface text-v2-fg shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
                    >
                      查看详情
                    </Link>
                    {isOwn && (report.status === 'DRAFT' || report.status === 'REJECTED') && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => submitMutation.mutate(report.id)}
                        disabled={submitMutation.isPending}
                      >
                        提交审批
                      </Button>
                    )}
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-v2-muted">{report.completedItems}</p>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
