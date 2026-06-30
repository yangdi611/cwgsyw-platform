'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { PageHeader } from '@/components/shared'
import { Card, CardHeader, CardTitle } from '@/components/v2/Card'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { ymd, taskTypeLabel, statusLabel, taskTypeColor } from '@/lib/opsCalendar'
import { ArrowLeft, BarChart2 } from 'lucide-react'

interface AssigneeLoad { assigneeId: number; assigneeName: string; total: number; overdue: number; completed: number }
interface DailyTrend { date: string; created: number; completed: number; overdue: number }
interface StatsVO {
  startDate: string; endDate: string
  total: number; completed: number; overdue: number; exceptionClosed: number; cancelled: number
  completionRate: number; overdueRate: number
  typeBreakdown: Record<string, number>
  statusBreakdown: Record<string, number>
  dailyTrend: DailyTrend[]
  assigneeLoad: AssigneeLoad[]
  overdueRanking: AssigneeLoad[]
}

export default function StatsPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()

  useEffect(() => {
    if (!hasPermission('ops_calendar', 'read')) router.replace('/ops-calendar')
  }, [hasPermission, router])

  const today = new Date()
  const [startDate, setStartDate] = useState(ymd(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [endDate, setEndDate] = useState(ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)))
  const [query, setQuery] = useState<{ start: string; end: string }>({
    start: ymd(new Date(today.getFullYear(), today.getMonth(), 1)),
    end: ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['ops-stats', query.start, query.end],
    queryFn: () => api.get('/ops-calendar/stats', { params: { startDate: query.start, endDate: query.end } })
      .then((r) => r.data.data as StatsVO),
  })

  function run() {
    if (!startDate || !endDate) { toast.error('请选择起止日期'); return }
    setQuery({ start: startDate, end: endDate })
  }

  const maxTrend = Math.max(1, ...(data?.dailyTrend ?? []).map((d) => Math.max(d.created, d.completed)))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="运维日历"
        title="统计与复盘"
        subtitle="完成率、逾期率、类型分布、负责人负载与逾期排行，为复盘与考核提供数据。"
        actions={
          <Button variant="ghost" onClick={() => router.push('/ops-calendar')}>
            <ArrowLeft className="h-4 w-4" />返回
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>开始</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label>结束</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <Button variant="primary" onClick={run}><BarChart2 className="h-4 w-4" />统计</Button>
      </div>

      {isLoading && <p className="py-12 text-center text-sm text-v2-muted">加载中…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Metric label="任务总数" value={data.total} />
            <Metric label="已完成" value={data.completed} tone="text-green-600" />
            <Metric label="已逾期" value={data.overdue} tone="text-red-600" />
            <Metric label="异常关闭" value={data.exceptionClosed} tone="text-amber-600" />
            <Metric label="完成率" value={`${data.completionRate}%`} tone="text-green-600" />
            <Metric label="逾期率" value={`${data.overdueRate}%`} tone="text-red-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>类型分布</CardTitle></CardHeader>
              <div className="p-4 space-y-2">
                {Object.keys(data.typeBreakdown).length === 0 ? (
                  <p className="text-sm text-v2-muted text-center py-6">暂无数据</p>
                ) : Object.entries(data.typeBreakdown).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className="w-16 text-v2-fg">{taskTypeLabel(k)}</span>
                    <div className="flex-1 h-4 rounded bg-v2-surface-soft overflow-hidden">
                      <div className="h-full rounded" style={{
                        width: `${Math.round((v / data.total) * 100)}%`,
                        background: taskTypeColor(k),
                      }} />
                    </div>
                    <span className="w-10 text-right text-v2-muted">{v}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader><CardTitle>状态分布</CardTitle></CardHeader>
              <div className="p-4 space-y-2">
                {Object.keys(data.statusBreakdown).length === 0 ? (
                  <p className="text-sm text-v2-muted text-center py-6">暂无数据</p>
                ) : Object.entries(data.statusBreakdown).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className="w-20 text-v2-fg">{statusLabel(k)}</span>
                    <div className="flex-1 h-4 rounded bg-v2-surface-soft overflow-hidden">
                      <div className="h-full rounded bg-v2-primary" style={{ width: `${Math.round((v / data.total) * 100)}%` }} />
                    </div>
                    <span className="w-10 text-right text-v2-muted">{v}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>每日趋势</CardTitle></CardHeader>
            <div className="p-4">
              {data.dailyTrend.length === 0 ? (
                <p className="text-sm text-v2-muted text-center py-6">暂无数据</p>
              ) : (
                <div className="flex items-end gap-1 h-40 overflow-x-auto">
                  {data.dailyTrend.map((d) => (
                    <div key={d.date} className="flex flex-col items-center gap-1 min-w-[28px]" title={`${d.date} 新增${d.created} 完成${d.completed} 逾期${d.overdue}`}>
                      <div className="flex items-end gap-0.5 h-32">
                        <div className="w-2 rounded-t bg-v2-primary" style={{ height: `${(d.created / maxTrend) * 100}%` }} />
                        <div className="w-2 rounded-t bg-green-500" style={{ height: `${(d.completed / maxTrend) * 100}%` }} />
                      </div>
                      <span className="text-[9px] text-v2-subtle rotate-45 origin-left whitespace-nowrap">{d.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-4 mt-3 text-xs text-v2-muted">
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-v2-primary" />新增</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-green-500" />完成</span>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LoadTable title="负责人负载 Top 10" rows={data.assigneeLoad} metric="total" metricLabel="任务数" />
            <LoadTable title="逾期排行 Top 10" rows={data.overdueRanking} metric="overdue" metricLabel="逾期数" />
          </div>
        </>
      )}
    </div>
  )
}

function Metric({ label, value, tone = 'text-v2-fg' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg border border-v2-border bg-v2-surface-soft px-4 py-3">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-v2-muted mt-0.5">{label}</div>
    </div>
  )
}

function LoadTable({ title, rows, metric, metricLabel }: {
  title: string; rows: AssigneeLoad[]; metric: 'total' | 'overdue'; metricLabel: string
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-v2-muted">暂无数据</p>
        ) : (
          <table className="w-full">
            <thead className="bg-v2-surface-soft">
              <tr>
                {['负责人', metricLabel, '完成', '逾期'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-bold text-v2-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.assigneeId} className="border-b border-v2-border">
                  <td className="px-4 py-2 text-sm text-v2-fg">{r.assigneeName}</td>
                  <td className="px-4 py-2 text-sm font-semibold text-v2-fg">{r[metric]}</td>
                  <td className="px-4 py-2 text-sm text-green-600">{r.completed}</td>
                  <td className="px-4 py-2 text-sm text-red-600">{r.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  )
}
