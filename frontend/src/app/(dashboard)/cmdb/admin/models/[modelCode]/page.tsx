'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card, CardContent } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Checkbox } from '@/components/v2/Checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/v2/Dialog'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiAttributeVO {
  id: number
  fieldKey: string
  name: string
  groupId: string
  fieldType: string
  isRequired: boolean
  isEditable: boolean
  isUnique: boolean
  isBuiltIn: boolean
  isListShow: boolean
  isDrawerShow: boolean
  sortOrder: number
  placeholder: string
  unit: string
  defaultValue?: string
  // option：enum/enummulti 为数组 [{id,name}]；table 为对象 schema {schema_version,row_key,columns}（§4.1）
  option?: Array<{ id: string; name: string; isDefault?: boolean }> | Record<string, unknown> | null
}
interface CiAttributeGroupVO {
  id: number
  groupId: string
  name: string
  isDefault: boolean
  isBuiltIn: boolean
}
interface CiModelVO {
  id: number
  modelId: string
  modelCode?: string
  displayName?: string
  name: string
  icon: string
  isBuiltIn: boolean
  attributes: CiAttributeVO[]
  attributeGroups: CiAttributeGroupVO[]
}

const FIELD_TYPES = [
  { value: 'singlechar', label: '单行文本' },
  { value: 'longchar', label: '多行文本' },
  { value: 'int', label: '整数' },
  { value: 'float', label: '浮点数' },
  { value: 'enum', label: '单选枚举' },
  { value: 'enummulti', label: '多选枚举' },
  { value: 'date', label: '日期' },
  { value: 'bool', label: '是/否' },
  { value: 'objuser', label: '用户' },
  { value: 'table', label: '表格' },
]

/** table 子列 schema 模板（§4.1，含系统列 row_id）。 */
const TABLE_SCHEMA_TEMPLATE = {
  schema_version: 1,
  row_key: 'row_id',
  display_key: 'name',
  columns: [
    { key: 'row_id', name: '行ID', type: 'singlechar', system: true, required: true },
    { key: 'name', name: '名称', type: 'singlechar', required: true },
    { key: 'value', name: '值', type: 'singlechar' },
  ],
}

/** option 可能是 enum 数组或 table 对象 schema，统一转 JSON 字符串供文本框编辑（空则空串）。 */
function optionToJson(option: unknown): string {
  if (option == null) return ''
  if (Array.isArray(option)) return option.length > 0 ? JSON.stringify(option, null, 2) : ''
  if (typeof option === 'object' && Object.keys(option as object).length > 0) {
    return JSON.stringify(option, null, 2)
  }
  return ''
}

type ChipTone = 'default' | 'primary' | 'success' | 'danger' | 'neutral'

