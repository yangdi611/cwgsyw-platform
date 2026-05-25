'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { usePermission } from '@/hooks/usePermission'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AuditLogVO {
  id: number
  module: string
  action: string
  targetId: number
  targetType: string
  operatorId: number
  operatorName: string
  operatorIp: string
  remark: string
  createdAt: string
}

interface PageResult {
  records: AuditLogVO[]
  total: number
}

const MODULE_LABELS: Record<string, string> = {
  device: '设备密码库',
  change_doc: '变更文档',
  daily_report: '工作日报',
  sys_config: '系统配置',
  user: '用户管理',
  group: '组管理',
}

const ACTION_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
  approve: 'outline',
  reject: 'destructive',
  view_password: 'secondary',
  submit: 'default',
  ai_generate: 'outline',
}

export default function AuditLogPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()

  useEffect(() => {
    if (!hasPermission('audit', 'read')) router.replace('/')
  }, [hasPermission, router])

  const [module, setModule]       = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [page, setPage]           = useState(1)
  const size = 20

  const { data, isLoading } = useQuery<PageResult>({
    queryKey: ['audit-logs', module, startDate, endDate, page],
    queryFn: () => {
      const params: Record<string, string | number> = { page, size }
      if (module) params.module = module
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      return api.get('/audit-logs', { params }).then(r => r.data.data)
    },
    enabled: hasPermission('audit', 'read'),
  })

  const records = data?.records ?? []
  const hasMore = records.length === size

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">审计日志</h1>

      <div className="flex gap-4 flex-wrap mb-4 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">模块</Label>
          <Select value={module} onValueChange={v => { setModule(v ?? ''); setPage(1) }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="全部" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部模块</SelectItem>
              {Object.entries(MODULE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">开始日期</Label>
          <Input type="date" className="w-40" value={startDate}
            onChange={e => { setStartDate(e.target.value); setPage(1) }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">结束日期</Label>
          <Input type="date" className="w-40" value={endDate}
            onChange={e => { setEndDate(e.target.value); setPage(1) }} />
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          setModule(''); setStartDate(''); setEndDate(''); setPage(1)
        }}>重置</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['时间', '模块', '操作', '操作人', '目标', '备注', 'IP'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">暂无数据</td></tr>
              ) : (
                records.map(log => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-3 py-2 text-xs">{MODULE_LABELS[log.module] ?? log.module}</td>
                    <td className="px-3 py-2">
                      <Badge variant={ACTION_COLORS[log.action] ?? 'secondary'} className="text-xs">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{log.operatorName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {log.targetType}{log.targetId ? ` #${log.targetId}` : ''}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-xs truncate text-muted-foreground">{log.remark}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{log.operatorIp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className="text-sm text-muted-foreground">第 {page} 页，每页 {size} 条</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={!hasMore}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
