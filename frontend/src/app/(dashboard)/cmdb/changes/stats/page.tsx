'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Card,
  DashboardFeedbackPage,
  EmptyState,
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
    <div className="cwgsyw-stack-list">
      {data.map((day) => (
        <div key={day.date} className="cwgsyw-inline-controls">
          <span className="cwgsyw-type-label-sm">{day.date.slice(5)}</span>
          <span className="cwgsyw-type-label-sm" style={{ background: 'var(--cwgsyw-status-success-fg)', width: `${(day.created / maxVal) * 100}%`, height: 8 }} />
          <span className="cwgsyw-type-label-sm" style={{ background: 'var(--cwgsyw-neutral-600)', width: `${(day.updated / maxVal) * 100}%`, height: 8 }} />
          <span className="cwgsyw-type-label-sm" style={{ background: 'var(--cwgsyw-status-danger-fg)', width: `${(day.deleted / maxVal) * 100}%`, height: 8 }} />
          <span className="cwgsyw-type-label-sm">{day.created + day.updated + day.deleted}</span>
        </div>
      ))}
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

  return (
    <DashboardFeedbackPage className="cwgsyw-cmdb-page"
      header={
        <div className="cwgsyw-cmdb-instance-page">
        <PageHeader
            showEyebrow={false}
          title="变更统计"
          subtitle="按时间查看变更趋势"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/cmdb/changes', label: '变更历史' },
                { label: '变更统计' },
              ]}
            />
          }
        />
        </div>
      }
      supporting={
        <div className="cwgsyw-inline-controls">
          <Input size="sm" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <span className="cwgsyw-type-label-sm">至</span>
          <Input size="sm" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          {hasExplicitRange ? <Button type="button" variant="ghost" onClick={() => { setStartDate(''); setEndDate('') }}>清除范围</Button> : null}
          <span className="cwgsyw-type-label-sm">
            {hasExplicitRange ? '统计卡、趋势与 Top 10 均按所选范围汇总' : '未选择范围时显示当前今日、本周和本月汇总，趋势与 Top 10 默认最近 30 天'}
          </span>
        </div>
      }
      metrics={
        isLoading ? (
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
        isLoading ? null : (
          <div className="cwgsyw-stack-list">
            <Card title="每日变更趋势">
              {stats?.dailyBreakdown && stats.dailyBreakdown.length > 0 ? (
                <DailyBarChart data={stats.dailyBreakdown} />
              ) : (
                <EmptyState title="暂无每日变更数据" />
              )}
            </Card>
            <Card title="变更最频繁的实例 (Top 10)">
              {stats?.top10Instances && stats.top10Instances.length > 0 ? (
                <Table
              className="cwgsyw-cmdb-table"
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
                      instanceName: item.instanceName,
                      modelName: item.modelName,
                      changeCount: String(item.changeCount),
                    },
                  }))}
                />
              ) : (
                <EmptyState title="暂无实例变更统计" />
              )}
            </Card>
          </div>
        )
      }
    />
  )
}
