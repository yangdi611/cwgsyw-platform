'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DashboardFeedbackPage,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  MetricCard,
  PageHeader,
  Table,
} from '@/design-system/figma-neutral/components'

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

function toIso(date: string, endOfDay = false): string | undefined {
  if (!date) return undefined
  if (!endOfDay) return `${date}T00:00:00`
  const [year, month, day] = date.split('-').map(Number)
  const nextDay = new Date(year, month - 1, day + 1)
  return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T00:00:00`
}

function ActionCountCard({ title, data }: { title: string; data?: ActionCountVO }) {
  return (
    <MetricCard
      label={title}
      value={String(data?.total ?? 0)}
      description={`新增 ${data?.created ?? 0} · 修改 ${data?.updated ?? 0} · 删除 ${data?.deleted ?? 0}`}
    />
  )
}

function DailyBarChart({ data }: { data: DailyCountVO[] }) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.created, d.updated, d.deleted, 1)))
  return (
    <div className="cwgsyw-cmdb-change-stats__chart" role="table" aria-label="每日新增、修改和删除变更趋势">
      <div className="cwgsyw-cmdb-change-stats__chart-row is-header" role="row">
        <span role="columnheader">日期</span>
        <span role="columnheader"><i className="is-created" aria-hidden="true" />新增</span>
        <span role="columnheader"><i className="is-updated" aria-hidden="true" />修改</span>
        <span role="columnheader"><i className="is-deleted" aria-hidden="true" />删除</span>
        <span role="columnheader">合计</span>
      </div>
      <div role="rowgroup">
        {data.map((day) => {
          const total = day.created + day.updated + day.deleted
          return (
            <div key={day.date} className="cwgsyw-cmdb-change-stats__chart-row" role="row">
              <time role="cell" dateTime={day.date}>{day.date.slice(5)}</time>
              <span className="cwgsyw-cmdb-change-stats__bar is-created" role="cell">
                <progress max={maxVal} value={day.created} aria-label={`${day.date} 新增 ${day.created}`} />
                <span aria-hidden="true">{day.created}</span>
              </span>
              <span className="cwgsyw-cmdb-change-stats__bar is-updated" role="cell">
                <progress max={maxVal} value={day.updated} aria-label={`${day.date} 修改 ${day.updated}`} />
                <span aria-hidden="true">{day.updated}</span>
              </span>
              <span className="cwgsyw-cmdb-change-stats__bar is-deleted" role="cell">
                <progress max={maxVal} value={day.deleted} aria-label={`${day.date} 删除 ${day.deleted}`} />
                <span aria-hidden="true">{day.deleted}</span>
              </span>
              <strong role="cell">{total}</strong>
            </div>
          )
        })}
      </div>
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
  const invalidDateRange = Boolean(startDate && endDate && startDate > endDate)
  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery<ChangeStatsVO>({
    queryKey: ['cmdb-changes-stats', startDate, endDate],
    queryFn: () => api.get('/cmdb/changes/stats', { params: { from: toIso(startDate), to: toIso(endDate, true) } }).then((r) => r.data.data),
    enabled: isHydrated && hasPermission('cmdb_change', 'read') && !invalidDateRange,
  })

  const canRead = hasPermission('cmdb_change', 'read')
  const pageFeedback = !isHydrated ? (
    <LoadingState label="正在检查访问权限" />
  ) : !canRead ? (
    <ErrorState title="无权查看变更统计" description="需要 CMDB 变更读取权限。" />
  ) : invalidDateRange ? (
    <ErrorState title="日期范围无效" description="结束日期不能早于开始日期，请调整后重试。" />
  ) : isError ? (
    <ErrorState
      title="变更统计加载失败"
      description="无法读取当前统计数据，请稍后重试。"
      retry={<Button type="button" size="sm" variant="secondary" onClick={() => refetch()}>重试</Button>}
    />
  ) : null

  return (
    <DashboardFeedbackPage className="cwgsyw-cmdb-page cwgsyw-cmdb-change-stats"
      header={
        <div className="cwgsyw-cmdb-instance-page cwgsyw-cmdb-change-stats__header">
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="变更统计"
            subtitle="按时间查看变更趋势"
            actions={
              <Button type="button" size="sm" variant="secondary" onClick={() => router.push('/cmdb/changes')}>
                返回变更历史
              </Button>
            }
          />
          <div className="cwgsyw-cmdb-change-stats__range" role="group" aria-label="统计日期范围">
            <div className="cwgsyw-cmdb-change-stats__range-controls">
              <Input size="sm" aria-label="开始日期" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              <span className="cwgsyw-type-label-sm" aria-hidden="true">至</span>
              <Input size="sm" aria-label="结束日期" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              {hasExplicitRange ? <Button type="button" size="sm" variant="ghost" onClick={() => { setStartDate(''); setEndDate('') }}>清除范围</Button> : null}
            </div>
            <p>
              {hasExplicitRange ? '统计卡、趋势与 Top 10 均按所选范围汇总' : '未选择范围时显示今日、本周和本月汇总，趋势与 Top 10 默认最近 30 天'}
            </p>
          </div>
        </div>
      }
      metrics={
        pageFeedback ? null : isLoading ? (
          <LoadingState label="加载统计" />
        ) : hasExplicitRange ? (
          <ActionCountCard title="所选范围变更" data={stats?.today} />
        ) : (
          <>
            <ActionCountCard title="今日变更" data={stats?.today} />
            <ActionCountCard title="本周变更" data={stats?.thisWeek} />
            <ActionCountCard title="本月变更" data={stats?.thisMonth} />
          </>
        )
      }
      feedback={
        pageFeedback ?? (isLoading ? null : (
          <div className="cwgsyw-cmdb-change-stats__feedback">
            <section className="cwgsyw-cmdb-change-stats__panel" aria-labelledby="cmdb-daily-trend-title">
              <header><h2 id="cmdb-daily-trend-title">每日变更趋势</h2></header>
              <div className="cwgsyw-cmdb-change-stats__panel-body">
              {stats?.dailyBreakdown && stats.dailyBreakdown.length > 0 ? (
                <DailyBarChart data={stats.dailyBreakdown} />
              ) : (
                <EmptyState title="暂无每日变更数据" description="所选范围内还没有可汇总的每日记录。" />
              )}
              </div>
            </section>
            <section className="cwgsyw-cmdb-change-stats__panel" aria-labelledby="cmdb-top-instances-title">
              <header><h2 id="cmdb-top-instances-title">变更最频繁的实例（Top 10）</h2></header>
              <div className="cwgsyw-cmdb-change-stats__panel-body">
              {stats?.top10Instances && stats.top10Instances.length > 0 ? (
                <Table
                  className="cwgsyw-cmdb-table cwgsyw-cmdb-change-stats__table"
                  showSearch={false}
                  columns={[
                    { key: 'rank', label: '#' },
                    { key: 'instanceName', label: '实例名称' },
                    { key: 'modelName', label: '模型' },
                    { key: 'changeCount', label: '变更次数' },
                  ]}
                  rows={stats.top10Instances.map((item, index) => ({
                    id: String(item.instanceId),
                    cells: {
                      rank: String(index + 1),
                      instanceName: item.instanceName || `#${item.instanceId}`,
                      modelName: item.modelName || item.modelId || '—',
                      changeCount: String(item.changeCount),
                    },
                  }))}
                />
              ) : (
                <EmptyState title="暂无实例变更统计" description="所选范围内没有可排名的实例记录。" />
              )}
              </div>
            </section>
          </div>
        ))
      }
    />
  )
}
