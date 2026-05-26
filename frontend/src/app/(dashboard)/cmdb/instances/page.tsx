'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ChevronLeft, Plus, Trash2, Eye } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { useColumnConfig } from '@/hooks/useColumnConfig'
import { ColumnPicker, ColumnDef } from '@/components/cmdb/ColumnPicker'
import { cn } from '@/lib/utils'

interface CiModelVO {
  id: number
  model_id: string
  name: string
  group_code: string
  is_built_in: boolean
}

interface CiAttributeVO {
  field_key: string
  name: string
  is_list_show: boolean
  sort_order: number
}

interface CiModelDetailVO {
  model_id: string
  name: string
  attributes: CiAttributeVO[]
}

interface CiInstanceVO {
  id: number
  name: string
  attrs: Record<string, unknown>
  created_at: string
}

interface PageResult<T> {
  records: T[]
  total: number
}

function CiResourcesInner() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    searchParams.get('model')
  )
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['未分类']))

  const { data: models = [] } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models'],
    queryFn: () => api.get('/cmdb/meta/models').then(r => r.data.data),
  })

  const { data: modelDetail } = useQuery<CiModelDetailVO>({
    queryKey: ['cmdb-model', selectedModelId],
    queryFn: () => api.get(`/cmdb/meta/models/${selectedModelId}`).then(r => r.data.data),
    enabled: !!selectedModelId,
  })

  const { data: instanceResult, isLoading: instancesLoading } = useQuery<PageResult<CiInstanceVO>>({
    queryKey: ['cmdb-instances', selectedModelId],
    queryFn: () => api.get(`/cmdb/instances/${selectedModelId}`).then(r => r.data.data),
    enabled: !!selectedModelId,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/instances/${selectedModelId}/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instances', selectedModelId] })
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '删除失败')
    },
  })

  const listShowCols = (modelDetail?.attributes ?? [])
    .filter(a => a.is_list_show)
    .sort((a, b) => a.sort_order - b.sort_order)

  const allColDefs: ColumnDef[] = [
    { key: '_name', name: '实例名称', required: true },
    ...listShowCols.map(a => ({ key: a.field_key, name: a.name })),
    { key: '_created_at', name: '创建时间' },
  ]
  const defaultKeys = ['_name', ...listShowCols.slice(0, 4).map(a => a.field_key), '_created_at']
  const { visible, toggle } = useColumnConfig(selectedModelId ?? 'none', defaultKeys)

  const grouped = models.reduce((acc, m) => {
    const g = m.group_code || '未分类'
    if (!acc[g]) acc[g] = []
    acc[g].push(m)
    return acc
  }, {} as Record<string, CiModelVO[]>)

  const toggleGroup = (g: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(g) ? next.delete(g) : next.add(g)
      return next
    })
  }

  const instances = instanceResult?.records ?? []

  return (
    <div className="flex gap-0 -m-6 h-[calc(100vh-4rem)]">
      {/* 左侧模型树 */}
      <div className="w-52 border-r flex-shrink-0 overflow-y-auto p-2 space-y-0.5 bg-background">
        <p className="text-xs text-muted-foreground px-2 py-2 font-medium uppercase tracking-wider">CI 模型</p>
        {Object.entries(grouped).map(([group, groupModels]) => (
          <div key={group}>
            <button
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expandedGroups.has(group)
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronRight className="h-3 w-3" />}
              <span className="font-medium">{group}</span>
            </button>
            {expandedGroups.has(group) && groupModels.map(m => (
              <button
                key={m.model_id}
                onClick={() => setSelectedModelId(m.model_id)}
                className={cn(
                  'w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ml-2',
                  selectedModelId === m.model_id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {m.name}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* 右侧实例表格 */}
      <div className="flex-1 overflow-auto p-6">
        {!selectedModelId ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
            <ChevronLeft className="h-8 w-8 opacity-30" />
            <p className="text-sm">从左侧选择一个 CI 模型</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">
                  {modelDetail?.name ?? selectedModelId}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  共 {instanceResult?.total ?? 0} 条
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ColumnPicker
                  allColumns={allColDefs}
                  visibleKeys={visible}
                  onToggle={toggle}
                />
                {hasPermission('cmdb_instance', 'create') && (
                  <Link
                    href={`/cmdb/instances/${selectedModelId}/new`}
                    className={buttonVariants({ size: 'sm' })}
                  >
                    <Plus className="h-4 w-4 mr-1" />新建实例
                  </Link>
                )}
              </div>
            </div>

            {instancesLoading ? (
              <p className="text-muted-foreground text-sm">加载中...</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {allColDefs.filter(c => visible.includes(c.key)).map(col => (
                        <th
                          key={col.key}
                          className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium group"
                        >
                          <span className="flex items-center gap-1">
                            {col.name}
                            {!col.required && (
                              <button
                                onClick={() => toggle(col.key)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive text-muted-foreground"
                                title="隐藏此列"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {instances.length === 0 ? (
                      <tr>
                        <td
                          colSpan={visible.length + 1}
                          className="text-center py-12 text-muted-foreground text-sm"
                        >
                          暂无实例，点击右上角新建
                        </td>
                      </tr>
                    ) : instances.map(inst => (
                      <tr key={inst.id} className="hover:bg-muted/30">
                        {allColDefs.filter(c => visible.includes(c.key)).map(col => (
                          <td key={col.key} className="px-4 py-3">
                            {col.key === '_name' && (
                              <span className="font-medium">
                                {inst.name ?? <span className="text-muted-foreground">#{inst.id}</span>}
                              </span>
                            )}
                            {col.key === '_created_at' && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(inst.created_at).toLocaleDateString('zh-CN')}
                              </span>
                            )}
                            {col.key !== '_name' && col.key !== '_created_at' && (
                              <span className="text-muted-foreground">
                                {String(inst.attrs?.[col.key] ?? '—')}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Link
                              href={`/cmdb/instances/${selectedModelId}/${inst.id}`}
                              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 w-7 p-0')}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                            {hasPermission('cmdb_instance', 'delete') && (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-destructive"
                                disabled={deleteMutation.isPending}
                                onClick={() => {
                                  if (confirm('删除此实例?')) deleteMutation.mutate(inst.id)
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function CiResourcesPage() {
  return (
    <Suspense>
      <CiResourcesInner />
    </Suspense>
  )
}
