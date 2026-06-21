'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card, CardContent } from '@/components/v2/Card'
import { PageHeader } from '@/components/shared'
import { Label } from '@/components/v2/Label'
import { Input } from '@/components/v2/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'

interface Group {
  id: number
  name: string
}

function getMonthRange(offset: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(y, d.getMonth() + 1, 0).getDate()
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(lastDay).padStart(2, '0')}` }
}

function getQuarterRange(offset: number) {
  const now = new Date()
  const qRaw = Math.floor(now.getMonth() / 3) + offset
  const y = now.getFullYear() + Math.floor(qRaw / 4)
  const qn = ((qRaw % 4) + 4) % 4
  const startMonth = qn * 3 + 1
  const endMonth = startMonth + 2
  const lastDay = new Date(y, endMonth, 0).getDate()
  const sm = String(startMonth).padStart(2, '0')
  const em = String(endMonth).padStart(2, '0')
  return { start: `${y}-${sm}-01`, end: `${y}-${em}-${String(lastDay).padStart(2, '0')}` }
}

export default function ReportsPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const groupScope = useAuthStore((s) => s.groupScope)
  const isAdmin = groupScope === 'tenant' || groupScope === 'platform'

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('daily_report', 'export')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const [startDate, setStartDate] = useState(() => getMonthRange(0).start)
  const [endDate, setEndDate] = useState(() => getMonthRange(0).end)
  const [groupId, setGroupId] = useState<string>('')
  const [exporting, setExporting] = useState(false)

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => r.data.data?.records ?? r.data.data ?? []),
    enabled: isAdmin,
  })

  const applyPreset = (preset: string) => {
    let r: { start: string; end: string }
    if (preset === 'thisMonth') r = getMonthRange(0)
    else if (preset === 'lastMonth') r = getMonthRange(-1)
    else if (preset === 'thisQuarter') r = getQuarterRange(0)
    else r = getQuarterRange(-1)
    setStartDate(r.start)
    setEndDate(r.end)
  }

  const handleExport = async () => {
    if (!startDate || !endDate) {
      toast.error('请选择日期范围')
      return
    }
    if (startDate > endDate) {
      toast.error('开始日期不能晚于结束日期')
      return
    }
    setExporting(true)
    try {
      const params: Record<string, string> = { startDate, endDate }
      if (groupId) params.groupId = groupId
      const res = await api.get('/reports/export', { params, responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `日报汇总_${startDate}_${endDate}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('报表已导出')
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="报表分析"
        title="报表导出"
        subtitle="导出指定时间段内已审批通过的日报汇总（Excel 格式）。"
      />

      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-1.5">
            <Label>快速选择</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '本月', preset: 'thisMonth' },
                { label: '上月', preset: 'lastMonth' },
                { label: '本季度', preset: 'thisQuarter' },
                { label: '上季度', preset: 'lastQuarter' },
              ].map(({ label, preset }) => (
                <Button key={preset} variant="secondary" size="sm" onClick={() => applyPreset(preset)}>
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>开始日期</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>结束日期</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-1.5">
              <Label>按组过滤（可选）</Label>
              <Select value={groupId} onValueChange={(v) => setGroupId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="全部组" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部组</SelectItem>
                  {groups.map((g: Group) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button variant="primary" onClick={handleExport} disabled={exporting} className="w-full">
            <Download className="h-4 w-4" />
            {exporting ? '导出中…' : '导出 Excel'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
