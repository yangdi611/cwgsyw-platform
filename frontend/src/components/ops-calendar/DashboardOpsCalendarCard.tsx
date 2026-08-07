'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardHeader, CardTitle, StatusBadge } from '@/components/design-system'
import {
  type CalendarDashboardVO,
  calendarItemTypeLabel,
  calendarMetaText,
  fmtTime,
  statusLabel,
  statusTone,
} from '@/lib/opsCalendar'
import { usePermission } from '@/hooks/usePermission'

export function DashboardOpsCalendarCard() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const canReadCalendar = hasPermission('task', 'read')
  const query = useQuery<CalendarDashboardVO>({
    queryKey: ['calendar-dashboard'],
    queryFn: () => api.get('/calendar/dashboard').then((response) => response.data.data as CalendarDashboardVO),
    enabled: canReadCalendar,
  })

  if (!canReadCalendar) return null
  const items = query.data?.items ?? []
  const featuredTask = query.data?.featuredTask

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>运维日历</CardTitle>
            <p className="mt-1 text-sm text-v2-muted">今日统一任务与工作日报。</p>
          </div>
          <Link href="/ops-calendar" className="whitespace-nowrap text-sm font-bold text-v2-primary hover:text-v2-primary-hover">查看日历</Link>
        </div>
      </CardHeader>

      <div className="grid grid-cols-3 gap-3 px-6 pb-3 pt-4">
        <SummaryPill label="今日任务" value={query.data?.summary.total ?? 0} tone="text-v2-fg" />
        <SummaryPill label="待处理" value={query.data?.summary.pending ?? 0} tone="text-amber-600" />
        <SummaryPill label="逾期" value={query.data?.summary.overdue ?? 0} tone="text-red-600" />
      </div>

      <button
        type="button"
        onClick={() => router.push(featuredTask?.href ?? '/work?tab=execute&keyword=%E5%B7%A5%E4%BD%9C%E6%97%A5%E6%8A%A5')}
        className="mx-6 mb-3 flex w-[calc(100%-3rem)] items-center justify-between gap-3 rounded-md border border-v2-primary-border bg-v2-primary-soft px-3 py-2 text-left hover:bg-v2-surface-hover"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <FileText className="h-4 w-4 shrink-0 text-v2-primary" aria-hidden="true" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-v2-fg">今日工作日报</div>
            <div className="text-xs text-v2-muted">
              {featuredTask ? calendarMetaText(featuredTask, 'groupName') ?? '个人任务' : '查看待执行任务'}
            </div>
          </div>
        </div>
        <StatusBadge status={featuredTask ? featuredTask.overdue ? 'danger' : statusTone(featuredTask.status) : 'neutral'}>
          {featuredTask ? featuredTask.overdue ? '已逾期' : statusLabel(featuredTask.status) : '未生成'}
        </StatusBadge>
      </button>

      <div className="overflow-x-auto">
        {items.length === 0 ? <p className="px-6 py-10 text-center text-sm text-v2-muted">今日暂无任务</p> : (
          <table className="w-full">
            <tbody>
              {items.slice(0, 6).map((item) => (
                <tr key={item.id} onClick={() => router.push(item.href)} className="cursor-pointer border-b border-v2-border transition-colors hover:bg-v2-surface-hover">
                  <td className="px-4 py-2.5"><StatusBadge status="neutral">{calendarItemTypeLabel(item.itemType)}</StatusBadge></td>
                  <td className="max-w-xs truncate px-2 py-2.5 text-sm text-v2-fg">{item.title}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-sm text-v2-muted">{calendarMetaText(item, 'assigneeName') ?? '-'}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-xs text-v2-muted">{fmtTime(item.endAt).slice(5)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={item.overdue ? 'danger' : statusTone(item.status)}>{item.overdue ? '已逾期' : statusLabel(item.status)}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  )
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-lg border border-v2-border bg-v2-surface-soft px-3 py-2"><div className={`text-xl font-bold ${tone}`}>{value}</div><div className="text-xs text-v2-muted">{label}</div></div>
}