function Chip({ children, tone = 'default' }: { children: React.ReactNode; tone?: ChipTone }) {
  const cls: Record<ChipTone, string> = {
    default: 'border-v2-border bg-v2-surface-soft text-v2-fg',
    primary: 'border-v2-primary-border bg-v2-primary-soft text-v2-primary',
    success: 'border-v2-success-border bg-v2-success-soft text-v2-success',
    danger: 'border-v2-danger-border bg-v2-danger-soft text-v2-danger',
    neutral: 'border-v2-border bg-v2-surface-soft text-v2-muted',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${cls[tone]}`}>
      {children}
    </span>
  )
}

export default function ModelDetailPage() {
  const { modelCode } = useParams<{ modelCode: string }>()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canWrite = hasPermission('cmdb_model', 'update')
  const [addingAttr, setAddingAttr] = useState(false)
  const [editingAttr, setEditingAttr] = useState<CiAttributeVO | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    isRequired: false,
    isEditable: true,
    isListShow: false,
    isDrawerShow: false,
    sortOrder: 0,
    defaultValue: '',
    optionJson: '',
  })
  const [newAttr, setNewAttr] = useState({
    fieldKey: '',
    name: '',
    fieldType: 'singlechar',
    groupId: 'default',
    isRequired: false,
    isUnique: false,
    isListShow: true,
    isDrawerShow: true,
    placeholder: '',
    unit: '',
  })

  const { data: model, isLoading } = useQuery<CiModelVO>({
    queryKey: ['cmdb-model', modelCode],
    queryFn: async () => {
      try {
        const r = await api.get(`/cmdb/models/${modelCode}`)
        return r.data.data
      } catch {
        return undefined
      }
    },
    enabled: typeof window !== 'undefined',
  })

  const addAttrMutation = useMutation({
    mutationFn: () =>
      api.post(`/cmdb/models/${modelCode}/attributes`, {
        fieldKey: newAttr.fieldKey,
        name: newAttr.name,
        fieldType: newAttr.fieldType,
        groupId: newAttr.groupId,
        isRequired: newAttr.isRequired,
        isUnique: newAttr.isUnique,
        isListShow: newAttr.isListShow,
        isDrawerShow: newAttr.isDrawerShow,
        placeholder: newAttr.placeholder || undefined,
        unit: newAttr.unit || undefined,
      }),
    onSuccess: () => {
      toast.success('属性已添加')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model', modelCode] })
      setAddingAttr(false)
      setNewAttr({
        fieldKey: '',
        name: '',
        fieldType: 'singlechar',
        groupId: 'default',
        isRequired: false,
        isUnique: false,
        isListShow: true,
        isDrawerShow: true,
        placeholder: '',
        unit: '',
      })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '添加失败'),
  })

  const deleteAttrMutation = useMutation({
    mutationFn: (attrId: number) => api.delete(`/cmdb/models/${modelCode}/attributes/${attrId}`),
    onSuccess: () => {
      toast.success('属性已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model', modelCode] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const updateAttrMutation = useMutation({
    mutationFn: async () => {
      if (!editingAttr) return
      let option: unknown
      const isEnum = editingAttr.fieldType === 'enum' || editingAttr.fieldType === 'enummulti'
      const isTable = editingAttr.fieldType === 'table'
      if ((isEnum || isTable) && editForm.optionJson.trim()) {
        try {
          const parsed = JSON.parse(editForm.optionJson)
          if (isEnum && !Array.isArray(parsed)) throw new Error('not array')
          if (isTable && (Array.isArray(parsed) || typeof parsed !== 'object')) {
            throw new Error('table schema 应为对象')
          }
          option = parsed
        } catch (err) {
          throw new Error(
            isTable
              ? '表格 schema JSON 无效，需要是对象 {schema_version,row_key,columns:[...]}'
              : '选项 JSON 格式无效，需要是数组',
          )
        }
      }
      await api.put(`/cmdb/models/${modelCode}/attributes/${editingAttr.id}`, {
        name: editForm.name,
        isRequired: editForm.isRequired,
        isEditable: editForm.isEditable,
        isListShow: editForm.isListShow,
        isDrawerShow: editForm.isDrawerShow,
        sortOrder: editForm.sortOrder,
        defaultValue: editForm.defaultValue || null,
        option,
      })
    },
    onSuccess: () => {
      toast.success('已保存')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model', modelCode] })
      setEditingAttr(null)
    },
    onError: (e: any) => toast.error(e?.message ?? e?.response?.data?.message ?? '保存失败'),
  })

  function openEdit(attr: CiAttributeVO) {
    setEditingAttr(attr)
    setEditForm({
      name: attr.name,
      isRequired: !!attr.isRequired,
      isEditable: attr.isEditable !== false,
      isListShow: !!attr.isListShow,
      isDrawerShow: !!attr.isDrawerShow,
      sortOrder: attr.sortOrder ?? 0,
      defaultValue: attr.defaultValue ?? '',
      optionJson: optionToJson(attr.option),
    })
  }

  if (isLoading) return <p className="text-v2-muted">加载中…</p>
  if (!model) return <p className="text-v2-danger">模型不存在</p>

  const attrsByGroup = (model.attributes ?? []).reduce((acc, a) => {
    const g = a.groupId || 'default'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {} as Record<string, CiAttributeVO[]>)

  const groups = model.attributeGroups ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/cmdb/admin"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-v2-fg">{model.name}</h1>
            {model.isBuiltIn && <Chip tone="primary">内置</Chip>}
          </div>
          <p className="mt-0.5 font-v2-mono text-xs text-v2-muted">{model.modelId}</p>
        </div>
        <Link
          href={`/cmdb/instances/by-model/${modelCode}`}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md border border-v2-border bg-v2-surface text-v2-fg text-sm font-semibold shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
        >
          查看实例
        </Link>
        {canWrite && (
          <Button variant="primary" onClick={() => setAddingAttr((v) => !v)}>
            <Plus className="h-4 w-4" />
            添加属性
          </Button>
        )}
      </div>

      {addingAttr && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">字段 Key *</Label>
                <Input
                  value={newAttr.fieldKey}
                  onChange={(e) => setNewAttr((f) => ({ ...f, fieldKey: e.target.value }))}
                  placeholder="如: port"
                  className="font-v2-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">显示名称 *</Label>
                <Input
                  value={newAttr.name}
                  onChange={(e) => setNewAttr((f) => ({ ...f, name: e.target.value }))}
                  placeholder="如: 端口"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">字段类型 *</Label>
                <Select
                  value={newAttr.fieldType}
                  onValueChange={(v) => setNewAttr((f) => ({ ...f, fieldType: v ?? 'singlechar' }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">所属分组</Label>
                <Select
                  value={newAttr.groupId}
                  onValueChange={(v) => setNewAttr((f) => ({ ...f, groupId: v ?? 'default' }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.groupId} value={g.groupId}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">提示文字</Label>
                <Input
                  value={newAttr.placeholder}
                  onChange={(e) => setNewAttr((f) => ({ ...f, placeholder: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">单位</Label>
                <Input
                  value={newAttr.unit}
                  onChange={(e) => setNewAttr((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="如: GB, Hz"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-v2-fg">
              <label className="flex cursor-pointer items-center gap-1.5">
                <Checkbox
                  checked={newAttr.isRequired}
                  onCheckedChange={(v) => setNewAttr((f) => ({ ...f, isRequired: !!v }))}
                />
                必填
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <Checkbox
                  checked={newAttr.isUnique}
                  onCheckedChange={(v) => setNewAttr((f) => ({ ...f, isUnique: !!v }))}
                />
                唯一
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <Checkbox
                  checked={newAttr.isListShow}
                  onCheckedChange={(v) => setNewAttr((f) => ({ ...f, isListShow: !!v }))}
                />
                列表显示
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <Checkbox
                  checked={newAttr.isDrawerShow}
                  onCheckedChange={(v) => setNewAttr((f) => ({ ...f, isDrawerShow: !!v }))}
                />
                详情显示
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => addAttrMutation.mutate()}
                disabled={!newAttr.fieldKey || !newAttr.name || addAttrMutation.isPending}
              >
                保存
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAddingAttr(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {groups.map((group) => {
          const attrs = attrsByGroup[group.groupId] ?? []
          return (
            <div key={group.groupId} className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface">
              <div className="flex items-center gap-2 bg-v2-surface-soft px-4 py-2.5">
                <span className="text-sm font-bold text-v2-fg">{group.name}</span>
                <Chip>{attrs.length}</Chip>
                {group.isDefault && <Chip tone="neutral">默认</Chip>}
              </div>
              {attrs.length === 0 ? (
                <p className="px-4 py-3 text-xs text-v2-muted">暂无属性</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-v2-surface-soft/50 text-xs text-v2-muted">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold">字段 Key</th>
                        <th className="px-4 py-2 text-left font-semibold">名称</th>
                        <th className="px-4 py-2 text-left font-semibold">类型</th>
                        <th className="px-4 py-2 text-left font-semibold">属性</th>
                        {canWrite && <th className="w-10 px-4 py-2" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-v2-border">
                      {attrs.map((attr) => (
                        <tr key={attr.fieldKey} className="hover:bg-v2-surface-hover">
                          <td className="px-4 py-2.5 font-v2-mono text-xs text-v2-fg">{attr.fieldKey}</td>
                          <td className="px-4 py-2.5 text-v2-fg">{attr.name}</td>
                          <td className="px-4 py-2.5">
                            <Chip>
                              {FIELD_TYPES.find((t) => t.value === attr.fieldType)?.label ?? attr.fieldType}
                            </Chip>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {attr.isRequired && <Chip tone="danger">必填</Chip>}
                              {attr.isUnique && <Chip tone="success">唯一</Chip>}
                              {attr.isBuiltIn && <Chip tone="primary">内置</Chip>}
                            </div>
                          </td>
                          {canWrite && (
                            <td className="px-4 py-2.5 text-right">
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-v2-muted hover:text-v2-fg"
                                  title="编辑"
                                  onClick={() => openEdit(attr)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                {!attr.isBuiltIn && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-v2-danger"
                                    disabled={deleteAttrMutation.isPending}
                                    title="删除"
                                    onClick={() => {
                                      if (confirm(`删除属性 "${attr.name}"?`))
                                        deleteAttrMutation.mutate(attr.id)
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Dialog open={!!editingAttr} onOpenChange={(o) => !o && setEditingAttr(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              编辑属性
              {editingAttr && (
                <span className="ml-2 font-v2-mono text-xs font-normal text-v2-muted">
                  {editingAttr.fieldKey}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {editingAttr && (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">显示名称</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">排序</Label>
                  <Input
                    type="number"
                    value={editForm.sortOrder}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">默认值</Label>
                  <Input
                    value={editForm.defaultValue}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, defaultValue: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-v2-fg">
                <label className="flex cursor-pointer items-center gap-1.5">
                  <Checkbox
                    checked={editForm.isRequired}
                    onCheckedChange={(v) =>
                      setEditForm((f) => ({ ...f, isRequired: !!v }))
                    }
                  />
                  必填
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <Checkbox
                    checked={editForm.isEditable}
                    onCheckedChange={(v) =>
                      setEditForm((f) => ({ ...f, isEditable: !!v }))
                    }
                  />
                  可编辑
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <Checkbox
                    checked={editForm.isListShow}
                    onCheckedChange={(v) =>
                      setEditForm((f) => ({ ...f, isListShow: !!v }))
                    }
                  />
                  列表显示
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                  <Checkbox
                    checked={editForm.isDrawerShow}
                    onCheckedChange={(v) =>
                      setEditForm((f) => ({ ...f, isDrawerShow: !!v }))
                    }
                  />
                  详情显示
                </label>
              </div>
              {(editingAttr.fieldType === 'enum' || editingAttr.fieldType === 'enummulti') && (
                <div className="space-y-1">
                  <Label className="text-xs">枚举选项（JSON）</Label>
                  <textarea
                    className="w-full min-h-[120px] rounded-v2-md border border-v2-border bg-v2-surface px-3 py-2 font-v2-mono text-xs text-v2-fg"
                    value={editForm.optionJson}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, optionJson: e.target.value }))
                    }
                    placeholder='[{"id":"linux","name":"Linux","isDefault":true}]'
                  />
                </div>
              )}
              {editingAttr.fieldType === 'table' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">表格子列 Schema（JSON 对象）</Label>
                    <button
                      type="button"
                      className="text-xs text-v2-primary hover:underline"
                      onClick={() =>
                        setEditForm((f) => ({
                          ...f,
                          optionJson: JSON.stringify(TABLE_SCHEMA_TEMPLATE, null, 2),
                        }))
                      }
                    >
                      插入模板
                    </button>
                  </div>
                  <textarea
                    className="w-full min-h-[200px] rounded-v2-md border border-v2-border bg-v2-surface px-3 py-2 font-v2-mono text-xs text-v2-fg"
                    value={editForm.optionJson}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, optionJson: e.target.value }))
                    }
                    placeholder='{"schema_version":1,"row_key":"row_id","columns":[...]}'
                  />
                  <p className="text-[11px] text-v2-muted">
                    columns 每列含 key/name/type（singlechar/int/bool/enum）。系统列 row_id（system:true）会自动维护，可不写。
                  </p>
                </div>
              )}
              {editingAttr.isBuiltIn && (
                <p className="rounded-v2-md border border-v2-primary-border bg-v2-primary-soft px-3 py-2 text-xs text-v2-primary">
                  这是内置属性。字段标识 (<code className="font-v2-mono">{editingAttr.fieldKey}</code>) 和类型不可修改 —— 它们被后端代码常量级引用（如告警同步按 inner_ip 匹配主机），修改会让相关功能静默失效。
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingAttr(null)}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={updateAttrMutation.isPending}
              onClick={() => updateAttrMutation.mutate()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
