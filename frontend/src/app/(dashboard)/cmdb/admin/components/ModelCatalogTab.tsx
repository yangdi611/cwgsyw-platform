'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { usePermission } from '@/hooks/usePermission'
import { ModelCard } from './ModelCard'
import type { CiModelAdminItem } from '@/types/cmdb-model'
import { getModelDisplayName, nextCopyModelId } from './utils'
import { getApiErrorMessage } from '@/lib/api-error'
import { CmdbAdminActionIcon } from './CmdbAdminActionIcon'
import { CmdbAdminDisclosureIcon } from './CmdbAdminDisclosureIcon'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  LoadingState,
  NeutralAlertDialog,
  Select,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

interface ModelGroupVO {
  id: number
  code: string
  name: string
  icon: string | null
  sortOrder: number
  isBuiltIn: boolean
  modelCount: number
}

function ModelCatalogTab() {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canCreateModel = hasPermission('cmdb_model', 'create')
  const canWrite = hasPermission('cmdb_model', 'update')
  const canDeleteModel = hasPermission('cmdb_model', 'delete')
  const canManageGroups = hasPermission('cmdb_model', 'manage')

  const [creatingModel, setCreatingModel] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [modelForm, setModelForm] = useState({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })
  const [groupForm, setGroupForm] = useState({ code: '', name: '', icon: 'folder', sortOrder: 100 })
  const [movedModelId, setMovedModelId] = useState<string | null>(null)
  const [expandedGroupCode, setExpandedGroupCode] = useState<string | null>(null)
  const [pendingGroupCode, setPendingGroupCode] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [editGroupForm, setEditGroupForm] = useState({ name: '', sortOrder: 0 })
  const [editingModel, setEditingModel] = useState<CiModelAdminItem | null>(null)
  const [renameForm, setRenameForm] = useState({ displayName: '' })
  const [copyingModel, setCopyingModel] = useState<CiModelAdminItem | null>(null)
  const [copyForm, setCopyForm] = useState({ modelId: '', name: '', groupCode: '' })

  const requestGroupOpen = (code: string) => {
    if (expandedGroupCode === code && !pendingGroupCode) return
    if (expandedGroupCode) {
      setPendingGroupCode(code)
      setExpandedGroupCode(null)
      return
    }
    if (pendingGroupCode) {
      setPendingGroupCode(code)
      return
    }
    setExpandedGroupCode(code)
  }

  const completeGroupExit = () => {
    if (!pendingGroupCode) return
    setExpandedGroupCode(pendingGroupCode)
    setPendingGroupCode(null)
  }

  const { data: models = [], isLoading: modelsLoading } = useQuery<CiModelAdminItem[]>({
    queryKey: ['cmdb-models'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models')
        return r.data.data.records
      } catch { return [] }
    },
    enabled: typeof window !== 'undefined',
  })

  const { data: modelGroups = [], isLoading: groupsLoading } = useQuery<ModelGroupVO[]>({
    queryKey: ['cmdb-model-groups'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/model-groups')
        return r.data.data
      } catch { return [] }
    },
    enabled: typeof window !== 'undefined',
  })

  const createModelMutation = useMutation({
    mutationFn: () => api.post('/cmdb/models', {
      modelId: modelForm.modelId, name: modelForm.name, icon: modelForm.icon,
      groupCode: modelForm.groupCode || undefined, description: modelForm.description || undefined,
    }),
    onSuccess: () => {
      toast.success('模型已创建')
      setCreatingModel(false)
      setModelForm({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
      // 自动展开目标分类
      if (modelForm.groupCode) requestGroupOpen(modelForm.groupCode)
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '创建失败')),
  })

  const createGroupMutation = useMutation({
    mutationFn: () => api.post('/cmdb/model-groups', groupForm),
    onSuccess: () => {
      toast.success('分类已创建')
      setCreatingGroup(false)
      setGroupForm({ code: '', name: '', icon: 'folder', sortOrder: 100 })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
      // 自动展开新分类
      requestGroupOpen(groupForm.code)
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '创建失败')),
  })

  const moveModelMutation = useMutation({
    mutationFn: ({ model, toCode }: { model: CiModelAdminItem; toCode: string }) =>
      api.put(`/cmdb/models/${model.id}`, { group: toCode }),
    onMutate: async ({ model, toCode }) => {
      await queryClient.cancelQueries({ queryKey: ['cmdb-models'] })
      const prev = queryClient.getQueryData<CiModelAdminItem[]>(['cmdb-models'])
      const toName = modelGroups.find(g => g.code === toCode)?.name ?? toCode
      queryClient.setQueryData<CiModelAdminItem[]>(['cmdb-models'], (old = []) =>
        old.map(m => m.modelId === model.modelId ? { ...m, group: toCode, groupName: toName } : m))
      setMovedModelId(model.modelId)
      // 展开目标分类以显示刚移入的模型
      requestGroupOpen(toCode)
      return { prev }
    },
    onError: (error: unknown, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['cmdb-models'], ctx.prev)
      setMovedModelId(null)
      toast.error(getApiErrorMessage(error, '移动失败，已还原'))
    },
    onSuccess: (_data, { model, toCode }) => {
      const fromCode = model.group || ''
      const toName = modelGroups.find(g => g.code === toCode)?.name ?? toCode
      toast.success(`已移到「${toName}」`, {
        action: fromCode === toCode ? undefined : (
          <Button type="button" size="sm" variant="ghost" onClick={() => moveModelMutation.mutate({ model: { ...model, group: toCode }, toCode: fromCode })}>
            撤销
          </Button>
        ),
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
      window.setTimeout(() => setMovedModelId(null), 1200)
    },
  })

  const deleteModelMutation = useMutation({
    mutationFn: (model: CiModelAdminItem) => api.delete(`/cmdb/models/${model.id}`),
    onSuccess: (_data, model) => {
      toast.success(`模型「${model.name}」已删除`)
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '删除失败')),
  })

  const renameModelMutation = useMutation({
    mutationFn: ({ model, displayName }: { model: CiModelAdminItem; displayName: string }) =>
      api.put(`/cmdb/models/${model.id}`, { displayName }),
    onSuccess: (_data, { model }) => {
      toast.success(`模型「${getModelDisplayName(model)}」已重命名`)
      setEditingModel(null)
      setRenameForm({ displayName: '' })
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model', model.modelId] })
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '重命名失败')),
  })

  const copyModelMutation = useMutation({
    mutationFn: ({ model, body }: { model: CiModelAdminItem; body: { modelId: string; name: string; groupCode: string } }) =>
      api.post(`/cmdb/models/${model.id}/copy`, body),
    onSuccess: (_data, { body }) => {
      toast.success(`模型「${body.name}」已复制`)
      setCopyingModel(null)
      setCopyForm({ modelId: '', name: '', groupCode: '' })
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
      requestGroupOpen(body.groupCode)
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '复制失败')),
  })

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof editGroupForm }) =>
      api.put(`/cmdb/model-groups/${id}`, body),
    onSuccess: () => {
      toast.success('分类已更新')
      setEditingGroupId(null)
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '更新失败')),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/model-groups/${id}`),
    onSuccess: () => {
      toast.success('分类已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '删除失败')),
  })

  const grouped = models.reduce((acc, m) => {
    const key = m.group || '未分类'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, CiModelAdminItem[]>)

  const toggleGroup = (code: string) => {
    if (pendingGroupCode) {
      setPendingGroupCode(code)
      return
    }
    if (expandedGroupCode === code) {
      setExpandedGroupCode(null)
      return
    }
    requestGroupOpen(code)
  }

  const openRenameModel = (model: CiModelAdminItem) => {
    setCopyingModel(null)
    setEditingModel(model)
    setRenameForm({ displayName: getModelDisplayName(model) })
  }

  const openCopyModel = (model: CiModelAdminItem) => {
    const displayName = getModelDisplayName(model)
    setEditingModel(null)
    setCopyingModel(model)
    setCopyForm({
      modelId: nextCopyModelId(model.modelId, models),
      name: `${displayName} 副本`,
      groupCode: model.group || modelGroups[0]?.code || '',
    })
  }

  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ id: number; name: string } | null>(null)

  return (
    <div className="cwgsyw-cmdb-admin__panel-section cwgsyw-cmdb-admin__catalog">
      <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__toolbar">
        <p className="cwgsyw-cmdb-admin__section-note">按分类组织的 CI 模型目录</p>
        {canManageGroups ? (
          <Button type="button" size="sm" onClick={() => setCreatingGroup((value) => !value)}>新建分类</Button>
        ) : null}
        {canCreateModel ? (
          <Button type="button" size="sm" onClick={() => setCreatingModel((value) => !value)}>新建模型</Button>
        ) : null}
      </div>

      {creatingGroup ? (
        <div className="cwgsyw-cmdb-choice-list">
          <div className="cwgsyw-filter-grid">
            <Field label="分类代码" htmlFor="group-code" required helperText="英文/下划线">
              <Input size="sm" id="group-code" value={groupForm.code} onChange={(event) => setGroupForm((current) => ({ ...current, code: event.target.value }))} placeholder="如: middleware" />
            </Field>
            <Field label="分类名称" htmlFor="group-name" required>
              <Input size="sm" id="group-name" value={groupForm.name} onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))} placeholder="如: 中间件" />
            </Field>
            <Field label="排序" htmlFor="group-sort">
              <Input size="sm" id="group-sort" type="number" value={groupForm.sortOrder} onChange={(event) => setGroupForm((current) => ({ ...current, sortOrder: +event.target.value }))} />
            </Field>
          </div>
          <div className="cwgsyw-inline-controls">
            <Button type="button" disabled={!groupForm.code || !groupForm.name || createGroupMutation.isPending} onClick={() => createGroupMutation.mutate()}>创建</Button>
            <Button type="button" variant="ghost" onClick={() => setCreatingGroup(false)}>取消</Button>
          </div>
        </div>
      ) : null}

      {creatingModel ? (
        <div className="cwgsyw-form">
          <div className="cwgsyw-filter-grid">
            <Field label="模型ID" htmlFor="model-id" required helperText="英文/下划线">
              <Input size="sm" id="model-id" value={modelForm.modelId} onChange={(event) => setModelForm((current) => ({ ...current, modelId: event.target.value }))} placeholder="如: mysql_instance" />
            </Field>
            <Field label="模型名称" htmlFor="model-name" required>
              <Input size="sm" id="model-name" value={modelForm.name} onChange={(event) => setModelForm((current) => ({ ...current, name: event.target.value }))} placeholder="如: MySQL实例" />
            </Field>
            <Field label="所属分类" htmlFor="model-group">
              <Select size="sm" overlay
                id="model-group"
                value={modelForm.groupCode}
                placeholder="请选择分类"
                options={modelGroups.map((group) => ({ value: group.code, label: group.name }))}
                onChange={(value) => setModelForm((current) => ({ ...current, groupCode: value }))}
              />
            </Field>
            <Field label="描述" htmlFor="model-desc">
              <Input size="sm" id="model-desc" value={modelForm.description} onChange={(event) => setModelForm((current) => ({ ...current, description: event.target.value }))} />
            </Field>
          </div>
          <div className="cwgsyw-inline-controls">
            <Button type="button" disabled={!modelForm.modelId || !modelForm.name || createModelMutation.isPending} onClick={() => createModelMutation.mutate()}>创建</Button>
            <Button type="button" variant="ghost" onClick={() => setCreatingModel(false)}>取消</Button>
          </div>
        </div>
      ) : null}

      {editingModel ? (
        <div className="cwgsyw-form">
          <div className="cwgsyw-type-label-sm">重命名模型</div>
          <div className="cwgsyw-type-label-xs">{editingModel.modelId}</div>
          <Field label="模型名称" htmlFor="rename-model" required>
            <Input size="sm" id="rename-model" value={renameForm.displayName} onChange={(event) => setRenameForm({ displayName: event.target.value })} />
          </Field>
          <div className="cwgsyw-inline-controls">
            <Button type="button" disabled={!renameForm.displayName.trim() || renameModelMutation.isPending} onClick={() => renameModelMutation.mutate({ model: editingModel, displayName: renameForm.displayName.trim() })}>保存</Button>
            <Button type="button" variant="ghost" onClick={() => setEditingModel(null)}>取消</Button>
          </div>
        </div>
      ) : null}

      {copyingModel ? (
        <div className="cwgsyw-form">
          <div className="cwgsyw-type-label-sm">复制模型</div>
          <p className="cwgsyw-type-body-sm">复制「{getModelDisplayName(copyingModel)}」的属性分组和属性定义，不复制实例数据</p>
          <div className="cwgsyw-filter-grid">
            <Field label="新模型ID" htmlFor="copy-id" required>
              <Input size="sm" id="copy-id" value={copyForm.modelId} onChange={(event) => setCopyForm((current) => ({ ...current, modelId: event.target.value }))} />
            </Field>
            <Field label="新模型名称" htmlFor="copy-name" required>
              <Input size="sm" id="copy-name" value={copyForm.name} onChange={(event) => setCopyForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="所属分类" htmlFor="copy-group">
              <Select size="sm" overlay
                id="copy-group"
                value={copyForm.groupCode}
                placeholder="请选择分类"
                options={modelGroups.map((group) => ({ value: group.code, label: group.name }))}
                onChange={(value) => setCopyForm((current) => ({ ...current, groupCode: value }))}
              />
            </Field>
          </div>
          <div className="cwgsyw-inline-controls">
            <Button
              type="button"
              disabled={!copyForm.modelId.trim() || !copyForm.name.trim() || !copyForm.groupCode || copyModelMutation.isPending}
              onClick={() => copyModelMutation.mutate({
                model: copyingModel,
                body: { modelId: copyForm.modelId.trim(), name: copyForm.name.trim(), groupCode: copyForm.groupCode },
              })}
            >
              复制
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCopyingModel(null)}>取消</Button>
          </div>
        </div>
      ) : null}

      {modelsLoading || groupsLoading ? (
        <LoadingState label="加载模型目录" />
      ) : (
        <div className="cwgsyw-form">
          {modelGroups.map((group) => {
            const groupModels = grouped[group.code] ?? []
            const isExpanded = expandedGroupCode === group.code
            const isEditing = editingGroupId === group.id
            return (
              <div key={group.code} className="cwgsyw-card cwgsyw-card--sm cwgsyw-cmdb-admin__group-card">
                <div className="cwgsyw-cmdb-admin__group-row">
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="cwgsyw-cmdb-admin__disclosure-trigger"
                    icon={<CmdbAdminDisclosureIcon expanded={isExpanded} />}
                    aria-label={(isExpanded ? '收起分类 ' : '展开分类 ') + group.name}
                    aria-expanded={isExpanded}
                    disabled={isEditing}
                    onClick={() => toggleGroup(group.code)}
                  />
                  {isEditing ? (
                    <>
                      <Input size="sm" value={editGroupForm.name} onChange={(event) => setEditGroupForm((current) => ({ ...current, name: event.target.value }))} />
                      <Input size="sm" type="number" value={editGroupForm.sortOrder} onChange={(event) => setEditGroupForm((current) => ({ ...current, sortOrder: +event.target.value }))} />
                      <Button type="button" size="sm" onClick={() => updateGroupMutation.mutate({ id: group.id, body: editGroupForm })}>保存</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditingGroupId(null)}>取消</Button>
                    </>
                  ) : (
                    <>
                      <div className="cwgsyw-cmdb-admin__group-info">
                        <span className="cwgsyw-cmdb-admin__group-title" title={group.name}>{group.name}</span>
                        <span className="cwgsyw-cmdb-admin__group-meta">{groupModels.length} 个模型</span>
                        {group.isBuiltIn ? <StatusBadge label="内置" status="neutral" /> : null}
                      </div>
                      {canManageGroups ? (
                        <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__group-actions cwgsyw-cmdb-admin__row-actions">
                          <IconButton type="button" size="sm" variant="ghost" icon={<CmdbAdminActionIcon name="edit" />} aria-label={'编辑分类 ' + group.name} title="编辑" onClick={() => { setEditingGroupId(group.id); setEditGroupForm({ name: group.name, sortOrder: group.sortOrder }) }} />
                          <IconButton type="button" size="sm" variant="ghost" className="cwgsyw-cmdb-admin__delete-action" icon={<CmdbAdminActionIcon name="trash" />} aria-label={'删除分类 ' + group.name} title={groupModels.length > 0 ? '分类下有模型，无法删除' : '删除'} disabled={groupModels.length > 0} onClick={() => setDeleteGroupTarget({ id: group.id, name: group.name })} />
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                <AnimatePresence initial={false} onExitComplete={completeGroupExit}>
                  {isExpanded ? (
                    <motion.div
                      key="group-panel"
                      className="cwgsyw-cmdb-admin__group-panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <div className="cwgsyw-cmdb-admin__group-panel-inner">
                        {groupModels.length === 0 ? (
                          <EmptyState title="该分类暂无模型" description="新建模型时选择此分类，或把现有模型移动进来。" />
                        ) : (
                          <div className="cwgsyw-cmdb-admin__model-grid">
                            {groupModels.map((model) => (
                              <ModelCard
                                key={model.modelId}
                                model={model}
                                groups={modelGroups.map((item) => ({ code: item.code, name: item.name }))}
                                canWrite={canWrite}
                                canCreate={canCreateModel}
                                canDelete={canDeleteModel}
                                deleting={deleteModelMutation.isPending}
                                justMoved={movedModelId === model.modelId}
                                onMove={(toCode) => moveModelMutation.mutate({ model, toCode })}
                                onRename={() => openRenameModel(model)}
                                onCopy={() => openCopyModel(model)}
                                onDelete={() => deleteModelMutation.mutate(model)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            )
          })}

          {Object.entries(grouped)
            .filter(([code]) => !modelGroups.some((group) => group.code === code))
            .map(([code, groupModels]) => {
              const isExpanded = expandedGroupCode === code
              return (
                <div key={code} className="cwgsyw-card cwgsyw-card--sm cwgsyw-cmdb-admin__group-card">
                  <div className="cwgsyw-cmdb-admin__group-row">
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="cwgsyw-cmdb-admin__disclosure-trigger"
                      icon={<CmdbAdminDisclosureIcon expanded={isExpanded} />}
                      aria-label={(isExpanded ? '收起分类 ' : '展开分类 ') + (groupModels[0]?.groupName || '未分类')}
                      aria-expanded={isExpanded}
                      onClick={() => toggleGroup(code)}
                    />
                    <div className="cwgsyw-cmdb-admin__group-info">
                      <span className="cwgsyw-cmdb-admin__group-title">{groupModels[0]?.groupName || '未分类'}</span>
                      <span className="cwgsyw-cmdb-admin__group-meta">{groupModels.length} 个模型</span>
                    </div>
                  </div>
                  <AnimatePresence initial={false} onExitComplete={completeGroupExit}>
                    {isExpanded ? (
                      <motion.div
                        key="group-panel"
                        className="cwgsyw-cmdb-admin__group-panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                      >
                        <div className="cwgsyw-cmdb-admin__group-panel-inner">
                          <div className="cwgsyw-cmdb-admin__model-grid">
                            {groupModels.map((model) => (
                              <ModelCard
                                key={model.modelId}
                                model={model}
                                groups={modelGroups.map((item) => ({ code: item.code, name: item.name }))}
                                canWrite={canWrite}
                                canCreate={canCreateModel}
                                canDelete={canDeleteModel}
                                deleting={deleteModelMutation.isPending}
                                justMoved={movedModelId === model.modelId}
                                onMove={(toCode) => moveModelMutation.mutate({ model, toCode })}
                                onRename={() => openRenameModel(model)}
                                onCopy={() => openCopyModel(model)}
                                onDelete={() => deleteModelMutation.mutate(model)}
                              />
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              )
            })}

          {models.length === 0 && modelGroups.length === 0 ? (
            <EmptyState title="暂无分类与模型" description="点击上方按钮开始创建。" />
          ) : null}
        </div>
      )}

      <NeutralAlertDialog
        open={!!deleteGroupTarget}
        onOpenChange={(open) => !open && setDeleteGroupTarget(null)}
        title="确认删除分类"
        description={`确认删除分类「${deleteGroupTarget?.name ?? ''}」？`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => {
          if (deleteGroupTarget) deleteGroupMutation.mutate(deleteGroupTarget.id)
          setDeleteGroupTarget(null)
        }}
      />
    </div>
  )
}

export { ModelCatalogTab }
