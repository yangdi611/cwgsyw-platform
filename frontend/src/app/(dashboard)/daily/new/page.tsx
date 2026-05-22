'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { DailyReportForm } from '@/components/daily/DailyReportForm'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Group { id: number; name: string }

function NewDailyReportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillDate = searchParams.get('date') ?? undefined
  const groupId = useAuthStore(s => s.groupId)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')

  // Only fetch groups when user has no group (admin/superadmin)
  const needsGroupSelect = groupId == null
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then(r => r.data.data?.records ?? r.data.data ?? []),
    enabled: needsGroupSelect,
  })

  const handleSave = async (data: {
    reportDate: string
    completedItems: string
    issues: string
    tomorrowPlan: string
    workHours: string
  }) => {
    const effectiveGroupId = groupId ?? (selectedGroupId ? Number(selectedGroupId) : undefined)
    if (!effectiveGroupId) {
      toast.error('请先选择所属组')
      return
    }
    await api.post('/daily-reports', {
      report_date: data.reportDate,
      completed_items: data.completedItems,
      issues: data.issues,
      tomorrow_plan: data.tomorrowPlan,
      work_hours: data.workHours ? parseFloat(data.workHours) : null,
      group_id: effectiveGroupId,
    })
    toast.success('日报已保存')
    router.push('/daily')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">新建日报</h1>
      {needsGroupSelect && (
        <div className="mb-6 max-w-xs space-y-1.5">
          <Label>所属组 *</Label>
          <Select value={selectedGroupId} onValueChange={v => setSelectedGroupId(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="请选择所属组" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g: Group) => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
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
