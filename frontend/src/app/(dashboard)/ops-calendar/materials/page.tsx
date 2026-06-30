'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getToken } from '@/lib/auth'
import { usePermission } from '@/hooks/usePermission'
import { PageHeader } from '@/components/shared'
import { Card, CardHeader, CardTitle } from '@/components/v2/Card'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { TaskTypeBadge, TaskStatusBadge } from '@/components/ops-calendar/TaskBadges'
import { ymd, errMsg } from '@/lib/opsCalendar'
import { ArrowLeft, Download, FolderArchive } from 'lucide-react'

interface LinkRef { linkType: string; linkId: number | null; linkTitle: string | null }
interface MaterialItem {
  taskId: number; title: string; taskType: string; status: string
  resultStatus: string | null; resultSummary: string | null; riskLevel: string | null
  completedAt: string | null; assigneeName: string | null; links: LinkRef[]
}
interface MaterialVO {
  periodType: string; startDate: string; endDate: string
  totalTasks: number; completedTasks: number; overdueTasks: number; exceptionTasks: number
  typeBreakdown: Record<string, number>; items: MaterialItem[]
}

export default function MaterialsPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()

  useEffect(() => {
    if (!hasPermission('ops_calendar', 'export')) router.replace('/ops-calendar')
  }, [hasPermission, router])

  const today = new Date()
  const [periodType, setPeriodType] = useState('quarter')
  const [startDate, setStartDate] = useState(ymd(new Date(today.getFullYear(), today.getMonth() - 2, 1)))
  const [endDate, setEndDate] = useState(ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)))
  const [query, setQuery] = useState<{ start: string; end: string; period: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ops-materials', query?.start, query?.end, query?.period],
    queryFn: () => api.get('/ops-calendar/report-materials', {
      params: { periodType: query!.period, startDate: query!.start, endDate: query!.end },
    }).then((r) => r.data.data as MaterialVO),
    enabled: !!query,
  })

  function run() {
    if (!startDate || !endDate) { toast.error('请选择起止日期'); return }
    setQuery({ start: startDate, end: endDate, period: periodType })
  }

  async function exportExcel() {
    try {
      const token = getToken()
      const url = `/api/ops-calendar/report-materials/export?periodType=${periodType}&startDate=${startDate}&endDate=${endDate}`
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!res.ok) throw new Error('导出失败 ' + res.status)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `运维素材_${startDate}_${endDate}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      toast.error(errMsg(e, '导出失败'))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="运维日历"
        title="报表素材归集"
        subtitle="按季度/半年归集任务执行情况与关联对象，供季报、半年报、考核与审计取材。"
        actions={
          <Button variant="ghost" onClick={() => router.push('/ops-calendar')}>
            <ArrowLeft className="h-4 w-4" />返回
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>周期类型</Label>
          <Select value={periodType} onValueChange={(v) => setPeriodType(v ?? 'quarter')}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="quarter">季度</SelectItem>
              <SelectItem value="semiannual">半年</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>开始</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label>结束</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <Button variant="primary" onClick={run}><FolderArchive className="h-4 w-4" />归集</Button>
        <Button variant="secondary" onClick={exportExcel}><Download className="h-4 w-4" />导出 Excel</Button>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="任务总数" value={data.totalTasks} />
          <Stat label="已完成" value={data.completedTasks} tone="text-green-600" />
          <Stat label="已逾期" value={data.overdueTasks} tone="text-red-600" />
          <Stat label="异常关闭" value={data.exceptionTasks} tone="text-amber-600" />
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>素材清单</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          {!query ? (
            <p className="px-6 py-12 text-center text-sm text-v2-muted">选择周期后点击「归集」。</p>
          ) : isLoading ? (
            <p className="px-6 py-12 text-center text-sm text-v2-muted">加载中…</p>
          ) : !data || data.items.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-v2-muted">该周期内暂无任务素材。</p>
          ) : (
            <table className="w-full">
              <thead className="bg-v2-surface-soft">
                <tr>
                  {['标题', '类型', '状态', '结论', '完成时间', '负责人', '关联'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-v2-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((it) => (
                  <tr key={it.taskId} className="border-b border-v2-border hover:bg-v2-surface-hover transition-colors">
                    <td className="px-4 py-2.5 text-sm text-v2-fg max-w-xs truncate">{it.title}</td>
                    <td className="px-4 py-2.5"><TaskTypeBadge taskType={it.taskType} /></td>
                    <td className="px-4 py-2.5"><TaskStatusBadge status={it.status} /></td>
                    <td className="px-4 py-2.5 text-sm text-v2-muted">{it.resultStatus ?? '-'}</td>
                    <td className="px-4 py-2.5 text-xs text-v2-muted whitespace-nowrap">{it.completedAt ?? '-'}</td>
                    <td className="px-4 py-2.5 text-sm text-v2-muted">{it.assigneeName ?? '-'}</td>
                    <td className="px-4 py-2.5 text-xs text-v2-muted">
                      {it.links && it.links.length > 0 ? it.links.map((l) => `${l.linkType}#${l.linkId}`).join(', ') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}

function Stat({ label, value, tone = 'text-v2-fg' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-v2-border bg-v2-surface-soft px-4 py-3">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-v2-muted mt-0.5">{label}</div>
    </div>
  )
}
