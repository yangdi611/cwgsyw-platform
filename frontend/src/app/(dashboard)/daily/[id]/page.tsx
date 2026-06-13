'use client'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  DRAFT:     { label: '草稿',   variant: 'secondary' },
  SUBMITTED: { label: '待审批', variant: 'default' },
  APPROVED:  { label: '已通过', variant: 'outline' },
  REJECTED:  { label: '已拒绝', variant: 'destructive' },
}

export default function DailyReportDetailPage() {
  const { id } = useParams()
  const { hasPermission } = usePermission()
  const [showApproval, setShowApproval] = useState(false)

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['daily-report', id],
    queryFn: () => api.get(`/daily-reports/${id}`).then(r => r.data.data as DailyReportDetail),
  })

  // Find pending workflow task for this report (only needed if user can approve)
  const { data: tasks = [] } = useQuery<TaskVO[]>({
    queryKey: ['workflow-tasks'],
    queryFn: () => api.get('/workflow/tasks/group').then(r => r.data.data),
    enabled: hasPermission('daily_report', 'approve'),
  })

  const pendingTask = tasks.find(t => t.business_type === 'daily_report' && t.business_id === Number(id))

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>
  if (!report) return <p className="text-destructive">日报不存在</p>

  const st = STATUS_MAP[report.status] ?? { label: report.status, variant: 'secondary' as const }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/daily" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Link>
        <h1 className="text-2xl font-bold">{report.report_date} 日报</h1>
        <Badge variant={st.variant}>{st.label}</Badge>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">提交人 / 组别</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {report.reporter_name} · {report.group_name}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">今日完成事项</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{report.completed_items}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">遇到的问题</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{report.issues || '无'}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">明日计划</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{report.tomorrow_plan}</CardContent>
        </Card>
        {report.work_hours && (
          <Card>
            <CardHeader><CardTitle className="text-sm">工时</CardTitle></CardHeader>
            <CardContent className="text-sm">{report.work_hours} 小时</CardContent>
          </Card>
        )}
        {report.ci_instances && report.ci_instances.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">关联 CI 实例</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <div className="flex flex-wrap gap-2">
                {report.ci_instances.map(ci => (
                  <Link
                    key={ci.id}
                    href={`/cmdb/instances/${ci.id}`}
                    className="inline-flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 hover:bg-muted transition-colors"
                  >
                    <span>{ci.name}</span>
                    <Badge variant="outline" className="text-[10px]">{ci.modelName}</Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approval section — shown when there's a pending task for this report */}
        {pendingTask && hasPermission('daily_report', 'approve') && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowApproval(v => !v)}
            >
              {showApproval ? '收起审批' : '审批此日报'}
            </Button>
            {showApproval && (
              <ApprovalActions
                taskId={pendingTask.task_id}
                onDone={() => { setShowApproval(false); refetch() }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
