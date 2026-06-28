'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { DailyReportForm } from '@/components/daily/DailyReportForm'
import { CiInstanceItem } from '@/components/daily/CiInstanceMultiSelect'
import api from '@/lib/api'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { useQuery } from '@tanstack/react-query'
import { Label } from '@/components/v2/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { Card, CardContent } from '@/components/v2/Card'
import { PageHeader } from '@/components/shared'

interface Group {
  id: number
  name: string
}

function NewDailyReportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillDate = searchParams.get('date') ?? undefined
  const groupId = useAuthStore((s) => s.groupId)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')

  const needsGroupSelect = groupId == null
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => r.data.data?.records ?? r.data.data ?? []),
    enabled: needsGroupSelect,
  })

  const handleSave = async (data: {
    reportDate: string
    completedItems: string
    issues: string
    tomorrowPlan: string
    workHours: string
    ciInstances: CiInstanceItem[]
  }) => {
    const effectiveGroupId = groupId ?? (selectedGroupId ? Number(selectedGroupId) : undefined)
    if (!effectiveGroupId) {
      toast.error('请先选择所属组')
      return
    }
    await api.post('/daily-reports', {
      reportDate: data.reportDate,
      completedItems: data.completedItems,
      issues: data.issues,
      tomorrowPlan: data.tomorrowPlan,
      workHours: data.workHours ? parseFloat(data.workHours) : null,
      groupId: effectiveGroupId,
      ciInstanceIds: data.ciInstances.map((ci) => ci.id),
    })
    toast.success('日报已保存')
    router.push('/daily')
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="流程中心" title="新建日报" subtitle="填写今日完成事项、问题与明日计划，可关联相关 CI 实例。" />
      {needsGroupSelect && (
        <Card className="max-w-xs">
          <CardContent className="space-y-1.5 p-4">
            <Label>所属组 *</Label>
            <Select value={selectedGroupId} onValueChange={(v) => setSelectedGroupId(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="请选择所属组" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g: Group) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
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
    <Suspense fallback={<p className="text-v2-muted">加载中…</p>}>
      <NewDailyReportContent />
    </Suspense>
  )
}
