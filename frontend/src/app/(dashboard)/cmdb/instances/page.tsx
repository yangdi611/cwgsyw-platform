'use client'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, ChevronLeft, ChevronRight, Eye, Grid3x3 } from 'lucide-react'

// AC10 (Issue #64): 本页为纯浏览页（跨模型实例检索）。实例新建/删除/导入走各模型的
// 浏览页 /cmdb/instances/by-model/[modelCode]。
interface CiModelVO {
  id: number; name: string; displayName: string; group: string; groupName: string
  isBuiltIn: boolean; instanceCount: number; attributes: any[]; createdAt: string; updatedAt: string
}

interface CiInstanceVO {
  id: number; name: string; modelId: string; modelName: string
  status: string; owner: string; description: string
  fieldsData: Record<string, any>; createdAt: string; updatedAt: string
}

export default function CmdbInstancesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission } = usePermission()

  const [model, setModel] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const size = 20

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  // Auto-set model from URL param
  useEffect(() => {
    const m = searchParams.get('model')
    if (m) setModel(m)
  }, [searchParams])

  // Fetch models for filter
  const { data: models = [] } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models-all'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models', { params: { size: 100 } })
        return r.data.data.records
      } catch {
        return []
      }
    },
    enabled: typeof window !== 'undefined',
  })

  // Fetch instances
  const { data, isLoading } = useQuery({
    queryKey: ['cmdb-instances', model, keyword, status, page],
    queryFn: () => api.get('/cmdb/instances', {
      params: {
        model: model || undefined,
        keyword: keyword || undefined,
        status: status || undefined,
        page, size,
      },
    }).then(r => r.data.data),
    enabled: hasPermission('cmdb_instance', 'read'),
  })

  const instances = (data?.records ?? []) as CiInstanceVO[]
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / size)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">CMDB 实例</h1>
        <div className="flex gap-2">
          <Link href="/cmdb/instances/2d-view" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Grid3x3 className="h-4 w-4 mr-1" />2D 视图
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={model} onValueChange={v => { setModel((v ?? '') === '__all__' ? '' : (v ?? '')); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="全部模型" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部模型</SelectItem>
            {models.map(m => <SelectItem key={m.name} value={m.name}>{m.displayName}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="搜索实例名称..." value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1) }} />
        </div>

        <Select value={status} onValueChange={v => { setStatus((v ?? '') === '__all__' ? '' : (v ?? '')); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部状态</SelectItem>
            <SelectItem value="running">运行中</SelectItem>
            <SelectItem value="stopped">已停用</SelectItem>
            <SelectItem value="maintenance">维护中</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : instances.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">暂无实例数据</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map(inst => (
                <TableRow key={inst.id}>
                  <TableCell className="text-muted-foreground">{inst.id}</TableCell>
                  <TableCell>
                    <Link href={`/cmdb/instances/by-model/${inst.modelId}/${inst.id}`} className="font-medium hover:underline">
                      {inst.name}
                    </Link>
                  </TableCell>
                  <TableCell><Badge variant="outline">{inst.modelName}</Badge></TableCell>
                  <TableCell>{inst.status || '-'}</TableCell>
                  <TableCell>{inst.owner || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(inst.updatedAt).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/cmdb/instances/by-model/${inst.modelId}/${inst.id}`}>
                      <Button size="sm" variant="ghost"><Eye className="h-3.5 w-3.5" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">共 {total} 条</span>
            <div className="flex gap-2 items-center">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">{page} / {totalPages || 1}</span>
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
