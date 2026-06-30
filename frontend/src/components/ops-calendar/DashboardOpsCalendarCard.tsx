'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card, CardHeader, CardTitle } from '@/components/v2/Card'
import { TaskStatusBadge, TaskTypeBadge } from './TaskBadges'
import { type DashboardCalendarVO, fmtTime } from '@/lib/opsCalendar'

/** 工作台「运维日历」卡片，替换原「近期 CMDB 变更」。 */
export function DashboardOpsCalendarCard() {
  const router = useRouter()

  const { data } = useQuery<DashboardCalendarVO | undefined>({
    queryKey: ['ops-calendar-dashboard'],
    queryFn: () => api.get('/ops-calendar/tasks/dashboard').then((r) => r.data.data).catch(() => undefined),
  })

  const items = data?.items ?? []
  const hints = data?.nextHints ?? []

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>运维日历</CardTitle>
            <p className="text-sm text-v2-muted mt-1">今日待办、待确认与逾期任务，点击进入完整日历。</p>
          </div>
          <Link href="/ops-calendar" className="text-sm font-bold text-v2-primary hover:text-v2-primary-hover whitespace-nowrap">
            查看日历 →
          </Link>
        </div>
      </CardHeader>

      {/* 顶部摘要 */}
      <div className="flex gap-3 px-6 pt-4 pb-3">
        <SummaryPill label="今日任务" value={data?.todayTotal ?? 0} tone="text-v2-fg" />
        <SummaryPill label="待确认" value={data?.pendingConfirm ?? 0} tone="text-amber-600" />
        <SummaryPill label="逾期" value={data?.overdue ?? 0} tone="text-red-600" />
      </div>

      <div className="overflow-x-auto">
        {items.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-v2-muted">今日暂无运维任务</p>
        ) : (
          <table className="w-full">
            <tbody>
              {items.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/ops-calendar?taskId=${t.id}`)}
                  className="border-b border-v2-border hover:bg-v2-surface-hover transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2.5"><TaskTypeBadge taskType={t.taskType} /></td>
                  <td className="px-2 py-2.5 text-sm text-v2-fg max-w-xs truncate">{t.title}</td>
                  <td className="px-2 py-2.5 text-sm text-v2-muted whitespace-nowrap">{t.assigneeName ?? '-'}</td>
                  <td className="px-2 py-2.5 text-xs text-v2-muted whitespace-nowrap">{t.dueAt ? fmtTime(t.dueAt).slice(5) : '-'}</td>
                  <td className="px-4 py-2.5"><TaskStatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {hints.length > 0 && (
        <div className="px-6 py-3 border-t border-v2-border">
          <p className="text-xs text-v2-muted mb-1.5">即将到来</p>
          <div className="flex flex-wrap gap-2">
            {hints.map((h, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded-md bg-v2-surface-soft text-v2-fg">
                {h.date?.slice(5)} · {h.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex-1 rounded-lg border border-v2-border bg-v2-surface-soft px-3 py-2">
      <div className={`text-xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-v2-muted">{label}</div>
    </div>
  )
}
