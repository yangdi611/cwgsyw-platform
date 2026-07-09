'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/v2/Dialog'
import { toast } from 'sonner'
import { Plus, Settings, ChevronDown, PencilLine, Trash2 } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { ModelCard } from './ModelCard'
import type { CiModelVO, ModelGroupVO } from './types'
import { getApiErrorMessage, getModelDisplayName, nextCopyModelId } from './utils'

function ModelCatalogTab() {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canCreateModel = hasPermission('cmdb_model', 'create')
  const canWrite = hasPermission('cmdb_model', 'update')
  const canDeleteModel = hasPermission('cmdb_model', 'delete')

  const [creatingModel, setCreatingModel] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [modelForm, setModelForm] = useState({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })
  const [groupForm, setGroupForm] = useState({ code: '', name: '', icon: 'folder', sortOrder: 100 })
  const [movedModelId, setMovedModelId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [editGroupForm, setEditGroupForm] = useState({ name: '', sortOrder: 0 })
  const [editingModel, setEditingModel] = useState<CiModelVO | null>(null)
  const [renameForm, setRenameForm] = useState({ displayName: '' })
  const [copyingModel, setCopyingModel] = useState<CiModelVO | null>(null)
  const [copyForm, setCopyForm] = useState({ modelId: '', name: '', groupCode: '' })

  const { data: models = [], isLoading: modelsLoading } = useQuery<CiModelVO[]>({
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
      if (modelForm.groupCode) setExpandedGroups(s => new Set([...s, modelForm.groupCode]))
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
      setExpandedGroups(s => new Set([...s, groupForm.code]))
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '创建失败')),
  })

  const moveModelMutation = useMutation({
    mutationFn: ({ model, toCode }: { model: CiModelVO; toCode: string }) =>
      api.put(`/cmdb/models/${model.id}`, { group: toCode }),
    onMutate: async ({ model, toCode }) => {
      await queryClient.cancelQueries({ queryKey: ['cmdb-models'] })
      const prev = queryClient.getQueryData<CiModelVO[]>(['cmdb-models'])
      const toName = modelGroups.find(g => g.code === toCode)?.name ?? toCode
      queryClient.setQueryData<CiModelVO[]>(['cmdb-models'], (old = []) =>
        old.map(m => m.modelId === model.modelId ? { ...m, group: toCode, groupName: toName } : m))
      setMovedModelId(model.modelId)
      // 展开目标分类以显示刚移入的模型
      setExpandedGroups(s => new Set([...s, toCode]))
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
        action: fromCode === toCode ? undefined : {
          label: '撤销',
          onClick: () => moveModelMutation.mutate({ model: { ...model, group: toCode }, toCode: fromCode }),
        },
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
      window.setTimeout(() => setMovedModelId(null), 1200)
    },
  })

  const deleteModelMutation = useMutation({
    mutationFn: (model: CiModelVO) => api.delete(`/cmdb/models/${model.id}`),
    onSuccess: (_data, model) => {
      toast.success(`模型「${model.name}」已删除`)
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '删除失败')),
  })

  const renameModelMutation = useMutation({
    mutationFn: ({ model, displayName }: { model: CiModelVO; displayName: string }) =>
      api.put(`/cmdb/models/${model.id}`, { displayName }),
    onSuccess: (_data, { model, displayName }) => {
      toast.success(`模型「${getModelDisplayName(model)}」已重命名`)
      setEditingModel(null)
      setRenameForm({ displayName: '' })
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model', model.modelId] })
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '重命名失败')),
  })

  const copyModelMutation = useMutation({
    mutationFn: ({ model, body }: { model: CiModelVO; body: { modelId: string; name: string; groupCode: string } }) =>
      api.post(`/cmdb/models/${model.id}/copy`, body),
    onSuccess: (_data, { body }) => {
      toast.success(`模型「${body.name}」已复制`)
      setCopyingModel(null)
      setCopyForm({ modelId: '', name: '', groupCode: '' })
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
      setExpandedGroups(s => new Set([...s, body.groupCode]))
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
  }, {} as Record<string, CiModelVO[]>)

  const toggleGroup = (code: string) => {
    setExpandedGroups(s => {
      const next = new Set(s)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const openRenameModel = (model: CiModelVO) => {
    setCopyingModel(null)
    setEditingModel(model)
    setRenameForm({ displayName: getModelDisplayName(model) })
  }

  const openCopyModel = (model: CiModelVO) => {
    const displayName = getModelDisplayName(model)
    setEditingModel(null)
    setCopyingModel(model)
    setCopyForm({
      modelId: nextCopyModelId(model.modelId, models),
      name: `${displayName} 副本`,
      groupCode: model.group || modelGroups[0]?.code || '',
    })
  }

  return (
    <div>
      {/* Top bar with both create buttons */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">按分类组织的 CI 模型目录</p>
        {(canWrite || canCreateModel) && (
          <div className="flex gap-2">
            {canWrite && (
              <Button size="sm" variant="outline" onClick={() => setCreatingGroup(v => !v)}>
                <Plus className="mr-1 h-4 w-4" />新建分类
              </Button>
            )}
            {canCreateModel && (
              <Button size="sm" onClick={() => setCreatingModel(v => !v)}>
                <Plus className="mr-1 h-4 w-4" />新建模型
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create group form */}
      {creatingGroup && (
        <div className="mb-6 space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">分类代码 * <span className="text-muted-foreground">(英文/下划线)</span></Label>
              <Input value={groupForm.code} onChange={e => setGroupForm(f => ({ ...f, code: e.target.value }))} placeholder="如: middleware" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">分类名称 *</Label>
              <Input value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 中间件" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">排序</Label>
              <Input type="number" value={groupForm.sortOrder} onChange={e => setGroupForm(f => ({ ...f, sortOrder: +e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createGroupMutation.mutate()} disabled={!groupForm.code || !groupForm.name || createGroupMutation.isPending}>创建</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreatingGroup(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* Create model form */}
      {creatingModel && (
        <div className="mb-6 space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">模型ID * <span className="text-muted-foreground">(英文/下划线)</span></Label>
              <Input value={modelForm.modelId} onChange={e => setModelForm(f => ({ ...f, modelId: e.target.value }))} placeholder="如: mysql_instance" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">模型名称 *</Label>
              <Input value={modelForm.name} onChange={e => setModelForm(f => ({ ...f, name: e.target.value }))} placeholder="如: MySQL实例" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">所属分类</Label>
              <Select value={modelForm.groupCode} onValueChange={v => setModelForm(f => ({ ...f, groupCode: v ?? '' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择分类">
                    {(v: string) => modelGroups.find(g => g.code === v)?.name ?? '请选择分类'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {modelGroups.map(g => (
                    <SelectItem key={g.code} value={g.code}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">描述</Label>
              <Input value={modelForm.description} onChange={e => setModelForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createModelMutation.mutate()} disabled={!modelForm.modelId || !modelForm.name || createModelMutation.isPending}>创建</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreatingModel(false)}>取消</Button>
          </div>
        </div>
      )}

      {editingModel && (
        <div className="mb-6 space-y-3 rounded-lg border bg-muted/30 p-4">
          <div>
            <p className="text-sm font-medium">重命名模型</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{editingModel.modelId}</p>
          </div>
          <div className="max-w-md space-y-1">
            <Label className="text-xs">模型名称 *</Label>
            <Input
              value={renameForm.displayName}
              onChange={e => setRenameForm({ displayName: e.target.value })}
              placeholder="如: MySQL实例"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => renameModelMutation.mutate({ model: editingModel, displayName: renameForm.displayName.trim() })}
              disabled={!renameForm.displayName.trim() || renameModelMutation.isPending}
            >
              保存
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingModel(null)}>取消</Button>
          </div>
        </div>
      )}

      {copyingModel && (
        <div className="mb-6 space-y-3 rounded-lg border bg-muted/30 p-4">
          <div>
            <p className="text-sm font-medium">复制模型</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              复制「{getModelDisplayName(copyingModel)}」的属性分组和属性定义，不复制实例数据
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">新模型ID * <span className="text-muted-foreground">(英文/下划线)</span></Label>
              <Input
                value={copyForm.modelId}
                onChange={e => setCopyForm(f => ({ ...f, modelId: e.target.value }))}
                placeholder="如: mysql_instance_copy"
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">新模型名称 *</Label>
              <Input
                value={copyForm.name}
                onChange={e => setCopyForm(f => ({ ...f, name: e.target.value }))}
                placeholder="如: MySQL实例副本"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">所属分类</Label>
              <Select value={copyForm.groupCode} onValueChange={v => setCopyForm(f => ({ ...f, groupCode: v ?? '' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择分类">
                    {(v: string) => modelGroups.find(g => g.code === v)?.name ?? '请选择分类'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {modelGroups.map(g => (
                    <SelectItem key={g.code} value={g.code}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => copyModelMutation.mutate({
                model: copyingModel,
                body: {
                  modelId: copyForm.modelId.trim(),
                  name: copyForm.name.trim(),
                  groupCode: copyForm.groupCode,
                },
              })}
              disabled={!copyForm.modelId.trim() || !copyForm.name.trim() || !copyForm.groupCode || copyModelMutation.isPending}
            >
              复制
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCopyingModel(null)}>取消</Button>
          </div>
        </div>
      )}

      {/* Group accordion list */}
      {modelsLoading || groupsLoading ? (
        <p className="text-sm text-muted-foreground">加载中...</p>
      ) : (
        <div className="space-y-2">
          {modelGroups.map(g => {
            const groupModels = grouped[g.code] ?? []
            const isExpanded = expandedGroups.has(g.code)
            const isEditing = editingGroupId === g.id
            return (
              <div key={g.code} className="overflow-hidden rounded-lg border">
                {/* Group header row */}
                <div
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors',
                    isExpanded ? 'bg-muted/40' : 'hover:bg-muted/30 cursor-pointer'
                  )}
                  onClick={() => !isEditing && toggleGroup(g.code)}
                >
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                  {isEditing ? (
                    <>
                      <Input className="h-8" value={editGroupForm.name} onChange={e => setEditGroupForm(f => ({ ...f, name: e.target.value }))} />
                      <Input className="h-8 w-20" type="number" value={editGroupForm.sortOrder} onChange={e => setEditGroupForm(f => ({ ...f, sortOrder: +e.target.value }))} />
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); updateGroupMutation.mutate({ id: g.id, body: editGroupForm }) }}>保存</Button>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditingGroupId(null) }}>取消</Button>
                    </>
                  ) : (
                    <>
                      <div className="flex min-w-0 flex-1 items-baseline gap-2">
                        <span className="truncate text-sm font-medium">{g.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{groupModels.length} 个模型</span>
                        {g.isBuiltIn && <Badge variant="secondary" className="shrink-0 text-xs">内置</Badge>}
                      </div>
                      {canWrite && (
                        <div className="flex shrink-0 gap-1" onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingGroupId(g.id); setEditGroupForm({ name: g.name, sortOrder: g.sortOrder }) }}>
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={groupModels.length > 0}
                            title={groupModels.length > 0 ? '分类下尚有模型' : ''}
                            onClick={() => { if (confirm(`确认删除分类「${g.name}」？`)) deleteGroupMutation.mutate(g.id) }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t bg-background p-4">
                    {groupModels.length === 0 ? (
                      <p className="rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground/70">
                        该分类暂无模型 · 新建模型时选择此分类，或用「移动到分类」功能将模型移入
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {groupModels.map(model => (
                          <ModelCard
                            key={model.modelId}
                            model={model}
                            groups={modelGroups.map(mg => ({ code: mg.code, name: mg.name }))}
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
                )}
              </div>
            )
          })}

          {/* Orphan models (no group or unknown group) */}
          {Object.entries(grouped)
            .filter(([code]) => !modelGroups.some(g => g.code === code))
            .map(([code, groupModels]) => {
              const isExpanded = expandedGroups.has(code)
              return (
                <div key={code} className="overflow-hidden rounded-lg border">
                  <div
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                    onClick={() => toggleGroup(code)}
                  >
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                    <div className="flex min-w-0 flex-1 items-baseline gap-2">
                      <span className="truncate text-sm font-medium text-muted-foreground">{groupModels[0]?.groupName || '未分类'}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{groupModels.length} 个模型</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t bg-background p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {groupModels.map(model => (
                          <ModelCard
                            key={model.modelId}
                            model={model}
                            groups={modelGroups.map(mg => ({ code: mg.code, name: mg.name }))}
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
                  )}
                </div>
              )
            })}

          {models.length === 0 && modelGroups.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">暂无分类与模型 · 点击上方按钮开始创建</p>
          )}
        </div>
      )}
    </div>
  )
}



export { ModelCatalogTab }
