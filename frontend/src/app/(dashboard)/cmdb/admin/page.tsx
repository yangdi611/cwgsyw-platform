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
  Trash2, PencilLine, RefreshCw,
} from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiModelVO {
  id: number
  modelId: string
  name: string
  icon: string
  group_code: string
  description: string
  isBuiltIn: boolean
  is_paused: boolean
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
  const [tab, setTab] = useState<'models' | 'model-groups' | 'attribute-groups' | 'associations'>('models')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_model', 'update')) router.replace('/cmdb')
  }, [isHydrated, hasPermission, router])

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader eyebrow="CMDB" title="配置管理" subtitle="管理 CI 模型、模型分类、属性分组与关联定义。" />

      {/* Tab switcher */}
      <div className="flex gap-1 border-b mb-6">
        <button
          onClick={() => setTab('models')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'models'
              ? 'border-v2-primary text-v2-primary'
              : 'border-transparent text-v2-muted hover:text-v2-fg'
          }`}
        >
          模型管理
        </button>
        <button
          onClick={() => setTab('model-groups')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'model-groups'
              ? 'border-v2-primary text-v2-primary'
              : 'border-transparent text-v2-muted hover:text-v2-fg'
          }`}
        >
          模型分类
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

      {tab === 'models' && <ModelsTab />}
      {tab === 'model-groups' && <ModelGroupsTab />}
      {tab === 'attribute-groups' && <AttributeGroupsTab />}
      {tab === 'associations' && <AssociationsTab />}
    </div>
  )
}

function ModelsTab() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })

  const { data: models = [], isLoading } = useQuery<CiModelVO[]>({
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

  const { data: modelGroups = [] } = useQuery<{ code: string; name: string }[]>({
    queryKey: ['cmdb-model-groups'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/model-groups')
        return r.data.data
      } catch { return [] }
    },
    enabled: typeof window !== 'undefined',
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/cmdb/models', {
      modelId: form.modelId, name: form.name, icon: form.icon,
      group_code: form.groupCode || undefined, description: form.description || undefined,
    }),
    onSuccess: (res) => {
      toast.success('模型已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      setCreating(false)
      setForm({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })
      router.push(`/cmdb/admin/models/${res.data.data.modelId}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const grouped = models.reduce((acc, m) => {
    const key = m.group_code || '未分类'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, CiModelVO[]>)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">管理 CI 模型和属性定义</p>
        {hasPermission('cmdb_model', 'update') && (
          <Button size="sm" onClick={() => setCreating(v => !v)}>
            <Plus className="h-4 w-4 mr-1" />新建模型
          </Button>
        )}
      </div>

      {creating && (
        <div className="border rounded-lg p-4 mb-6 bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">模型ID * <span className="text-muted-foreground">(英文/下划线)</span></Label>
              <Input value={form.modelId} onChange={e => setForm(f => ({ ...f, modelId: e.target.value }))} placeholder="如: mysql_instance" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">模型名称 *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如: MySQL实例" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">所属分类</Label>
              <Select value={form.groupCode} onValueChange={v => setForm(f => ({ ...f, groupCode: v ?? '' }))}>
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
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.modelId || !form.name || createMutation.isPending}>创建</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>取消</Button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-muted-foreground text-sm">加载中...</p> : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([group, groupModels]) => (
            <div key={group}>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">{group}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {groupModels.map(model => {
                  const Icon = ICON_MAP[model.icon] ?? Box
                  return (
                    <Link key={model.modelId} href={`/cmdb/admin/models/${model.modelId}`}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors block">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-md">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{model.name}</span>
                            {model.isBuiltIn && <Badge variant="secondary" className="text-xs">内置</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{model.modelId}</p>
                        </div>
                        <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
          {models.length === 0 && <p className="text-muted-foreground text-sm text-center py-12">暂无模型</p>}
        </div>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">模型关联定义</h2>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            模型间关联定义由后端数据初始化。创建/编辑功能需要后端补充独立管理端点。
            关联关系可在实例详情页的「关联关系」Tab 中管理。
          </p>
        </div>
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
// Model Groups Tab — manages ci_model_group (categories like 主机管理 / 应用管理)
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

function ModelGroupsTab() {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', icon: '', sortOrder: 0 })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', icon: '', sortOrder: 0 })

  const { data: groups = [], isLoading } = useQuery<ModelGroupVO[]>({
    queryKey: ['cmdb-model-groups'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/model-groups')
        return r.data.data
      } catch { return [] }
    },
    enabled: typeof window !== 'undefined',
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/cmdb/model-groups', form),
    onSuccess: () => {
      toast.success('分类已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      setCreating(false)
      setForm({ code: '', name: '', icon: '', sortOrder: 0 })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof editForm }) =>
      api.put(`/cmdb/model-groups/${id}`, body),
    onSuccess: () => {
      toast.success('已更新')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
      setEditingId(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/model-groups/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-groups'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">管理模型分类（如 主机管理 / 应用管理）。新建模型时从这里选择所属分类。</p>
        <Button size="sm" onClick={() => setCreating(c => !c)}>
          <Plus className="h-4 w-4 mr-1" />新建分类
        </Button>
      </div>

      {creating && (
        <div className="border rounded-lg p-4 mb-6 bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">编码 * <span className="text-muted-foreground">(英文/下划线)</span></Label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="如: middleware" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">名称 *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 中间件" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">图标 <span className="text-muted-foreground">(可选)</span></Label>
              <Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="如: server / database / network" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">排序</Label>
              <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value || 0) }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.code || !form.name || createMutation.isPending}>创建</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>取消</Button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-muted-foreground text-sm">加载中...</p> : groups.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">暂无分类</p>
      ) : (
        <div className="border rounded-lg divide-y">
          {groups.map(g => (
            <div key={g.id} className="p-4">
              {editingId === g.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">编码（不可改）</Label>
                      <Input disabled value={g.code} />
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
                      <code className="text-xs text-muted-foreground">{g.code}</code>
                      {g.isBuiltIn && <Badge variant="secondary" className="text-xs">内置</Badge>}
                      <Badge variant="outline" className="text-xs">{g.modelCount} 模型</Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(g.id); setEditForm({ name: g.name, icon: g.icon ?? '', sortOrder: g.sortOrder }) }}>
                    <PencilLine className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost"
                    disabled={g.isBuiltIn || g.modelCount > 0}
                    title={g.isBuiltIn ? '内置不可删除' : g.modelCount > 0 ? '分组下尚有模型' : ''}
                    onClick={() => { if (confirm(`确认删除分类 "${g.name}"？`)) deleteMutation.mutate(g.id) }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
        {selectedModel && (
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
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(g.id); setEditForm({ name: g.name, sortOrder: g.sortOrder }) }}>
                        <PencilLine className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost"
                        disabled={g.attributeCount > 0}
                        title={g.attributeCount > 0 ? '分组下尚有属性' : ''}
                        onClick={() => { if (confirm(`确认删除分组 "${g.name}"？`)) deleteMutation.mutate(g.id) }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
