'use client'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
}

export default function DailyReportDetailPage() {
  const { id } = useParams()
  const { data: report, isLoading } = useQuery({
    queryKey: ['daily-report', id],
    queryFn: () => api.get(`/daily-reports/${id}`).then(r => r.data.data as DailyReportDetail),
  })

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>
  if (!report) return <p className="text-destructive">日报不存在</p>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{report.report_date} 日报</h1>
        <Badge>{report.status}</Badge>
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
      </div>
    </div>
  )
}
