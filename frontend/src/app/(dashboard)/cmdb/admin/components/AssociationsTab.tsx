'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/design-system'
import { toast } from 'sonner'
import { Plus, Trash2, PencilLine } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { AssociationDefsSection } from './AssociationDefsSection'
import type { CiModelAdminItem } from '@/types/cmdb-model'
import { getApiErrorMessage } from '@/lib/api-error'

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
  { value: 'date', label: '日期' },
]

const FIELD_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  FIELD_TYPE_OPTIONS.map(o => [o.value, o.label])
)

const DEFAULT_KINDS_DEPRECATED: string[] = []

function AssociationsTab() {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canWrite = hasPermission('cmdb_model', 'update')

  // ── Association Kinds / Defs (read-only from model data) ──
  const { data: models = [] } = useQuery<CiModelAdminItem[]>({
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
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '创建失败')),
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
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '更新失败')),
  })

  const deleteAttrMutation = useMutation({
    mutationFn: (attr: AssociationAttrVO) => api.delete(`/cmdb/association-kinds/${activeKind}/attributes/${attr.id}`),
    onSuccess: () => {
      toast.success('关联扩展属性已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-asst-attrs', activeKind] })
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '删除失败')),
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
            <Button size="sm" variant="primary" onClick={() => { resetForm(); setShowForm(true) }}>
              <Plus className="h-4 w-4 mr-1" />新增属性
            </Button>
          )}
        </div>

        {/* Kind Selector — populated from real /api/cmdb/association-kinds */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <Label className="text-xs mb-1 block text-muted-foreground">选择关联类型</Label>
            <Select value={selectedKind} onValueChange={v => setSelectedKind(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="请选择关联类型">
                  {(v: string) => {
                    const k = kinds.find(kk => kk.code === v)
                    return k ? `${k.name} (${k.code})` : '请选择关联类型'
                  }}
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
                  <SelectTrigger>
                    <SelectValue>
                      {(v: string) => FIELD_TYPE_OPTIONS.find(o => o.value === v)?.label ?? v}
                    </SelectValue>
                  </SelectTrigger>
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


export { AssociationsTab }
