'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { CsvImportDialog } from '@/components/cmdb/CsvImportDialog'
import { BatchEditDialog } from '@/components/cmdb/BatchEditDialog'
import { getApiErrorMessage } from '@/lib/api-error'
import { decodeModelCodeOnce } from '@/lib/cmdb-model-code'
import type { CiModelWithAttributes, CmdbFieldsData } from '@/types/cmdb-model'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Card,
  DataManagementPage,
  EmptyState,
  ErrorState,
  NeutralAlertDialog,
  NeutralDrawer,
  PageHeader,
  Table,
} from '@/design-system/figma-neutral/components'

interface CiInstanceVO {
  id: number
  modelId: string
  modelCode?: string
  displayName?: string
  name: string
  status?: string
  owner?: string
  description?: string
  fieldsData: CmdbFieldsData
  createdAt: string
  updatedAt?: string
}

interface PageResult {
  records: CiInstanceVO[]
  total: number
  page: number
  size: number
}

export default function InstanceListPage() {
  const { modelCode } = useParams<{ modelCode: string }>()
  const canonicalModelCode = decodeModelCodeOnce(modelCode)
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [csvOpen, setCsvOpen] = useState(false)
  const [selected, setSelected] = useState<CiInstanceVO | null>(null)
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([])
  const [batchOpen, setBatchOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: model } = useQuery<CiModelWithAttributes>({
    queryKey: ['cmdb-model', canonicalModelCode],
    queryFn: async () => {
      try {
        const r = await api.get(`/cmdb/models/${canonicalModelCode}`)
        return r.data.data
      } catch {
        return undefined
      }
    },
    enabled: isHydrated,
  })

  const { data: result, isLoading, isError, refetch } = useQuery<PageResult>({
    queryKey: ['cmdb-instances', canonicalModelCode],
    queryFn: () =>
      api.get('/cmdb/instances', { params: { model: canonicalModelCode } }).then((r) => r.data.data),
    enabled: isHydrated && hasPermission('cmdb_instance', 'read'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/instances/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instances', canonicalModelCode] })
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '删除失败')),
  })

  const cloneMutation = useMutation({
    mutationFn: (id: number) => api.post(`/cmdb/instances/${id}/clone`).then((r) => r.data.data),
    onSuccess: (created: CiInstanceVO) => {
      toast.success('已克隆，跳转到副本')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instances', canonicalModelCode] })
      setSelected(null)
      router.push(`/cmdb/instances/by-model/${canonicalModelCode}/${created.id}`)
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '克隆失败')),
  })

  const listColumns = (model?.attributes ?? []).filter((a) => a.isListShow).slice(0, 5)
  const drawerColumns = (model?.attributes ?? []).filter((a) => a.isDrawerShow)
  const instances = result?.records ?? []
  const canUpdate = hasPermission('cmdb_instance', 'update')

  const columns = useMemo(
    () => [
      { key: 'name', label: '实例名称' },
      ...listColumns.map((col) => ({ key: col.fieldKey, label: col.name })),
      { key: 'createdAt', label: '创建时间' },
      { key: 'actions', label: '操作', align: 'right' as const },
    ],
    [listColumns],
  )

  const toggleSelected = (id: number) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <>
      <DataManagementPage
        header={
          <PageHeader
            eyebrow="CMDB"
            title={`${model?.name ?? canonicalModelCode} 实例列表`}
            subtitle={`共 ${result?.total ?? 0} 条实例，按模型属性展示列表字段。`}
            breadcrumb={
              <Breadcrumb
                items={[
                  { href: '/', label: '工作台' },
                  { href: '/cmdb', label: 'CMDB' },
                  { label: model?.name ?? canonicalModelCode },
                ]}
              />
            }
            actions={
              <div className="cwgsyw-inline-controls">
                {canUpdate && selectedIds.length > 0 ? (
                  <Button type="button" variant="secondary" onClick={() => setBatchOpen(true)}>
                    批量编辑（{selectedIds.length}）
                  </Button>
                ) : null}
                {hasPermission('cmdb_import', 'execute') ? (
                  <Button type="button" variant="secondary" onClick={() => setCsvOpen(true)}>
                    导入 CSV
                  </Button>
                ) : null}
                {hasPermission('cmdb_instance', 'create') ? (
                  <Button type="button" onClick={() => router.push(`/cmdb/instances/by-model/${canonicalModelCode}/new`)}>
                    新建实例
                  </Button>
                ) : null}
              </div>
            }
          />
        }
        content={
          isError ? (
            <ErrorState
              title="实例加载失败"
              description="无法读取当前模型的实例，请稍后重试。"
              retry={<Button type="button" variant="secondary" onClick={() => refetch()}>重试</Button>}
            />
          ) : instances.length === 0 && !isLoading ? (
            <EmptyState title="暂无实例" description="点击右上角新建实例或导入 CSV。" />
          ) : (
            <Table
              showSearch={false}
              state={isLoading ? 'loading' : 'data'}
              columns={columns}
              rows={instances.map((item) => ({
                id: String(item.id),
                selected: selected?.id === item.id,
                cells: {
                  name: item.name ?? `#${item.id}`,
                  ...Object.fromEntries(
                    listColumns.map((col) => [col.fieldKey, String(item.fieldsData?.[col.fieldKey] ?? '—')]),
                  ),
                  createdAt: new Date(item.createdAt).toLocaleDateString('zh-CN'),
                  actions: (
                    <div className="cwgsyw-inline-controls" onClick={(event) => event.stopPropagation()}>
                      {canUpdate ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => toggleSelected(item.id)}>
                          {selectedIds.includes(item.id) ? '取消选择' : '选择'}
                        </Button>
                      ) : null}
                      {hasPermission('cmdb_instance', 'delete') ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteId(item.id)}>
                          删除
                        </Button>
                      ) : null}
                    </div>
                  ),
                },
              }))}
              onRowClick={(id) => {
                const hit = instances.find((item) => String(item.id) === id)
                if (hit) setSelected(hit)
              }}
            />
          )
        }
      />

      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} model={canonicalModelCode} />
      <BatchEditDialog
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        modelCode={canonicalModelCode}
        attributes={model?.attributes.map((a) => ({
          fieldKey: a.fieldKey,
          name: a.name,
          fieldType: a.fieldType,
          isEditable: a.isEditable,
          option: Array.isArray(a.option) ? a.option : null,
        })) ?? []}
        selectedIds={selectedIds.map(Number)}
        onDone={() => {
          setBatchOpen(false)
          setSelectedIds([])
        }}
      />

      <NeutralDrawer
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.name ?? (selected ? `#${selected.id}` : '实例详情')}
        description={selected?.modelId}
      >
        {selected ? (
          <div className="cwgsyw-form">
            {selected.description ? (
              <Card showHeader={false} padding="sm">
                <div className="cwgsyw-type-label-xs">描述</div>
                <p className="cwgsyw-type-body-sm">{selected.description}</p>
              </Card>
            ) : null}
            <div className="cwgsyw-filter-grid">
              <div>
                <div className="cwgsyw-type-label-xs">实例 ID</div>
                <div className="cwgsyw-type-body-sm">{selected.id}</div>
              </div>
              <div>
                <div className="cwgsyw-type-label-xs">状态</div>
                <div className="cwgsyw-type-body-sm">{selected.status ?? '-'}</div>
              </div>
              <div>
                <div className="cwgsyw-type-label-xs">负责人</div>
                <div className="cwgsyw-type-body-sm">{selected.owner || '-'}</div>
              </div>
              <div>
                <div className="cwgsyw-type-label-xs">创建时间</div>
                <div className="cwgsyw-type-body-sm">{new Date(selected.createdAt).toLocaleString('zh-CN')}</div>
              </div>
            </div>
            {drawerColumns.map((col) => {
              const value = selected.fieldsData?.[col.fieldKey]
              const display =
                value === null || value === undefined || value === ''
                  ? '-'
                  : Array.isArray(value)
                    ? value.join(', ')
                    : typeof value === 'object'
                      ? JSON.stringify(value)
                      : String(value)
              return (
                <div key={col.fieldKey}>
                  <div className="cwgsyw-type-label-xs">{col.name}</div>
                  <div className="cwgsyw-type-body-sm">{display}</div>
                </div>
              )
            })}
            <div className="cwgsyw-inline-controls">
              {hasPermission('cmdb_instance', 'create') ? (
                <Button type="button" variant="secondary" size="sm" disabled={cloneMutation.isPending} onClick={() => cloneMutation.mutate(selected.id)}>
                  克隆
                </Button>
              ) : null}
              <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/cmdb/topology/${selected.id}`)}>
                查看拓扑
              </Button>
              <Button type="button" size="sm" onClick={() => router.push(`/cmdb/instances/by-model/${canonicalModelCode}/${selected.id}`)}>
                完整详情
              </Button>
            </div>
          </div>
        ) : null}
      </NeutralDrawer>

      <NeutralAlertDialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="确认删除实例"
        description="删除此实例?"
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => {
          if (deleteId != null) deleteMutation.mutate(deleteId)
          setDeleteId(null)
        }}
      />
    </>
  )
}
