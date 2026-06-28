'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/v2/Checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/v2/Select'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared'
import Link from 'next/link'
import {
  Plus, Settings, Server, Database, Network, Box, ArrowRight,
  Trash2, PencilLine, RefreshCw, ChevronDown, MoreVertical, FolderInput, Check,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuSubContent, DropdownMenuLabel, DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { usePermission } from '@/hooks/usePermission'

interface CiModelVO {
  id: number
  modelId: string
  name: string
  icon: string
  group: string
  groupName?: string
  description: string
  isBuiltIn: boolean
  isPaused: boolean
}

interface AssociationAttrVO {
  id: number
  associationKind: string
  fieldKey: string
  name: string
  fieldType: string
  isRequired: boolean
  enumOptions: string | null
  defaultValue: string | null
  sortOrder: number
}

const FIELD_TYPE_OPTIONS = [
  { value: 'singlechar', label: '单行文本' },
  { value: 'int', label: '整数' },
  { value: 'enum', label: '枚举' },
  { value: 'list', label: '列表' },
  { value: 'bool', label: '布尔' },
  { value: 'user', label: '用户' },
  { value: 'date', label: '日期' },
]

const FIELD_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  FIELD_TYPE_OPTIONS.map(o => [o.value, o.label])
)

const ICON_MAP: Record<string, React.ElementType> = {
  server: Server, database: Database, network: Network,
}

const DEFAULT_KINDS_DEPRECATED: string[] = []   // legacy placeholder; kind list now comes from /api/cmdb/association-kinds

