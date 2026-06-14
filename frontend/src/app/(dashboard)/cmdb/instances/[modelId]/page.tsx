'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Eye, Pencil, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiInstanceVO {
  id: number
  model_id: string
  name: string
  attrs: Record<string, unknown>
  created_at: string
  created_by_name: string
}

interface PageResult {
  records: CiInstanceVO[]
  total: number
  page: number
  size: number
}

interface CiAttributeVO {
  field_key: string
  name: string
  is_list_show: boolean
  field_type: string
}

interface CiModelVO {
  model_id: string
  name: string
  attributes: CiAttributeVO[]
}

/** 渲染动态属性值：数组用逗号拼接，对象转 JSON，空值显示 — */
function renderAttrValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function InstanceListPage() {
  const { modelId } = useParams<{ modelId: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const size = 20

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: model } = useQuery<CiModelVO>({
    queryKey: ['cmdb-model', modelId],
    queryFn: () => api.get(`/cmdb/meta/models/${modelId}`).then(r => r.data.data),
  })

  const { data: result, isLoading } = useQuery<PageResult>({
    queryKey: ['cmdb-instances', modelId, keyword, page, size],
    queryFn: () => api.get(`/cmdb/instances/${modelId}`, {
      params: { page, size, keyword: keyword || undefined },
    }).then(r => r.data.data),
    enabled: hasPermission('cmdb_instance', 'read'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/instances/${modelId}/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instances', modelId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  // 列表展示属性：按 is_list_show 过滤，全部展示（横向滚动）
  const listColumns = (model?.attributes ?? []).filter(a => a.is_list_show)

  const instances = result?.records ?? []
  const total = result?.total ?? 0
  const totalPages = Math.ceil(total / size)
  // 空数据行跨列数：名称 + 动态属性 + 创建人 + 创建时间 + 操作
  const colSpan = listColumns.length + 4

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/cmdb/admin/models/${modelId}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ArrowLeft className="h-4 w-4 mr-1" />返回模型
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{model?.name ?? modelId} 实例列表</h1>
            <p className="text-xs text-muted-foreground mt-0.5">共 {total} 条</p>
          </div>
        </div>
        {hasPermission('cmdb_instance', 'create') && (
          <Link href={`/cmdb/instances/${modelId}/new`} className={buttonVariants({ size: 'sm' })}>
            <Plus className="h-4 w-4 mr-1" />新建实例
          </Link>
        )}
      </div>

      {/* 搜索 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="搜索实例名称或属性..."
            value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      {/* 表格 */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>实例名称</TableHead>
                  {listColumns.map(col => (
                    <TableHead key={col.field_key}>{col.name}</TableHead>
                  ))}
                  <TableHead>创建人</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right w-28">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="text-center py-12 text-muted-foreground text-sm">
                      暂无实例，点击右上角新建
                    </TableCell>
                  </TableRow>
                ) : (
                  instances.map(inst => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">
                        {inst.name ?? <span className="text-muted-foreground">#{inst.id}</span>}
                      </TableCell>
                      {listColumns.map(col => (
                        <TableCell key={col.field_key} className="text-muted-foreground">
                          {renderAttrValue(inst.attrs?.[col.field_key])}
                        </TableCell>
                      ))}
                      <TableCell className="text-muted-foreground">{inst.created_by_name || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {inst.created_at ? new Date(inst.created_at).toLocaleDateString('zh-CN') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/cmdb/instances/${modelId}/${inst.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 w-7 p-0'} title="查看">
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          {hasPermission('cmdb_instance', 'update') && (
                            <Link href={`/cmdb/instances/${modelId}/${inst.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 w-7 p-0'} title="编辑">
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          {hasPermission('cmdb_instance', 'delete') && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="删除"
                              onClick={() => { if (confirm('删除此实例?')) deleteMutation.mutate(inst.id) }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          {total > 0 && (
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
          )}
        </>
      )}
    </div>
  )
}
