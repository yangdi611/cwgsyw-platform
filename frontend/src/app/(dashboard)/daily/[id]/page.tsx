'use client'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/v2/Card'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { ApprovalActions } from '@/components/daily/ApprovalActions'
import { usePermission } from '@/hooks/usePermission'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'

interface DailyReportDetail {
  id: number
  reporter_name: string
  group_name: string
  report_date: string
  completed_items: string
  issues: string
  tomorrow_plan: string
  work_hours: number
  status: string
  ci_instance_ids: number[]
  ci_instances: { id: number; name: string; modelName: string }[]
}

interface TaskVO {
  task_id: string
  business_type: string
  business_id: number
}

type StatusVariant = 'ok' | 'warn' | 'danger' | 'neutral'

function statusMeta(s: string): { variant: StatusVariant; label: string } {
  if (s === 'DRAFT') return { variant: 'neutral', label: '草稿' }
  if (s === 'SUBMITTED') return { variant: 'warn', label: '待审批' }
  if (s === 'APPROVED') return { variant: 'ok', label: '已通过' }
  if (s === 'REJECTED') return { variant: 'danger', label: '已拒绝' }
  return { variant: 'neutral', label: s || '未知' }
}

export default function DailyReportDetailPage() {
  const { id } = useParams()
  const { hasPermission } = usePermission()
  const [showApproval, setShowApproval] = useState(false)

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['daily-report', id],
    queryFn: () => api.get(`/daily-reports/${id}`).then((r) => r.data.data as DailyReportDetail),
  })

  const { data: tasks = [] } = useQuery<TaskVO[]>({
    queryKey: ['workflow-tasks'],
    queryFn: () => api.get('/workflow/tasks/group').then((r) => r.data.data),
    enabled: hasPermission('daily_report', 'approve'),
  })

  const pendingTask = tasks.find(
    (t) => t.business_type === 'daily_report' && t.business_id === Number(id),
  )

  if (isLoading) return <p className="text-v2-muted">加载中…</p>
  if (!report) return <p className="text-v2-danger">日报不存在</p>

  const st = statusMeta(report.status)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/daily"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Link>
        <h1 className="text-2xl font-bold text-v2-fg">{report.report_date} 日报</h1>
        <StatusBadge status={st.variant}>{st.label}</StatusBadge>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">提交人 / 组别</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-v2-muted">
            {report.reporter_name} · {report.group_name}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">今日完成事项</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-v2-fg">
            {report.completed_items}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">遇到的问题</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-v2-fg">
            {report.issues || '无'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">明日计划</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-v2-fg">
            {report.tomorrow_plan}
          </CardContent>
        </Card>
        {report.work_hours && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">工时</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-v2-fg">{report.work_hours} 小时</CardContent>
          </Card>
        )}
        {report.ci_instances && report.ci_instances.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">关联 CI 实例</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {report.ci_instances.map((ci) => (
                  <Link
                    key={ci.id}
                    href={`/cmdb/instances/by-model/host/${ci.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-v2-border bg-v2-surface px-2.5 py-1.5 transition-colors hover:bg-v2-surface-hover"
                  >
                    <span className="text-sm text-v2-fg">{ci.name}</span>
                    <span className="rounded border border-v2-border bg-v2-surface-soft px-1 text-[10px] text-v2-muted">
                      {ci.modelName}
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {pendingTask && hasPermission('daily_report', 'approve') && (
          <div>
            <Button variant="secondary" size="sm" onClick={() => setShowApproval((v) => !v)}>
              {showApproval ? '收起审批' : '审批此日报'}
            </Button>
            {showApproval && (
              <ApprovalActions
                taskId={pendingTask.task_id}
                onDone={() => {
                  setShowApproval(false)
                  refetch()
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
