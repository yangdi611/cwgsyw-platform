'use client'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ChangeHistoryVO {
  id: number
  action: string
  operatorId: number
  operatorName: string
  beforeJson: Record<string, any> | null
  afterJson: Record<string, any> | null
  createdAt: string
}

interface CiModelVO {
  id: number; name: string; displayName: string; group: string; groupName: string
  isBuiltIn: boolean; instanceCount: number; attributes: any[]; createdAt: string; updatedAt: string
}

const ACTION_MAP: Record<string, string> = {
  create: '创建', update: '更新', delete: '删除',
}

export default function CmdbChangesPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()

  const [model, setModel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const size = 20

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: models } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models-all'],
    queryFn: () => api.get('/cmdb/models', { params: { size: 100 } }).then(r => r.data.data.records),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['cmdb-changes', model, startDate, endDate, page],
    queryFn: () => api.get('/cmdb/instances/changes', {
      params: { model: model || undefined, startDate: startDate || undefined, endDate: endDate || undefined, page, size },
    }).then(r => r.data.data),
    enabled: hasPermission('cmdb_instance', 'read'),
  })

  const changes = (data?.records ?? []) as ChangeHistoryVO[]
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / size)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">CMDB 变更历史</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={model} onValueChange={v => { setModel(v === '__all__' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="全部模型" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部模型</SelectItem>
            {(models ?? []).map(m => <SelectItem key={m.name} value={m.name}>{m.displayName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1) }} className="w-40" />
        <span className="self-center text-sm text-muted-foreground">至</span>
        <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1) }} className="w-40" />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : changes.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">暂无变更记录</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>操作类型</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>变更内容</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map(ch => (
                <TableRow key={ch.id}>
                  <TableCell>{ACTION_MAP[ch.action] ?? ch.action}</TableCell>
                  <TableCell>{ch.operatorName ?? '-'}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {ch.afterJson ? JSON.stringify(ch.afterJson).slice(0, 100) : '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(ch.createdAt).toLocaleString('zh-CN')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">共 {total} 条</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm self-center">{page} / {totalPages || 1}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
