'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { PageHeader, DataTable, type ColumnDef } from '@/components/shared'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Trash2, Eye, Upload, ArrowLeft } from 'lucide-react'
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
    queryFn: () =>
      api.get('/cmdb/instances', { params: { model: modelCode } }).then((r) => r.data.data),
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

  const listColumns = (model?.attributes ?? []).filter((a) => a.isListShow).slice(0, 5)
  const instances = result?.records ?? []

  const columns = useMemo<ColumnDef<CiInstanceVO>[]>(() => {
    const cols: ColumnDef<CiInstanceVO>[] = [
      {
        key: 'name',
        title: '实例名称',
        render: (r) => (
          <span className="font-semibold text-v2-fg">{r.name ?? `#${r.id}`}</span>
        ),
      },
      ...listColumns.map((col) => ({
        key: col.fieldKey,
        title: col.name,
        render: (r: CiInstanceVO) => (
          <span className="text-sm text-v2-muted">
            {String(r.fieldsData?.[col.fieldKey] ?? '—')}
          </span>
        ),
      })),
      {
        key: 'createdAt',
        title: '创建时间',
        render: (r) => (
          <span className="text-xs text-v2-muted">
            {new Date(r.createdAt).toLocaleDateString('zh-CN')}
          </span>
        ),
      },
      {
        key: 'actions',
        title: '操作',
        align: 'right' as const,
        render: (r) => (
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/cmdb/instances/by-model/${modelCode}/${r.id}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg"
              title="查看"
            >
              <Eye className="h-3.5 w-3.5" />
            </Link>
            {hasPermission('cmdb_instance', 'delete') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 px-0 text-v2-danger"
                title="删除"
                onClick={() => {
                  if (confirm('删除此实例?')) deleteMutation.mutate(r.id)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ),
      },
    ]
    return cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listColumns, hasPermission, modelCode])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CMDB"
        title={`${model?.name ?? modelCode} 实例列表`}
        subtitle={`共 ${result?.total ?? 0} 条实例，按模型属性展示列表字段。`}
        actions={
          <>
            <Link
              href={`/cmdb/admin/models/${modelCode}`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              返回模型
            </Link>
            {hasPermission('cmdb_instance', 'import') && (
              <Button variant="secondary" onClick={() => setCsvOpen(true)}>
                <Upload className="h-4 w-4" />
                导入 CSV
              </Button>
            )}
            {hasPermission('cmdb_instance', 'create') && (
              <Button variant="primary" onClick={() => router.push(`/cmdb/instances/by-model/${modelCode}/new`)}>
                <Plus className="h-4 w-4" />
                新建实例
              </Button>
            )}
          </>
        }
      />

      <DataTable
        columns={columns}
        data={instances}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty={{ title: '暂无实例', description: '点击右上角新建实例或导入 CSV。' }}
      />

      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} model={modelCode} />
    </div>
  )
}
