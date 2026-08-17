'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { CmdbInstancePreview } from '@/components/cmdb/CmdbInstancePreview'
import { CsvImportDialog } from '@/components/cmdb/CsvImportDialog'
import { BatchEditDialog } from '@/components/cmdb/BatchEditDialog'
import { getApiErrorMessage } from '@/lib/api-error'
import { decodeModelCodeOnce } from '@/lib/cmdb-model-code'
import type { CiModelWithAttributes, CmdbFieldsData } from '@/types/cmdb-model'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Checkbox,
  DataManagementPage,
  EmptyState,
  ErrorState,
  IconButton,
  NeutralAlertDialog,
  NeutralDrawer,
  PageHeader,
  Pagination,
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

const PAGE_SIZE = 20

export default function InstanceListPage() {
  const { modelCode } = useParams<{ modelCode: string }>()
  const canonicalModelCode = decodeModelCodeOnce(modelCode)
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [csvOpen, setCsvOpen] = useState(false)
  const [selected, setSelected] = useState<CiInstanceVO | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [batchOpen, setBatchOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [page, setPage] = useState(1)

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
    queryKey: ['cmdb-instances', canonicalModelCode, page],
    queryFn: () =>
      api.get('/cmdb/instances', { params: { model: canonicalModelCode, page, size: PAGE_SIZE } }).then((r) => r.data.data),
    enabled: isHydrated && hasPermission('cmdb_instance', 'read'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/instances/${id}`),
    onSuccess: (_data, deletedId) => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instances', canonicalModelCode] })
      setSelectedIds((current) => current.filter((id) => id !== deletedId))
      setDeleteId(null)
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
  const total = result?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canUpdate = hasPermission('cmdb_instance', 'update')
  const currentPageIds = instances.map((item) => item.id)
  const allPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id))
  const somePageSelected = !allPageSelected && currentPageIds.some((id) => selectedIds.includes(id))
  const deleteTarget = deleteId == null ? null : instances.find((item) => item.id === deleteId)

  const columns = [
      ...(canUpdate ? [{
        key: 'selection',
        label: (
          <span className="cwgsyw-cmdb-instance-list__selection" onClick={(event) => event.stopPropagation()}>
            <Checkbox
              label="全选当前页实例"
              showLabel={false}
              checked={allPageSelected}
              indeterminate={somePageSelected}
              onChange={(event) => setSelectedIds(event.target.checked ? currentPageIds : [])}
            />
          </span>
        ),
        align: 'center' as const,
      }] : []),
      { key: 'name', label: '实例名称' },
      ...listColumns.map((col) => ({ key: col.fieldKey, label: col.name })),
      { key: 'createdAt', label: '创建时间' },
      { key: 'actions', label: '', align: 'right' as const },
    ]

  const toggleSelected = (id: number) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  const changePage = (nextPage: number) => {
    setSelectedIds([])
    setDeleteId(null)
    setPage(nextPage)
  }

  return (
    <>
      <DataManagementPage className="cwgsyw-cmdb-page cwgsyw-cmdb-instance-list"
        header={
          <div className="cwgsyw-cmdb-instance-page">
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title={`${model?.name ?? canonicalModelCode} 实例列表`}
            subtitle={`${result?.total ?? 0} 条`}
            actions={
              <div className="cwgsyw-inline-controls">
                {canUpdate && selectedIds.length > 0 ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setBatchOpen(true)}>
                    批量编辑（{selectedIds.length}）
                  </Button>
                ) : null}
                {hasPermission('cmdb_import', 'execute') ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setCsvOpen(true)}>
                    导入 CSV
                  </Button>
                ) : null}
                {hasPermission('cmdb_instance', 'create') ? (
                  <Button type="button" size="sm" onClick={() => router.push(`/cmdb/instances/by-model/${canonicalModelCode}/new`)}>
                    新建实例
                  </Button>
                ) : null}
              </div>
            }
          />
          </div>
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
            <div className="cwgsyw-cmdb-instance-list__content">
              <Table
                className={`cwgsyw-cmdb-table${canUpdate ? ' cwgsyw-cmdb-instance-list__table--selectable' : ''}`}
                showSearch={false}
                state={isLoading ? 'loading' : 'data'}
                columns={columns}
                rows={instances.map((item) => ({
                  id: String(item.id),
                  selected: selectedIds.includes(item.id),
                  cells: {
                    selection: canUpdate ? (
                      <span className="cwgsyw-cmdb-instance-list__selection" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          label={`选择实例 ${item.name ?? `#${item.id}`}`}
                          showLabel={false}
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelected(item.id)}
                        />
                      </span>
                    ) : null,
                    name: item.name ?? `#${item.id}`,
                    ...Object.fromEntries(
                      listColumns.map((col) => [col.fieldKey, String(item.fieldsData?.[col.fieldKey] ?? '—')]),
                    ),
                    createdAt: new Date(item.createdAt).toLocaleDateString('zh-CN'),
                    actions: (
                      <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions" onClick={(event) => event.stopPropagation()}>
                        {hasPermission('cmdb_instance', 'delete') ? (
                          <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="cwgsyw-cmdb-admin__delete-action"
                            icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--trash" />}
                            aria-label={`删除实例 ${item.name ?? `#${item.id}`}`}
                            title="删除"
                            onClick={() => setDeleteId(item.id)}
                          />
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
              {pageCount > 1 ? (
                <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={changePage} />
              ) : null}
            </div>
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
        className="cwgsyw-cmdb-preview-drawer"
        showClose
        title={selected?.name ?? (selected ? `#${selected.id}` : '实例详情')}
        description={selected?.modelId}
      >
        {selected ? (
          <CmdbInstancePreview
            description={selected.description}
            fields={[
              { label: '实例 ID', value: selected.id },
              { label: '状态', value: selected.status ?? '-' },
              { label: '负责人', value: selected.owner || '-' },
              { label: '创建时间', value: new Date(selected.createdAt).toLocaleString('zh-CN') },
            ]}
            extraFields={drawerColumns.map((col) => {
              const value = selected.fieldsData?.[col.fieldKey]
              const display =
                value === null || value === undefined || value === ''
                  ? '-'
                  : Array.isArray(value)
                    ? value.join(', ')
                    : typeof value === 'object'
                      ? JSON.stringify(value)
                      : String(value)
              return { label: col.name, value: display }
            })}
            actions={
              <>
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
              </>
            }
          />
        ) : null}
      </NeutralDrawer>

      <NeutralAlertDialog
        open={deleteId != null}
        onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setDeleteId(null) }}
        className="cwgsyw-cmdb-model-detail__delete-dialog"
        icon={<span aria-hidden="true" className="cwgsyw-cmdb-model-detail__delete-alert-icon" />}
        title="确认删除实例"
        description={`确认删除实例「${deleteTarget?.name ?? (deleteId == null ? '' : `#${deleteId}`)}」？此操作不可恢复。`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => {
          if (deleteId != null && !deleteMutation.isPending) deleteMutation.mutate(deleteId)
        }}
      />
    </>
  )
}
