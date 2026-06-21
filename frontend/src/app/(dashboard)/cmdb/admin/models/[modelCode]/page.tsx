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
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiAttributeVO {
  id: number
  fieldKey: string
  name: string
  groupId: string
  fieldType: string
  isRequired: boolean
  isUnique: boolean
  isBuiltIn: boolean
  isListShow: boolean
  sortOrder: number
  placeholder: string
  unit: string
  option: Array<{ id: string; name: string; isDefault?: boolean }>
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
]

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
  const [newAttr, setNewAttr] = useState({
    fieldKey: '',
    name: '',
    fieldType: 'singlechar',
    groupId: 'default',
    isRequired: false,
    isUnique: false,
    isListShow: true,
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
                              {!attr.isBuiltIn && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-v2-danger"
                                  disabled={deleteAttrMutation.isPending}
                                  onClick={() => {
                                    if (confirm(`删除属性 "${attr.name}"?`))
                                      deleteAttrMutation.mutate(attr.id)
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
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
    </div>
  )
}
