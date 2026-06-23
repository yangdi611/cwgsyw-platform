'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { PageHeader, DataTable, DetailDrawer, type ColumnDef } from '@/components/shared'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Trash2, Upload, ArrowLeft, FileText, ArrowRight, GitBranch } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { CsvImportDialog } from '@/components/cmdb/CsvImportDialog'

interface CiInstanceVO {
  id: number
  modelId: string
  modelCode?: string
  displayName?: string
  name: string
  status?: string
  owner?: string
  description?: string
  fieldsData: Record<string, unknown>
  createdAt: string
  updatedAt?: string
}

interface PageResult {
  records: CiInstanceVO[]
  total: number
  page: number
  size: number
}

interface CiModelVO {
  name: string
  attributes: { fieldKey: string; name: string; isListShow: boolean; isDrawerShow: boolean; fieldType: string }[]
}

export default function InstanceListPage() {
  const { modelCode } = useParams<{ modelCode: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [csvOpen, setCsvOpen] = useState(false)
  const [selected, setSelected] = useState<CiInstanceVO | null>(null)

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
  const drawerColumns = (model?.attributes ?? []).filter((a) => a.isDrawerShow)
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
            {hasPermission('cmdb_instance', 'delete') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 px-0 text-v2-danger"
                title="删除"
                onClick={(e) => {
                  e.stopPropagation()
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
              href="/cmdb/instances"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              返回 CI 资源
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
        onRowClick={(r) => setSelected(r)}
        empty={{ title: '暂无实例', description: '点击右上角新建实例或导入 CSV。' }}
      />

      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} model={modelCode} />

      {/* Detail Drawer — click a row to preview */}
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        width={640}
        title={selected?.name ?? (selected ? `#${selected.id}` : '')}
        subtitle={
          selected ? (
            <span className="text-xs text-v2-muted font-mono">{selected.modelId}</span>
          ) : undefined
        }
        footer={
          selected ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(`/cmdb/topology/${selected.id}`)}
              >
                <GitBranch className="h-4 w-4" />
                查看拓扑
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  router.push(`/cmdb/instances/by-model/${modelCode}/${selected.id}`)
                }
              >
                <FileText className="h-4 w-4" />
                完整详情
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-5">
            {selected.description && (
              <div className="rounded-v2-md border border-v2-border bg-v2-surface-soft p-3">
                <div className="text-xs font-semibold text-v2-muted mb-1">描述</div>
                <p className="text-sm text-v2-fg leading-relaxed">{selected.description}</p>
              </div>
            )}

            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-v2-muted">
                基本信息
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <InfoItem label="实例 ID" value={String(selected.id)} mono />
                <InfoItem label="状态" value={selected.status ?? '-'} />
                <InfoItem label="负责人" value={selected.owner || '-'} />
                <InfoItem
                  label="创建时间"
                  value={new Date(selected.createdAt).toLocaleString('zh-CN')}
                />
                {selected.updatedAt && (
                  <InfoItem
                    label="更新时间"
                    value={new Date(selected.updatedAt).toLocaleString('zh-CN')}
                  />
                )}
              </dl>
            </div>

            {drawerColumns.length > 0 && (
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-v2-muted">
                  关键属性
                </div>
                <dl className="space-y-2.5">
                  {drawerColumns.map((col) => {
                    const v = selected.fieldsData?.[col.fieldKey]
                    const display =
                      v === null || v === undefined || v === ''
                        ? '-'
                        : Array.isArray(v)
                          ? v.join(', ')
                          : typeof v === 'object'
                            ? JSON.stringify(v)
                            : String(v)
                    return (
                      <div
                        key={col.fieldKey}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <dt className="shrink-0 text-v2-muted">{col.name}</dt>
                        <dd className="text-right break-all text-v2-fg">{display}</dd>
                      </div>
                    )
                  })}
                </dl>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  )
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-v2-muted mb-0.5">{label}</dt>
      <dd className={`text-sm text-v2-fg ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  )
}
