'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiAttributeVO {
  id: number; fieldKey: string; name: string; groupId: string
  fieldType: string; isRequired: boolean; isUnique: boolean; isBuiltIn: boolean; isListShow: boolean
  sortOrder: number; placeholder: string; unit: string
}
interface CiAttributeGroupVO { id: number; groupId: string; name: string; isDefault: boolean; isBuiltIn: boolean }
interface CiModelVO {
  id: number; modelId: string; name: string; icon: string; isBuiltIn: boolean
  attributes: CiAttributeVO[]; attributeGroups: CiAttributeGroupVO[]
}

const FIELD_TYPES = [
  { value: 'singlechar', label: '单行文本' }, { value: 'longchar', label: '多行文本' },
  { value: 'int', label: '整数' }, { value: 'float', label: '浮点数' },
  { value: 'enum', label: '单选枚举' }, { value: 'enummulti', label: '多选枚举' },
  { value: 'date', label: '日期' }, { value: 'bool', label: '是/否' }, { value: 'objuser', label: '用户' },
]

export default function ModelDetailPage() {
  const { modelId } = useParams<{ modelId: string }>()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canWrite = hasPermission('cmdb_model', 'write')
  const [addingAttr, setAddingAttr] = useState(false)
  const [newAttr, setNewAttr] = useState({
    fieldKey: '', name: '', fieldType: 'singlechar', groupId: 'default',
    isRequired: false, isUnique: false, isListShow: true, placeholder: '', unit: '',
  })

  const { data: model, isLoading } = useQuery<CiModelVO>({
    queryKey: ['cmdb-model', modelId],
    queryFn: async () => {
      try {
        const r = await api.get(`/cmdb/models/${modelId}`)
        return r.data.data
      } catch {
        return undefined
      }
    },
    enabled: typeof window !== 'undefined',
  })

  const addAttrMutation = useMutation({
    mutationFn: () => api.post(`/cmdb/models/${modelId}/attributes`, {
      fieldKey: newAttr.fieldKey, name: newAttr.name, fieldType: newAttr.fieldType,
      groupId: newAttr.groupId, isRequired: newAttr.isRequired, isUnique: newAttr.isUnique,
      isListShow: newAttr.isListShow,
      placeholder: newAttr.placeholder || undefined, unit: newAttr.unit || undefined,
    }),
    onSuccess: () => {
      toast.success('属性已添加')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model', modelId] })
      setAddingAttr(false)
      setNewAttr({ fieldKey: '', name: '', fieldType: 'singlechar', groupId: 'default',
        isRequired: false, isUnique: false, isListShow: true, placeholder: '', unit: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '添加失败'),
  })

  const deleteAttrMutation = useMutation({
    mutationFn: (attrId: number) => api.delete(`/cmdb/models/${modelId}/attributes/${attrId}`),
    onSuccess: () => { toast.success('属性已删除'); queryClient.invalidateQueries({ queryKey: ['cmdb-model', modelId] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>
  if (!model) return <p className="text-destructive">模型不存在</p>

  const attrsByGroup = (model.attributes ?? []).reduce((acc, a) => {
    const g = a.groupId || 'default'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {} as Record<string, CiAttributeVO[]>)

  const groups = model.attributeGroups ?? []

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cmdb/admin" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{model.name}</h1>
            {model.isBuiltIn && <Badge variant="secondary">内置</Badge>}
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{model.modelId}</p>
        </div>
        <Link href={`/cmdb/instances/by-model/${modelId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>查看实例</Link>
        {canWrite && (
          <Button size="sm" onClick={() => setAddingAttr(v => !v)}>
            <Plus className="h-4 w-4 mr-1" />添加属性
          </Button>
        )}
      </div>

      {addingAttr && (
        <div className="border rounded-lg p-4 mb-6 bg-muted/30 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">字段Key *</Label>
              <Input value={newAttr.fieldKey} onChange={e => setNewAttr(f => ({ ...f, fieldKey: e.target.value }))} placeholder="如: port" className="font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">显示名称 *</Label>
              <Input value={newAttr.name} onChange={e => setNewAttr(f => ({ ...f, name: e.target.value }))} placeholder="如: 端口" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">字段类型 *</Label>
              <Select value={newAttr.fieldType} onValueChange={v => setNewAttr(f => ({ ...f, fieldType: v ?? 'singlechar' }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">所属分组</Label>
              <Select value={newAttr.groupId} onValueChange={v => setNewAttr(f => ({ ...f, groupId: v ?? 'default' }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{groups.map(g => <SelectItem key={g.groupId} value={g.groupId}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">提示文字</Label>
              <Input value={newAttr.placeholder} onChange={e => setNewAttr(f => ({ ...f, placeholder: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">单位</Label>
              <Input value={newAttr.unit} onChange={e => setNewAttr(f => ({ ...f, unit: e.target.value }))} placeholder="如: GB, Hz" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={newAttr.isRequired} onChange={e => setNewAttr(f => ({ ...f, isRequired: e.target.checked }))} />必填</label>
            <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={newAttr.isUnique} onChange={e => setNewAttr(f => ({ ...f, isUnique: e.target.checked }))} />唯一</label>
            <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={newAttr.isListShow} onChange={e => setNewAttr(f => ({ ...f, isListShow: e.target.checked }))} />列表显示</label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addAttrMutation.mutate()} disabled={!newAttr.fieldKey || !newAttr.name || addAttrMutation.isPending}>保存</Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingAttr(false)}>取消</Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {groups.map(group => {
          const attrs = attrsByGroup[group.groupId] ?? []
          return (
            <div key={group.groupId} className="border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 flex items-center gap-2">
                <span className="font-medium text-sm">{group.name}</span>
                <Badge variant="secondary" className="text-xs">{attrs.length}</Badge>
                {group.isDefault && <Badge variant="outline" className="text-xs">默认</Badge>}
              </div>
              {attrs.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">暂无属性</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/20 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2">字段Key</th>
                      <th className="text-left px-4 py-2">名称</th>
                      <th className="text-left px-4 py-2">类型</th>
                      <th className="text-left px-4 py-2">属性</th>
                      {canWrite && <th className="px-4 py-2 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {attrs.map(attr => (
                      <tr key={attr.fieldKey} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-mono text-xs">{attr.fieldKey}</td>
                        <td className="px-4 py-2.5">{attr.name}</td>
                        <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{FIELD_TYPES.find(t => t.value === attr.fieldType)?.label ?? attr.fieldType}</Badge></td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 flex-wrap">
                            {attr.isRequired && <Badge variant="destructive" className="text-xs">必填</Badge>}
                            {attr.isUnique && <Badge className="text-xs">唯一</Badge>}
                            {attr.isBuiltIn && <Badge variant="secondary" className="text-xs">内置</Badge>}
                          </div>
                        </td>
                        {canWrite && (
                          <td className="px-4 py-2.5 text-right">
                            {!attr.isBuiltIn && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                                disabled={deleteAttrMutation.isPending}
                                onClick={() => { if (confirm(`删除属性 "${attr.name}"?`)) deleteAttrMutation.mutate(attr.id) }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