export default function AdminPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [tab, setTab] = useState<'catalog' | 'attribute-groups' | 'associations'>('catalog')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_model', 'read')) router.replace('/cmdb')
  }, [isHydrated, hasPermission, router])

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader eyebrow="CMDB" title="模型管理" subtitle="管理 CI 模型、属性、关联定义与分类配置。" />

      {/* Tab switcher */}
      <div className="flex gap-1 border-b mb-6">
        <button
          onClick={() => setTab('catalog')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'catalog'
              ? 'border-v2-primary text-v2-primary'
              : 'border-transparent text-v2-muted hover:text-v2-fg'
          }`}
        >
          模型目录
        </button>
        <button
          onClick={() => setTab('attribute-groups')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'attribute-groups'
              ? 'border-v2-primary text-v2-primary'
              : 'border-transparent text-v2-muted hover:text-v2-fg'
          }`}
        >
          属性分组
        </button>
        <button
          onClick={() => setTab('associations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'associations'
              ? 'border-v2-primary text-v2-primary'
              : 'border-transparent text-v2-muted hover:text-v2-fg'
          }`}
        >
          关联定义
        </button>
      </div>

      {tab === 'catalog' && <ModelCatalogTab />}
      {tab === 'attribute-groups' && <AttributeGroupsTab />}
      {tab === 'associations' && <AssociationsTab />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Model Catalog Tab — unified view of model groups + models within
// ─────────────────────────────────────────────────────────────────────────

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
  const router = useRouter()
  const queryClient = useQueryClient()
  const canWrite = hasPermission('cmdb_model', 'update')

  const [creatingModel, setCreatingModel] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [modelForm, setModelForm] = useState({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })
  const [groupForm, setGroupForm] = useState({ code: '', name: '', icon: 'folder', sortOrder: 100 })
  const [movedModelId, setMovedModelId] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [editGroupForm, setEditGroupForm] = useState({ name: '', sortOrder: 0 })

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
    onSuccess: (r) => {
      toast.success('模型已创建')
      setCreatingModel(false)
      setModelForm({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
      // 自动展开目标分类
      if (modelForm.groupCode) setExpandedGroups(s => new Set([...s, modelForm.groupCode]))
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const createGroupMutation = useMutation({
    mutationFn: () => api.post('/cmdb/model-groups', groupForm),
    onSuccess: (r) => {
      toast.success('分类已创建')
      setCreatingGroup(false)
      setGroupForm({ code: '', name: '', icon: 'folder', sortOrder: 100 })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
      // 自动展开新分类
      setExpandedGroups(s => new Set([...s, groupForm.code]))
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
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
    onError: (e: any, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['cmdb-models'], ctx.prev)
      setMovedModelId(null)
      toast.error(e?.response?.data?.message ?? '移动失败，已还原')
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

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof editGroupForm }) =>
      api.put(`/cmdb/model-groups/${id}`, body),
    onSuccess: () => {
      toast.success('分类已更新')
      setEditingGroupId(null)
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/model-groups/${id}`),
    onSuccess: () => {
      toast.success('分类已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
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

  return (
    <div>
      {/* Top bar with both create buttons */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">按分类组织的 CI 模型目录</p>
        {canWrite && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreatingGroup(v => !v)}>
              <Plus className="mr-1 h-4 w-4" />新建分类
            </Button>
            <Button size="sm" onClick={() => setCreatingModel(v => !v)}>
              <Plus className="mr-1 h-4 w-4" />新建模型
            </Button>
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
                <SelectTrigger><SelectValue placeholder="请选择分类" /></SelectTrigger>
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
                            justMoved={movedModelId === model.modelId}
                            onMove={(toCode) => moveModelMutation.mutate({ model, toCode })}
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
                            justMoved={movedModelId === model.modelId}
                            onMove={(toCode) => moveModelMutation.mutate({ model, toCode })}
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

function ModelCard({
  model, groups, canWrite, justMoved, onMove,
}: {
  model: CiModelVO
  groups: { code: string; name: string }[]
  canWrite: boolean
  justMoved: boolean
  onMove: (toCode: string) => void
}) {
  const Icon = ICON_MAP[model.icon] ?? Box
  const router = useRouter()
  return (
    <div
      className={cn(
        'group relative rounded-lg border transition-all',
        justMoved
          ? 'border-primary ring-2 ring-primary/30 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95'
          : 'hover:bg-muted/50',
      )}
    >
      <Link href={`/cmdb/admin/models/${model.modelId}`} className="block p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{model.name}</span>
              {model.isBuiltIn && <Badge variant="secondary" className="text-xs">内置</Badge>}
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{model.modelId}</p>
          </div>
          {/* 给菜单按钮留出空位，避免与图标重叠 */}
          <span className="h-7 w-7 shrink-0" aria-hidden />
        </div>
      </Link>
      {canWrite && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${model.name} 操作`}
            className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-60 transition-colors hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => router.push(`/cmdb/admin/models/${model.modelId}`)}>
              <Settings className="mr-2 h-4 w-4" />打开设置
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="mr-2 h-4 w-4" />移动到分类
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 w-48 overflow-y-auto">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">选择目标分类</DropdownMenuLabel>
                  {groups.map(g => {
                    const current = g.code === model.group
                    return (
                      <DropdownMenuItem
                        key={g.code}
                        disabled={current}
                        onClick={() => { if (!current) onMove(g.code) }}
                      >
                        <span className="flex-1 truncate">{g.name}</span>
                        {current && <Check className="ml-2 h-4 w-4 text-primary" />}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function AssociationsTab() {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canWrite = hasPermission('cmdb_model', 'update')

  // ── Association Kinds / Defs (read-only from model data) ──
  const { data: models = [] } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models')
        return r.data.data.records
      } catch {
        return []
      }
    },
    enabled: typeof window !== 'undefined',
  })

  // ── Association Kinds (real data, drives the kind dropdown) ──
  const { data: kinds = [] } = useQuery<{ id: number; code: string; name: string; isBuiltIn: boolean }[]>({
    queryKey: ['cmdb-association-kinds'],
    queryFn: async () => {
      try { return (await api.get('/cmdb/association-kinds')).data.data } catch { return [] }
    },
    enabled: typeof window !== 'undefined',
  })

  // ── Association Attribute Management (AC-5) ──
  const [selectedKind, setSelectedKind] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingAttr, setEditingAttr] = useState<AssociationAttrVO | null>(null)
  const [form, setForm] = useState({
    fieldKey: '', name: '', fieldType: 'singlechar',
    isRequired: false, enumOptions: '', defaultValue: '', sortOrder: 0,
  })

  const activeKind = selectedKind

  const { data: attrs = [], isLoading: attrsLoading, refetch: refetchAttrs } = useQuery<AssociationAttrVO[]>({
    queryKey: ['cmdb-asst-attrs', activeKind],
    queryFn: () => api.get(`/cmdb/association-kinds/${activeKind}/attributes`).then(r => r.data.data),
    enabled: !!activeKind,
  })

  const createAttrMutation = useMutation({
    mutationFn: () => api.post(`/cmdb/association-kinds/${activeKind}/attributes`, {
      fieldKey: form.fieldKey,
      name: form.name,
      fieldType: form.fieldType,
      isRequired: form.isRequired,
      enumOptions: form.fieldType === 'enum' ? form.enumOptions : undefined,
      defaultValue: form.defaultValue || undefined,
      sortOrder: form.sortOrder,
    }),
    onSuccess: () => {
      toast.success('关联扩展属性已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-asst-attrs', activeKind] })
      resetForm()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const updateAttrMutation = useMutation({
    mutationFn: (attr: AssociationAttrVO) => api.put(`/cmdb/association-kinds/${activeKind}/attributes/${attr.id}`, {
      name: form.name,
      isRequired: form.isRequired,
      enumOptions: form.fieldType === 'enum' ? form.enumOptions : undefined,
      defaultValue: form.defaultValue || undefined,
      sortOrder: form.sortOrder,
    }),
    onSuccess: () => {
      toast.success('关联扩展属性已更新')
      queryClient.invalidateQueries({ queryKey: ['cmdb-asst-attrs', activeKind] })
      resetForm()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  const deleteAttrMutation = useMutation({
    mutationFn: (attr: AssociationAttrVO) => api.delete(`/cmdb/association-kinds/${activeKind}/attributes/${attr.id}`),
    onSuccess: () => {
      toast.success('关联扩展属性已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-asst-attrs', activeKind] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  function resetForm() {
    setShowForm(false)
    setEditingAttr(null)
    setForm({ fieldKey: '', name: '', fieldType: 'singlechar', isRequired: false, enumOptions: '', defaultValue: '', sortOrder: 0 })
  }

  function startEdit(attr: AssociationAttrVO) {
    setEditingAttr(attr)
    setForm({
      fieldKey: attr.fieldKey,
      name: attr.name,
      fieldType: attr.fieldType,
      isRequired: attr.isRequired,
      enumOptions: attr.enumOptions ?? '',
      defaultValue: attr.defaultValue ?? '',
      sortOrder: attr.sortOrder,
    })
    setShowForm(true)
  }

  function handleSubmit() {
    if (editingAttr) {
      updateAttrMutation.mutate(editingAttr)
    } else {
      createAttrMutation.mutate()
    }
  }

  const formValid = form.fieldKey && form.name

  return (
    <div>
      {/* ── Association Kinds ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">关联种类</h2>
        </div>
        <div className="border rounded-lg p-4">
          {kinds.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无关联种类</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {kinds.map(k => (
                <Badge key={k.code} variant={k.isBuiltIn ? 'secondary' : 'outline'} className="text-xs">
                  {k.name} <span className="ml-1 font-mono opacity-60">({k.code})</span>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Association Defs ── */}
      <div className="mb-8">
        <AssociationDefsSection models={models} kinds={kinds} canWrite={canWrite} />
      </div>

      {/* ── Association Attribute Management (AC-5) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">关联扩展属性管理</h2>
          {activeKind && !showForm && canWrite && (
            <Button size="sm" onClick={() => { resetForm(); setShowForm(true) }}>
              <Plus className="h-4 w-4 mr-1" />新增属性
            </Button>
          )}
        </div>

        {/* Kind Selector — populated from real /api/cmdb/association-kinds */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <Label className="text-xs mb-1 block text-muted-foreground">选择关联类型</Label>
            <Select value={selectedKind} onValueChange={v => setSelectedKind(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="请选择关联类型" /></SelectTrigger>
              <SelectContent>
                {kinds.map(k => (
                  <SelectItem key={k.code} value={k.code}>
                    {k.name} <span className="text-muted-foreground ml-1 font-mono text-xs">({k.code})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Create / Edit Form */}
        {showForm && (
          <div className="border rounded-lg p-4 mb-4 bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">字段标识 * <span className="text-muted-foreground">(英文/下划线)</span></Label>
                <Input
                  value={form.fieldKey}
                  onChange={e => setForm(f => ({ ...f, fieldKey: e.target.value }))}
                  placeholder="如: os_version"
                  disabled={!!editingAttr}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">显示名称 *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="如: 操作系统版本"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">字段类型</Label>
                <Select value={form.fieldType} onValueChange={v => setForm(f => ({ ...f, fieldType: v ?? 'singlechar' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">默认值</Label>
                <Input
                  value={form.defaultValue}
                  onChange={e => setForm(f => ({ ...f, defaultValue: e.target.value }))}
                  placeholder="可选"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">排序</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-end pb-2 gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="is-required"
                    checked={form.isRequired}
                    onCheckedChange={v => setForm(f => ({ ...f, isRequired: !!v }))}
                  />
                  <Label htmlFor="is-required" className="text-xs cursor-pointer">必填</Label>
                </div>
              </div>
              {form.fieldType === 'enum' && (
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">枚举选项 <span className="text-muted-foreground">(逗号分隔)</span></Label>
                  <Input
                    value={form.enumOptions}
                    onChange={e => setForm(f => ({ ...f, enumOptions: e.target.value }))}
                    placeholder="如: v1, v2, v3"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={!formValid || createAttrMutation.isPending || updateAttrMutation.isPending}>
                {editingAttr ? '更新' : '创建'}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>取消</Button>
            </div>
          </div>
        )}

        {/* Attribute List */}
        {activeKind && (
          <>
            {attrsLoading ? (
              <p className="text-muted-foreground text-sm">加载中...</p>
            ) : attrs.length === 0 ? (
              <div className="border rounded-lg p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  关联类型「{activeKind}」暂无扩展属性定义
                </p>
                {canWrite && (
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => { resetForm(); setShowForm(true) }}>
                    <Plus className="h-4 w-4 mr-1" />新增属性
                  </Button>
                )}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">标识</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">名称</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">类型</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">必填</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">默认值</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">排序</th>
                      {canWrite && <th className="text-right px-3 py-2 font-medium text-muted-foreground">操作</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {attrs.map(attr => (
                      <tr key={attr.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2.5">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{attr.fieldKey}</code>
                        </td>
                        <td className="px-3 py-2.5 font-medium">{attr.name}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="secondary" className="text-xs font-mono">
                            {FIELD_TYPE_LABEL[attr.fieldType] ?? attr.fieldType}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {attr.isRequired ? <span className="text-destructive">是</span> : <span className="text-muted-foreground">否</span>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{attr.defaultValue || '-'}</td>
                        <td className="px-3 py-2.5 text-center text-muted-foreground">{attr.sortOrder}</td>
                        {canWrite && (
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                onClick={() => startEdit(attr)}>
                                <PencilLine className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                                onClick={() => {
                                  if (confirm(`删除扩展属性「${attr.name}」?`)) deleteAttrMutation.mutate(attr)
                                }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
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

// ─────────────────────────────────────────────────────────────────────────
// Association Defs Section — manages ci_association_def
// (which two models can be linked via which kind of association)
// ─────────────────────────────────────────────────────────────────────────

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
  { value: 'n:1', label: '多对一 (n:1)' },
  { value: 'n:n', label: '多对多 (n:n)' },
]
const ON_DELETE_OPTIONS = [
  { value: 'none', label: '无操作' },
  { value: 'cascade', label: '级联删除' },
  { value: 'restrict', label: '禁止删除' },
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

  const { data: defs = [], isLoading, isError, error, refetch } = useQuery<CiAssociationDefVO[]>({
    queryKey: ['cmdb-association-defs'],
    queryFn: async () => (await api.get('/cmdb/association-defs')).data.data,
    enabled: typeof window !== 'undefined',
    retry: (failureCount, err: any) => {
      const status = err?.response?.status
      if (status === 403 || status === 401) return false
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
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
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
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/association-defs/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-association-defs'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-defs'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  function startEdit(d: CiAssociationDefVO) {
    setEditingId(d.id)
    setEditForm({ name: d.name, mapping: d.mapping, onDelete: d.onDelete ?? 'none' })
  }

  const formValid = form.defId && form.name && form.kindId && form.srcModelId && form.dstModelId && form.mapping

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold">模型关联定义</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            声明「哪两个模型之间能用哪种关联种类建立关系」。实例详情页的「添加关联」依赖此处的定义。
          </p>
        </div>
        {canWrite && !creating && (
          <Button size="sm" onClick={() => { setForm(emptyForm); setCreating(true) }}>
            <Plus className="h-4 w-4 mr-1" />新建关联定义
          </Button>
        )}
      </div>

      {creating && (
        <div className="border rounded-lg p-4 mb-4 bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">标识 * <span className="text-muted-foreground">(英文/下划线，唯一)</span></Label>
              <Input
                value={form.defId}
                onChange={e => setForm(f => ({ ...f, defId: e.target.value }))}
                placeholder="如: app_run_on_host"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">名称 *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="如: 应用运行在主机"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">源模型 *</Label>
              <Select value={form.srcModelId} onValueChange={v => setForm(f => ({ ...f, srcModelId: v ?? '' }))}>
                <SelectTrigger>
                  <SelectValue>
                    {form.srcModelId
                      ? (models.find(m => m.modelId === form.srcModelId)?.displayName ?? models.find(m => m.modelId === form.srcModelId)?.name ?? form.srcModelId)
                      : '请选择源模型'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {models.map(m => (
                    <SelectItem key={m.modelId} value={m.modelId}>
                      {m.displayName ?? m.name} <span className="text-muted-foreground ml-1 font-mono text-xs">({m.modelId})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">目标模型 *</Label>
              <Select value={form.dstModelId} onValueChange={v => setForm(f => ({ ...f, dstModelId: v ?? '' }))}>
                <SelectTrigger>
                  <SelectValue>
                    {form.dstModelId
                      ? (models.find(m => m.modelId === form.dstModelId)?.displayName ?? models.find(m => m.modelId === form.dstModelId)?.name ?? form.dstModelId)
                      : '请选择目标模型'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {models.map(m => (
                    <SelectItem key={m.modelId} value={m.modelId}>
                      {m.displayName ?? m.name} <span className="text-muted-foreground ml-1 font-mono text-xs">({m.modelId})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">关联种类 *</Label>
              <Select value={form.kindId} onValueChange={v => setForm(f => ({ ...f, kindId: v ?? '' }))}>
                <SelectTrigger>
                  <SelectValue>
                    {form.kindId ? (kinds.find(k => k.code === form.kindId)?.name ?? form.kindId) : '请选择关联种类'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {kinds.map(k => (
                    <SelectItem key={k.code} value={k.code}>
                      {k.name} <span className="text-muted-foreground ml-1 font-mono text-xs">({k.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">基数 *</Label>
              <Select value={form.mapping} onValueChange={v => setForm(f => ({ ...f, mapping: v ?? '1:n' }))}>
                <SelectTrigger>
                  <SelectValue>
                    {MAPPING_OPTIONS.find(o => o.value === form.mapping)?.label ?? form.mapping}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MAPPING_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">删除策略</Label>
              <Select value={form.onDelete} onValueChange={v => setForm(f => ({ ...f, onDelete: v ?? 'none' }))}>
                <SelectTrigger>
                  <SelectValue>
                    {ON_DELETE_OPTIONS.find(o => o.value === form.onDelete)?.label ?? form.onDelete}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ON_DELETE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setCreating(false); setForm(emptyForm) }}>取消</Button>
            <Button size="sm" disabled={!formValid || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">加载中...</div>
        ) : isError ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-destructive">
              {(error as any)?.response?.status === 403
                ? '无 cmdb_relation:read 权限，请联系管理员'
                : `加载失败：${(error as any)?.response?.data?.message || (error as any)?.message || '未知错误'}`}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />重试
            </Button>
          </div>
        ) : defs.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            暂无关联定义。{canWrite && '点击右上角"新建关联定义"开始配置。'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">标识</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">名称</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">源 → 目标</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">关联种类</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">基数</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">删除策略</th>
                {canWrite && <th className="text-right px-3 py-2 font-medium text-muted-foreground">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {defs.map(d => editingId === d.id ? (
                <tr key={d.id} className="bg-muted/20">
                  <td className="px-3 py-2.5 font-mono text-xs">{d.defId}</td>
                  <td className="px-3 py-2.5">
                    <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {d.srcModelName} → {d.dstModelName}
                  </td>
                  <td className="px-3 py-2.5">{d.kindName}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Select value={editForm.mapping} onValueChange={v => setEditForm(f => ({ ...f, mapping: v ?? '1:n' }))}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue>{editForm.mapping}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {MAPPING_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Select value={editForm.onDelete} onValueChange={v => setEditForm(f => ({ ...f, onDelete: v ?? 'none' }))}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue>{ON_DELETE_OPTIONS.find(o => o.value === editForm.onDelete)?.label}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ON_DELETE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" className="h-7" disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: d.id, body: editForm })}>
                        保存
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditingId(null)}>
                        取消
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{d.defId}</code>
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    {d.name}
                    {d.isBuiltIn && <Badge variant="secondary" className="ml-2 text-xs">内置</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className="text-foreground">{d.srcModelName}</span>
                    <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                    <span className="text-foreground">{d.dstModelName}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-xs">{d.kindName}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs">{d.mapping}</td>
                  <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                    {ON_DELETE_OPTIONS.find(o => o.value === (d.onDelete ?? 'none'))?.label ?? d.onDelete}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          disabled={d.isBuiltIn}
                          title={d.isBuiltIn ? '内置定义不可编辑' : '编辑'}
                          onClick={() => startEdit(d)}>
                          <PencilLine className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                          disabled={d.isBuiltIn}
                          title={d.isBuiltIn ? '内置定义不可删除' : '删除'}
                          onClick={() => {
                            if (confirm(`删除关联定义「${d.name}」？已被实例使用时会拒绝删除。`)) {
                              deleteMutation.mutate(d.id)
                            }
                          }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Attribute Groups Tab — manages ci_attribute_group, scoped per model
// ─────────────────────────────────────────────────────────────────────────

interface AttributeGroupVO {
  id: number
  groupId: string
  name: string
  sortOrder: number
  isBuiltIn: boolean
  attributeCount: number
}

function AttributeGroupsTab() {
  const { hasPermission } = usePermission()
  const canWrite = hasPermission('cmdb_model', 'update')
  const queryClient = useQueryClient()
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ groupId: '', name: '', sortOrder: 0 })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', sortOrder: 0 })

  // Model picker
  const { data: models = [] } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models')
        return r.data.data.records
      } catch { return [] }
    },
    enabled: typeof window !== 'undefined',
  })

  const { data: groups = [], isLoading } = useQuery<AttributeGroupVO[]>({
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
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof editForm }) =>
      api.put(`/cmdb/models/${selectedModel}/attribute-groups/${id}`, body),
    onSuccess: () => {
      toast.success('已更新')
      queryClient.invalidateQueries({ queryKey: ['cmdb-attribute-groups', selectedModel] })
      setEditingId(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/models/${selectedModel}/attribute-groups/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-attribute-groups', selectedModel] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Label className="text-sm">模型</Label>
        <Select value={selectedModel} onValueChange={v => { setSelectedModel(v ?? ''); setEditingId(null); setCreating(false) }}>
          <SelectTrigger className="w-72"><SelectValue placeholder="请选择模型" /></SelectTrigger>
          <SelectContent>
            {models.map(m => (
              <SelectItem key={m.modelId} value={m.modelId}>
                {m.name} <span className="text-muted-foreground ml-1">({m.modelId})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedModel && canWrite && (
          <Button size="sm" onClick={() => setCreating(c => !c)} className="ml-auto">
            <Plus className="h-4 w-4 mr-1" />新建分组
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">为选定模型管理属性分组（如 基本信息 / 硬件信息）。新建模型属性时从这里选择所属分组。</p>

      {!selectedModel ? (
        <p className="text-muted-foreground text-sm text-center py-12">请先选择模型</p>
      ) : (
        <>
          {creating && (
            <div className="border rounded-lg p-4 mb-6 bg-muted/30 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">分组ID * <span className="text-muted-foreground">(英文/下划线)</span></Label>
                  <Input value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))} placeholder="如: hardware" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">名称 *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 硬件信息" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">排序</Label>
                  <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value || 0) }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.groupId || !form.name || createMutation.isPending}>创建</Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>取消</Button>
              </div>
            </div>
          )}

          {isLoading ? <p className="text-muted-foreground text-sm">加载中...</p> : groups.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">暂无分组</p>
          ) : (
            <div className="border rounded-lg divide-y">
              {groups.map(g => (
                <div key={g.id} className="p-4">
                  {editingId === g.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">分组ID（不可改）</Label>
                          <Input disabled value={g.groupId} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">名称</Label>
                          <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">排序</Label>
                          <Input type="number" value={editForm.sortOrder} onChange={e => setEditForm(f => ({ ...f, sortOrder: Number(e.target.value || 0) }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateMutation.mutate({ id: g.id, body: editForm })} disabled={updateMutation.isPending}>保存</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>取消</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{g.name}</span>
                          <code className="text-xs text-muted-foreground">{g.groupId}</code>
                          <Badge variant="outline" className="text-xs">{g.attributeCount} 属性</Badge>
                        </div>
                      </div>
                      {canWrite && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(g.id); setEditForm({ name: g.name, sortOrder: g.sortOrder }) }}>
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost"
                            disabled={g.attributeCount > 0}
                            title={g.attributeCount > 0 ? '分组下尚有属性' : ''}
                            onClick={() => { if (confirm(`确认删除分组 "${g.name}"？`)) deleteMutation.mutate(g.id) }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
