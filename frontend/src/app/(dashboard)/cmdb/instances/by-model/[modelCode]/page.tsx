'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Eye, Upload } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { CsvImportDialog } from '@/components/cmdb/CsvImportDialog'

interface CiInstanceVO {
  id: number
  modelId: string
  modelCode?: string
  displayName?: string
  name: string
  fieldsData: Record<string, unknown>
  createdAt: string
}

interface PageResult {
  records: CiInstanceVO[]
  total: number
  page: number
  size: number
}

interface CiModelVO {
  name: string
  attributes: { fieldKey: string; name: string; isListShow: boolean; fieldType: string }[]
}

export default function InstanceListPage() {
  const { modelCode } = useParams<{ modelCode: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()

  // AC10: CSV 批量导入入口随实例创建一起放在按模型上下文中（全局 /cmdb/instances 已改为纯浏览）。
  const [csvOpen, setCsvOpen] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: model } = useQuery<CiModelVO>({
    queryKey: ['cmdb-model', modelCode],
    queryFn: async () => {
      try {
        const r = await api.get(`/cmdb/models/${modelCode}`)
        return r.data.data
      } catch {
        return undefined
      }
    },
    enabled: isHydrated,
  })

  const { data: result, isLoading } = useQuery<PageResult>({
    queryKey: ['cmdb-instances', modelCode],
    queryFn: () => api.get('/cmdb/instances', { params: { model: modelCode } }).then(r => r.data.data),
    enabled: isHydrated && hasPermission('cmdb_instance', 'read'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/instances/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instances', modelCode] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const listColumns = (model?.attributes ?? [])
    .filter(a => a.isListShow)
    .slice(0, 5)

  const instances = result?.records ?? []

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/cmdb/admin/models/${modelCode}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ArrowLeft className="h-4 w-4 mr-1" />返回模型
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{model?.name ?? modelCode} 实例列表</h1>
            <p className="text-xs text-muted-foreground mt-0.5">共 {result?.total ?? 0} 条</p>
          </div>
        </div>
        <div className="flex gap-2">
          {hasPermission('cmdb_instance', 'import') && (
            <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />导入 CSV
            </Button>
          )}
          {hasPermission('cmdb_instance', 'create') && (
            <Link href={`/cmdb/instances/by-model/${modelCode}/new`} className={buttonVariants({ size: 'sm' })}>
              <Plus className="h-4 w-4 mr-1" />新建实例
            </Link>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">实例名称</th>
                {listColumns.map(col => (
                  <th key={col.fieldKey} className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">
                    {col.name}
                  </th>
                ))}
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">创建时间</th>
                <th className="px-4 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {instances.length === 0 ? (
                <tr>
                  <td colSpan={listColumns.length + 3} className="text-center py-12 text-muted-foreground text-sm">
                    暂无实例，点击右上角新建
                  </td>
                </tr>
              ) : (
                instances.map(inst => (
                  <tr key={inst.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {inst.name ?? <span className="text-muted-foreground">#{inst.id}</span>}
                    </td>
                    {listColumns.map(col => (
                      <td key={col.fieldKey} className="px-4 py-3 text-muted-foreground">
                        {String(inst.fieldsData?.[col.fieldKey] ?? '—')}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(inst.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link href={`/cmdb/instances/by-model/${modelCode}/${inst.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 w-7 p-0'}>
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        {hasPermission('cmdb_instance', 'delete') && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                            onClick={() => { if (confirm('删除此实例?')) deleteMutation.mutate(inst.id) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} model={modelCode} />
    </div>
  )
}
