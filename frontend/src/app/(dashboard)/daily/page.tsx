'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { toast } from 'sonner'

interface DailyReport {
  id: number
  report_date: string
  completed_items: string
  status: string
  work_hours: number
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT:     { label: '草稿',   variant: 'secondary' },
  SUBMITTED: { label: '待审批', variant: 'default' },
  APPROVED:  { label: '已通过', variant: 'outline' },
  REJECTED:  { label: '已拒绝', variant: 'destructive' },
}

export default function DailyReportsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['my-daily-reports'],
    queryFn: () => api.get('/daily-reports/my').then(r => r.data.data.records as DailyReport[]),
  })

  const submitMutation = useMutation({
    mutationFn: (id: number) => api.post(`/daily-reports/${id}/submit`),
    onSuccess: () => {
      toast.success('日报已提交审批')
      queryClient.invalidateQueries({ queryKey: ['my-daily-reports'] })
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '提交失败')
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">我的日报</h1>
        <Link href="/daily/new" className={buttonVariants({ variant: 'default' })}>
          新建日报
        </Link>
      </div>
      {isLoading ? <p className="text-muted-foreground">加载中...</p> : (
        <div className="space-y-3">
          {(data ?? []).map(report => {
            const s = statusConfig[report.status] ?? { label: report.status, variant: 'secondary' as const }
            return (
              <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{report.report_date}</span>
                    <Badge variant={s.variant}>{s.label}</Badge>
                    {report.work_hours && <span className="text-sm text-muted-foreground">{report.work_hours}h</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{report.completed_items}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/daily/${report.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    查看
                  </Link>
                  {(report.status === 'DRAFT' || report.status === 'REJECTED') && (
                    <Button size="sm"
                      onClick={() => submitMutation.mutate(report.id)}
                      disabled={submitMutation.isPending}>
                      提交审批
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          {(data ?? []).length === 0 && (
            <p className="text-muted-foreground text-center py-12">暂无日报，点击右上角新建</p>
          )}
        </div>
      )}
    </div>
  )
}
