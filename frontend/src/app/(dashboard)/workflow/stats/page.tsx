'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card } from '@/components/v2/Card'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { PageHeader, EmptyState } from '@/components/shared'
import { BarChart3 } from 'lucide-react'

interface ProcessStat {
  process_definition_key: string
  name: string
  version: number
  total_started: number
  running_count: number
  finished_count: number
  success_rate: number
  avg_duration_seconds: number
}

function rateVariant(r: number): 'ok' | 'warn' | 'danger' {
  if (r >= 90) return 'ok'
  if (r >= 50) return 'warn'
  return 'danger'
}

function formatDuration(sec: number) {
  if (sec <= 0) return '-'
  if (sec < 60) return `${sec} 秒`
  if (sec < 3600) return `${Math.round(sec / 60)} 分钟`
  return `${(sec / 3600).toFixed(1)} 小时`
}

function StatCell({
  value,
  label,
  tone = 'default',
}: {
  value: string | number
  label: string
  tone?: 'default' | 'primary' | 'success'
}) {
  const color =
    tone === 'primary' ? 'text-v2-primary' : tone === 'success' ? 'text-v2-success' : 'text-v2-fg'
  return (
    <div className="rounded-v2-md bg-v2-surface-soft p-3 text-center">
      <div className={cn('text-2xl font-bold tabular-nums', color)}>{value}</div>
      <div className="mt-0.5 text-xs text-v2-muted">{label}</div>
    </div>
  )
}

export default function WorkflowStatsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['process-stats'],
    queryFn: () => api.get('/workflow/stats').then((r) => (r.data.data ?? []) as ProcessStat[]),
  })

  const stats = data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="流程中心"
        title="流程统计"
        subtitle="按流程定义查看启动量、运行/完成数、通过率与平均审批时长。"
      />

      {isLoading ? null : stats.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BarChart3 className="h-5 w-5 text-v2-muted" />}
            title="暂无流程统计数据"
            description="启动流程实例后即可在此查看统计。"
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          {stats.map((s) => (
            <Card key={s.process_definition_key} className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-v2-fg">{s.name}</h2>
                  <p className="font-v2-mono text-sm text-v2-muted">
                    {s.process_definition_key} · v{s.version}
                  </p>
                </div>
                <StatusBadge status={rateVariant(s.success_rate)}>
                  {s.success_rate}% 通过率
                </StatusBadge>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCell value={s.total_started} label="总实例数" />
                <StatCell value={s.running_count} label="运行中" tone="primary" />
                <StatCell value={s.finished_count} label="已完成" tone="success" />
                <StatCell value={formatDuration(s.avg_duration_seconds)} label="平均审批时长" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
