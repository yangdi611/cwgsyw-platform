'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { DailyReportForm } from '@/components/daily/DailyReportForm'
import api from '@/lib/api'
import { toast } from 'sonner'

function NewDailyReportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillDate = searchParams.get('date') ?? undefined

  const handleSave = async (data: {
    reportDate: string
    completedItems: string
    issues: string
    tomorrowPlan: string
    workHours: string
  }) => {
    await api.post('/daily-reports', {
      report_date: data.reportDate,
      completed_items: data.completedItems,
      issues: data.issues,
      tomorrow_plan: data.tomorrowPlan,
      work_hours: data.workHours ? parseFloat(data.workHours) : null,
    })
    toast.success('日报已保存')
    router.push('/daily')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">新建日报</h1>
      <DailyReportForm
        onSubmit={handleSave}
        defaultValues={prefillDate ? { reportDate: prefillDate } : undefined}
      />
    </div>
  )
}

export default function NewDailyReportPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">加载中...</p>}>
      <NewDailyReportContent />
    </Suspense>
  )
}
