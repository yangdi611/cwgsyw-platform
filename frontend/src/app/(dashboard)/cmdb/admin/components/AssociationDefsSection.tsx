'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import type { CiModelAdminItem } from '@/types/cmdb-model'
import { getApiErrorMessage, isAxiosError } from '@/lib/api-error'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  LoadingState,
  NeutralAlertDialog,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'
import { CmdbAdminActionIcon } from './CmdbAdminActionIcon'

interface CiAssociationDefVO {
  id: number
  defId: string
  name: string
  kindId: string
  kindName: string
  srcModelId: string
  srcModelName: string
  dstModelId: string
  dstModelName: string
  mapping: string
  onDelete: string | null
  isBuiltIn: boolean
}

const MAPPING_OPTIONS = [
  { value: '1:1', label: '一对一 (1:1)' },
  { value: '1:n', label: '一对多 (1:n)' },
  { value: 'n:n', label: '多对多 (n:n)' },
]

const ON_DELETE_OPTIONS = [
  { value: 'none', label: '不级联' },
  { value: 'cascade', label: '级联删除' },
  { value: 'restrict', label: '阻止删除' },
]

function AssociationDefsSection({
  models, kinds, canWrite,
}: {
  models: { modelId: string; name: string; displayName?: string }[]
  kinds: { id: number; code: string; name: string; isBuiltIn: boolean }[]
  canWrite: boolean
}) {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const emptyForm = { defId: '', name: '', kindId: '', srcModelId: '', dstModelId: '', mapping: '1:n', onDelete: 'none' }
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', mapping: '1:n', onDelete: 'none' })

  const { data: defs = [], isLoading, isError, error, refetch } = useQuery<CiAssociationDefVO[], unknown>({
    queryKey: ['cmdb-association-defs'],
    queryFn: async () => (await api.get('/cmdb/association-defs')).data.data,
    enabled: typeof window !== 'undefined',
    retry: (failureCount: number, err: unknown) => {
      if (isAxiosError(err)) {
        const status = err.response?.status
        if (status === 403 || status === 401) return false
      }
      return failureCount < 2
    },
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/cmdb/association-defs', form),
    onSuccess: () => {
      toast.success('关联定义已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-association-defs'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-defs'] })
      setCreating(false)
      setForm(emptyForm)
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '创建失败')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof editForm }) =>
      api.put(`/cmdb/association-defs/${id}`, body),
    onSuccess: () => {
      toast.success('已更新')
      queryClient.invalidateQueries({ queryKey: ['cmdb-association-defs'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-defs'] })
      setEditingId(null)
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '更新失败')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/association-defs/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-association-defs'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-defs'] })
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '删除失败')),
  })

  function startEdit(d: CiAssociationDefVO) {
    setEditingId(d.id)
    setEditForm({ name: d.name, mapping: d.mapping, onDelete: d.onDelete ?? 'none' })
  }

  const formValid = form.defId && form.name && form.kindId && form.srcModelId && form.dstModelId && form.mapping

  const [deleteDef, setDeleteDef] = useState<{ id: number; name: string } | null>(null)

  const modelOptions = models.map((item) => ({
    value: item.modelId,
    label: `${item.displayName ?? item.name} (${item.modelId})`,
  }))
  const kindOptions = kinds.map((item) => ({ value: item.code, label: `${item.name} (${item.code})` }))

  return (
    <section className="cwgsyw-cmdb-admin__subsection">
      <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__toolbar">
        <div>
          <div className="cwgsyw-cmdb-admin__section-title">模型关联定义</div>
          <p className="cwgsyw-cmdb-admin__section-note">声明哪两个模型之间能用哪种关联种类建立关系。实例详情页的“添加关联”依赖此处定义。</p>
        </div>
        {canWrite && !creating ? (
          <Button type="button" size="sm" onClick={() => { setForm(emptyForm); setCreating(true) }}>新建关联定义</Button>
        ) : null}
      </div>

      {creating ? (
        <div className="cwgsyw-form">
          <div className="cwgsyw-filter-grid">
            <Field label="标识" htmlFor="def-id" required helperText="英文/下划线，唯一">
              <Input size="sm" id="def-id" value={form.defId} onChange={(event) => setForm((current) => ({ ...current, defId: event.target.value }))} />
            </Field>
            <Field label="名称" htmlFor="def-name" required>
              <Input size="sm" id="def-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="源模型" htmlFor="def-src" required>
              <Select size="sm" overlay id="def-src" value={form.srcModelId} placeholder="请选择源模型" options={modelOptions} onChange={(value) => setForm((current) => ({ ...current, srcModelId: value }))} />
            </Field>
            <Field label="目标模型" htmlFor="def-dst" required>
              <Select size="sm" overlay id="def-dst" value={form.dstModelId} placeholder="请选择目标模型" options={modelOptions} onChange={(value) => setForm((current) => ({ ...current, dstModelId: value }))} />
            </Field>
            <Field label="关联种类" htmlFor="def-kind" required>
              <Select size="sm" overlay id="def-kind" value={form.kindId} placeholder="请选择关联种类" options={kindOptions} onChange={(value) => setForm((current) => ({ ...current, kindId: value }))} />
            </Field>
            <Field label="基数" htmlFor="def-mapping" required>
              <Select size="sm" overlay id="def-mapping" value={form.mapping} options={MAPPING_OPTIONS} onChange={(value) => setForm((current) => ({ ...current, mapping: value }))} />
            </Field>
            <Field label="删除策略" htmlFor="def-delete">
              <Select size="sm" overlay id="def-delete" value={form.onDelete} options={ON_DELETE_OPTIONS} onChange={(value) => setForm((current) => ({ ...current, onDelete: value }))} />
            </Field>
          </div>
          <div className="cwgsyw-inline-controls">
            <Button type="button" variant="secondary" onClick={() => { setCreating(false); setForm(emptyForm) }}>取消</Button>
            <Button type="button" disabled={!formValid || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState label="加载关联定义" />
      ) : isError ? (
        <ErrorState
          title="加载失败"
          description={isAxiosError(error) && error.response?.status === 403 ? '无 cmdb_relation:read 权限，请联系管理员' : `加载失败：${getApiErrorMessage(error, '未知错误')}`}
          retry={<Button type="button" variant="secondary" onClick={() => refetch()}>重试</Button>}
        />
      ) : defs.length === 0 ? (
        <EmptyState title="暂无关联定义" description={canWrite ? '点击右上角新建关联定义开始配置。' : '当前没有可显示的关联定义。'} />
      ) : (
        <Table
          className={`cwgsyw-cmdb-table${canWrite ? ' cwgsyw-cmdb-admin__action-table' : ''}`}
          showSearch={false}
          columns={[
            { key: 'defId', label: '标识' },
            { key: 'name', label: '名称' },
            { key: 'path', label: '源 → 目标' },
            { key: 'kind', label: '关联种类' },
            { key: 'mapping', label: '基数' },
            { key: 'onDelete', label: '删除策略' },
            ...(canWrite ? [{ key: 'actions', label: '', align: 'right' as const }] : []),
          ]}
          rows={defs.map((item: CiAssociationDefVO) => ({
            id: String(item.id),
            cells: {
              defId: item.defId,
              name: (
                <span className="cwgsyw-inline-controls">
                  {editingId === item.id ? (
                    <Input size="sm" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} />
                  ) : item.name}
                  {item.isBuiltIn ? <StatusBadge label="内置" status="neutral" /> : null}
                </span>
              ),
              path: `${item.srcModelName} → ${item.dstModelName}`,
              kind: item.kindName,
              mapping: editingId === item.id ? (
                <Select size="sm" overlay value={editForm.mapping} options={MAPPING_OPTIONS} onChange={(value) => setEditForm((current) => ({ ...current, mapping: value }))} />
              ) : item.mapping,
              onDelete: editingId === item.id ? (
                <Select size="sm" overlay value={editForm.onDelete} options={ON_DELETE_OPTIONS} onChange={(value) => setEditForm((current) => ({ ...current, onDelete: value }))} />
              ) : (ON_DELETE_OPTIONS.find((option) => option.value === (item.onDelete ?? 'none'))?.label ?? item.onDelete),
              actions: canWrite ? (
                editingId === item.id ? (
                  <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions">
                    <IconButton type="button" size="sm" variant="ghost" icon="check" aria-label={`保存关联定义 ${item.name}`} title="保存" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: item.id, body: editForm })} />
                    <IconButton type="button" size="sm" variant="ghost" icon="close" aria-label={`取消编辑关联定义 ${item.name}`} title="取消" onClick={() => setEditingId(null)} />
                  </div>
                ) : (
                  <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions">
                    <IconButton type="button" size="sm" variant="ghost" icon={<CmdbAdminActionIcon name="edit" />} aria-label={`编辑关联定义 ${item.name}`} title={item.isBuiltIn ? '内置定义不可编辑' : '编辑'} disabled={item.isBuiltIn} onClick={() => startEdit(item)} />
                    <IconButton type="button" size="sm" variant="ghost" className="cwgsyw-cmdb-admin__delete-action" icon={<CmdbAdminActionIcon name="trash" />} aria-label={`删除关联定义 ${item.name}`} title={item.isBuiltIn ? '内置定义不可删除' : '删除'} disabled={item.isBuiltIn} onClick={() => setDeleteDef({ id: item.id, name: item.name })} />
                  </div>
                )
              ) : null,
            },
          }))}
        />
      )}

      <NeutralAlertDialog
        open={!!deleteDef}
        onOpenChange={(open) => !open && setDeleteDef(null)}
        title="确认删除关联定义"
        description={`删除关联定义「${deleteDef?.name ?? ''}」？已被实例使用时会拒绝删除。`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => {
          if (deleteDef) deleteMutation.mutate(deleteDef.id)
          setDeleteDef(null)
        }}
      />
    </section>
  )
}

export { AssociationDefsSection }
