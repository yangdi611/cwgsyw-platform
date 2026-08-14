'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { usePermission } from '@/hooks/usePermission'
import type { CiAttributeGroupAdminItem, CiModelAdminItem } from '@/types/cmdb-model'
import { getApiErrorMessage } from '@/lib/api-error'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  EmptyState,
  Field,
  Input,
  LoadingState,
  NeutralAlertDialog,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

function AttributeGroupsTab() {
  const { hasPermission } = usePermission()
  const canWrite = hasPermission('cmdb_model', 'manage')
  const queryClient = useQueryClient()
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ groupId: '', name: '', sortOrder: 0 })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', sortOrder: 0 })

  // Model picker
  const { data: models = [] } = useQuery<CiModelAdminItem[]>({
    queryKey: ['cmdb-models'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models')
        return r.data.data.records
      } catch { return [] }
    },
    enabled: typeof window !== 'undefined',
  })

  const { data: groups = [], isLoading } = useQuery<CiAttributeGroupAdminItem[]>({
    queryKey: ['cmdb-attribute-groups', selectedModel],
    queryFn: async () => {
      try {
        const r = await api.get(`/cmdb/models/${selectedModel}/attribute-groups`)
        return r.data.data
      } catch { return [] }
    },
    enabled: !!selectedModel,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post(`/cmdb/models/${selectedModel}/attribute-groups`, form),
    onSuccess: () => {
      toast.success('分组已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-attribute-groups', selectedModel] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model', selectedModel] })
      setCreating(false)
      setForm({ groupId: '', name: '', sortOrder: 0 })
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof editForm }) =>
      api.put(`/cmdb/models/${selectedModel}/attribute-groups/${id}`, body),
    onSuccess: () => {
      toast.success('已更新')
      queryClient.invalidateQueries({ queryKey: ['cmdb-attribute-groups', selectedModel] })
      setEditingId(null)
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/models/${selectedModel}/attribute-groups/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-attribute-groups', selectedModel] })
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e)),
  })

  const [deleteId, setDeleteId] = useState<number | null>(null)

  return (
    <div className="cwgsyw-form">
      <div className="cwgsyw-inline-controls">
        <Field label="模型" htmlFor="attr-group-model">
          <Select
            id="attr-group-model"
            value={selectedModel}
            placeholder="请选择模型"
            options={models.map((item) => ({ value: item.modelId, label: `${item.name} (${item.modelId})` }))}
            onChange={(value) => {
              setSelectedModel(value)
              setEditingId(null)
              setCreating(false)
            }}
          />
        </Field>
        {selectedModel && canWrite ? (
          <Button type="button" variant="primary" size="sm" onClick={() => setCreating((current) => !current)}>
            新建分组
          </Button>
        ) : null}
      </div>
      <p className="cwgsyw-type-body-sm">为选定模型管理属性分组（如 基本信息 / 硬件信息）。新建模型属性时从这里选择所属分组。</p>

      {!selectedModel ? (
        <EmptyState title="请先选择模型" description="选择一个 CI 模型后即可管理它的属性分组。" />
      ) : (
        <>
          {creating ? (
            <div className="cwgsyw-form">
              <div className="cwgsyw-filter-grid">
                <Field label="分组ID" htmlFor="group-id" required helperText="英文/下划线">
                  <Input id="group-id" value={form.groupId} onChange={(event) => setForm((current) => ({ ...current, groupId: event.target.value }))} placeholder="如: hardware" />
                </Field>
                <Field label="名称" htmlFor="group-name" required>
                  <Input id="group-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="如: 硬件信息" />
                </Field>
                <Field label="排序" htmlFor="group-sort">
                  <Input id="group-sort" type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value || 0) }))} />
                </Field>
              </div>
              <div className="cwgsyw-inline-controls">
                <Button type="button" disabled={!form.groupId || !form.name || createMutation.isPending} onClick={() => createMutation.mutate()}>
                  创建
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                  取消
                </Button>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <LoadingState label="加载属性分组" />
          ) : groups.length === 0 ? (
            <EmptyState title="暂无分组" description="这个模型还没有属性分组。" />
          ) : (
            <Table
              showSearch={false}
              columns={[
                { key: 'name', label: '名称' },
                { key: 'groupId', label: '分组ID' },
                { key: 'count', label: '属性' },
                { key: 'actions', label: '操作', align: 'right' },
              ]}
              rows={groups.map((group) => ({
                id: String(group.id),
                cells: {
                  name: editingId === group.id ? (
                    <Input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} />
                  ) : group.name,
                  groupId: group.groupId,
                  count: <StatusBadge label={`${group.attributeCount} 属性`} status="neutral" />,
                  actions: canWrite ? (
                    editingId === group.id ? (
                      <div className="cwgsyw-inline-controls">
                        <Button type="button" size="sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: group.id, body: editForm })}>
                          保存
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          取消
                        </Button>
                      </div>
                    ) : (
                      <div className="cwgsyw-inline-controls">
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingId(group.id); setEditForm({ name: group.name, sortOrder: group.sortOrder ?? 0 }) }}>
                          编辑
                        </Button>
                        <Button type="button" size="sm" variant="ghost" disabled={(group.attributeCount ?? 0) > 0} onClick={() => setDeleteId(group.id)}>
                          删除
                        </Button>
                      </div>
                    )
                  ) : null,
                },
              }))}
            />
          )}
        </>
      )}

      <NeutralAlertDialog
        open={deleteId != null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="确认删除分组"
        description="删除后不可恢复。分组下没有属性时才能删除。"
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => {
          if (deleteId != null) deleteMutation.mutate(deleteId)
          setDeleteId(null)
        }}
      />
    </div>
  )
}

export { AttributeGroupsTab }
