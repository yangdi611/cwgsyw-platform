'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
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

const DEFAULT_KINDS = ['connected_to', 'depends_on', 'contains', 'deployed_on', 'runs_on']

export default function AdminPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [tab, setTab] = useState<'models' | 'associations'>('models')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_model', 'write')) router.replace('/cmdb')
  }, [isHydrated, hasPermission, router])

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">CMDB 配置管理</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b mb-6">
        <button
          onClick={() => setTab('models')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'models'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          模型管理
        </button>
        <button
          onClick={() => setTab('associations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'associations'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          关联定义
        </button>
      </div>

      {tab === 'models' && <ModelsTab />}
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
        return r.data.data
      } catch {
        return []
      }
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
        {hasPermission('cmdb_model', 'write') && (
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
              <Input value={form.groupCode} onChange={e => setForm(f => ({ ...f, groupCode: e.target.value }))} placeholder="如: middleware" />
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
  const canWrite = hasPermission('cmdb_model', 'write')

  // ── Association Kinds / Defs (read-only from model data) ──
  const { data: models = [] } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models')
        return r.data.data
      } catch {
        return []
      }
    },
    enabled: typeof window !== 'undefined',
  })

  // ── Association Attribute Management (AC-5) ──
  const [selectedKind, setSelectedKind] = useState('')
  const [kindInput, setKindInput] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingAttr, setEditingAttr] = useState<AssociationAttrVO | null>(null)
  const [form, setForm] = useState({
    fieldKey: '', name: '', fieldType: 'singlechar',
    isRequired: false, enumOptions: '', defaultValue: '', sortOrder: 0,
  })

  const activeKind = selectedKind || kindInput

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
          <p className="text-sm text-muted-foreground">
            关联种类由系统预定义，可通过模型关联关系自动推断。
            当前系统中定义了 <strong>{models.length}</strong> 个 CI 模型。
          </p>
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

        {/* Kind Selector */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <Label className="text-xs mb-1 block text-muted-foreground">选择关联类型</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="输入关联类型ID, 如: connected_to"
                  value={kindInput}
                  onChange={e => setKindInput(e.target.value)}
                  list="kind-suggestions"
                />
                <datalist id="kind-suggestions">
                  {DEFAULT_KINDS.map(k => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => { setSelectedKind(kindInput); refetchAttrs() }}
                disabled={!kindInput}
                title="加载属性"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {selectedKind && selectedKind !== kindInput && (
            <div className="flex items-end pb-0.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => { setKindInput(selectedKind); setSelectedKind(selectedKind); refetchAttrs() }}
                title="使用已选类型"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          )}
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
