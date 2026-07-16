'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/v2/Card'
import { PageHeader, DataTable, type ColumnDef } from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/v2/Input'
import { Button } from '@/components/v2/Button'

interface ActionCountVO {
  created: number
  updated: number
  deleted: number
  total: number
}

interface DailyCountVO {
  date: string
  created: number
  updated: number
  deleted: number
}

interface TopInstanceVO {
  instanceId: number
  instanceName: string
  modelId: string
  modelName: string
  changeCount: number
}

interface ChangeStatsVO {
  today: ActionCountVO
  thisWeek: ActionCountVO
  thisMonth: ActionCountVO
  dailyBreakdown: DailyCountVO[]
  top10Instances: TopInstanceVO[]
}

function ActionCountCard({
  title,
  data,
  loading,
}: {
  title: string
  data?: ActionCountVO
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-v2-muted">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : data ? (
          <>
            <div className="text-3xl font-bold tabular-nums text-v2-fg">{data.total}</div>
            <div className="mt-2 flex gap-3 text-xs text-v2-muted">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-v2-success" />
                新增 {data.created}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-v2-primary" />
                修改 {data.updated}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-v2-danger" />
                删除 {data.deleted}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-v2-muted">暂无数据</p>
        )}
      </CardContent>
    </Card>
  )
}

function toIso(date: string, endOfDay = false): string | undefined {
  if (!date) return undefined
  if (!endOfDay) return `${date}T00:00:00`
  const [year, month, day] = date.split('-').map(Number)
  const nextDay = new Date(year, month - 1, day + 1)
  return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T00:00:00`
}

function DailyBarChart({ data }: { data: DailyCountVO[] }) {
  if (!data || data.length === 0) return null

  const maxVal = Math.max(...data.map((d) => Math.max(d.created, d.updated, d.deleted, 1)))

  return (
    <div className="space-y-1">
      {data.map((day) => {
        const hCreated = (day.created / maxVal) * 100
        const hUpdated = (day.updated / maxVal) * 100
        const hDeleted = (day.deleted / maxVal) * 100
        return (
          <div key={day.date} className="flex items-center gap-3 text-xs">
            <span className="w-20 shrink-0 text-right text-v2-muted">{day.date.slice(5)}</span>
            <div className="flex h-5 flex-1 items-end gap-px">
              <div
                className="rounded-t bg-v2-success transition-all"
                style={{ width: `${hCreated}%`, height: '100%' }}
                title={`新增 ${day.created}`}
              />
              <div
                className="rounded-t bg-v2-primary transition-all"
                style={{ width: `${hUpdated}%`, height: '100%' }}
                title={`修改 ${day.updated}`}
              />
              <div
                className="rounded-t bg-v2-danger transition-all"
                style={{ width: `${hDeleted}%`, height: '100%' }}
                title={`删除 ${day.deleted}`}
              />
            </div>
            <span className="w-10 text-v2-muted tabular-nums">{day.created + day.updated + day.deleted}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function CmdbChangesStatsPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_change', 'read')) router.replace('/')
  }, [hasPermission, isHydrated, router])

  const hasExplicitRange = !!(startDate || endDate)
  const { data: stats, isLoading } = useQuery<ChangeStatsVO>({
    queryKey: ['cmdb-changes-stats', startDate, endDate],
    queryFn: () => api.get('/cmdb/changes/stats', { params: { from: toIso(startDate), to: toIso(endDate, true) } }).then((r) => r.data.data),
    enabled: isHydrated && hasPermission('cmdb_change', 'read'),
  })

  const topColumns: ColumnDef<TopInstanceVO>[] = [
    {
      key: 'rank',
      title: '#',
      render: (_r, idx) => <span className="text-v2-muted tabular-nums">{idx + 1}</span>,
    },
    {
      key: 'instanceName',
      title: '实例名称',
      render: (r) => <span className="font-semibold text-v2-fg">{r.instanceName}</span>,
    },
    {
      key: 'modelName',
      title: '模型',
      render: (r) => (
        <span className="inline-flex items-center rounded-md border border-v2-border bg-v2-surface-soft px-2 py-0.5 text-xs text-v2-fg">
          {r.modelName}
        </span>
      ),
    },
    {
      key: 'changeCount',
      title: '变更次数',
      align: 'right',
      render: (r) => <span className="font-v2-mono tabular-nums text-v2-fg">{r.changeCount}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CMDB"
        title="变更统计"
        subtitle="CI 实例变更历史统计与趋势分析，按时间维度与活跃实例查看。"
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-v2-border bg-v2-surface p-4">
        <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-40" />
        <span className="text-sm text-v2-muted">至</span>
        <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-40" />
        {hasExplicitRange && <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate('') }}>清除范围</Button>}
        <span className="text-xs text-v2-muted">{hasExplicitRange ? '统计卡、趋势与 Top 10 均按所选范围汇总' : '未选择范围时显示当前今日、本周和本月汇总，趋势与 Top 10 默认最近 30 天'}</span>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${hasExplicitRange ? 'max-w-sm' : 'sm:grid-cols-3'}`}>
        {hasExplicitRange ? (
          <ActionCountCard title="所选范围变更" data={stats?.today} loading={isLoading} />
        ) : (
          <>
            <ActionCountCard title="今日变更" data={stats?.today} loading={isLoading} />
            <ActionCountCard title="本周变更" data={stats?.thisWeek} loading={isLoading} />
            <ActionCountCard title="本月变更" data={stats?.thisMonth} loading={isLoading} />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">每日变更趋势</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : stats?.dailyBreakdown && stats.dailyBreakdown.length > 0 ? (
            <div>
              <div className="mb-3 flex items-center gap-4 text-xs text-v2-muted">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded bg-v2-success" />
                  新增
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded bg-v2-primary" />
                  修改
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded bg-v2-danger" />
                  删除
                </span>
              </div>
              <DailyBarChart data={stats.dailyBreakdown} />
            </div>
          ) : (
            <p className="text-sm text-v2-muted">暂无每日变更数据</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">变更最频繁的实例 (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : stats?.top10Instances && stats.top10Instances.length > 0 ? (
            <DataTable columns={topColumns} data={stats.top10Instances} rowKey={(r) => r.instanceId} />
          ) : (
            <p className="text-sm text-v2-muted">暂无实例变更统计</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
