'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Card,
  DashboardFeedbackPage,
  EmptyState,
  LoadingState,
  MetricCard,
  PageHeader,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

interface ProcessStat {
  processDefinitionKey: string
  name: string
  version: number
  totalStarted: number
  runningCount: number
  finishedCount: number
  successRate: number
  avgDurationSeconds: number
}

function rateTone(r: number): 'success' | 'warning' | 'danger' {
  if (r >= 90) return 'success'
  if (r >= 50) return 'warning'
  return 'danger'
}

function formatDuration(sec: number) {
  if (sec <= 0) return '-'
  if (sec < 60) return `${sec} 秒`
  if (sec < 3600) return `${Math.round(sec / 60)} 分钟`
  return `${(sec / 3600).toFixed(1)} 小时`
}

export default function WorkflowStatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['process-stats'],
    queryFn: () => api.get('/workflow/stats').then((r) => (r.data.data ?? []) as ProcessStat[]),
  })

  const stats = data ?? []

  return (
    <DashboardFeedbackPage
      header={
        <PageHeader
          eyebrow="流程中心"
          title="流程统计"
          subtitle="按流程定义查看启动量、运行/完成数、通过率与平均审批时长。"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/workflow/design', label: '流程中心' },
                { label: '流程统计' },
              ]}
            />
          }
        />
      }
      metrics={
        isLoading ? (
          <LoadingState label="加载流程统计" />
        ) : stats.length === 0 ? (
          <EmptyState title="暂无流程统计数据" description="启动流程实例后即可在此查看统计。" />
        ) : (
          <div className="cwgsyw-form">
            {stats.map((s) => (
              <Card
                key={s.processDefinitionKey}
                title={s.name}
                description={`${s.processDefinitionKey}${s.version != null ? ` · v${s.version}` : ''}`}
                headerAction={<StatusBadge label={`${s.successRate}% 通过率`} status={rateTone(s.successRate)} />}
              >
                <div className="cwgsyw-filter-grid">
                  <MetricCard label="总实例数" value={String(s.totalStarted)} />
                  <MetricCard label="运行中" value={String(s.runningCount)} tone="info" />
                  <MetricCard label="已完成" value={String(s.finishedCount)} tone="success" />
                  <MetricCard label="平均审批时长" value={formatDuration(s.avgDurationSeconds)} />
                </div>
              </Card>
            ))}
          </div>
        )
      }
    />
  )
}
