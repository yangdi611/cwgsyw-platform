'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Pencil, Save, X } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiAttributeVO {
  id: number; field_key: string; name: string; field_type: string
  is_required: boolean; is_editable: boolean; option: unknown
  placeholder: string; unit: string; sort_order: number; group_id: string
}
interface CiAttributeGroupVO { group_id: string; name: string; sort_order: number }
interface CiInstanceVO {
  id: number; model_id: string; name: string
  attrs: Record<string, unknown>
  field_config: CiAttributeVO[]
  created_at: string; updated_at: string; created_by_name: string
}
interface CiModelVO { attribute_groups: CiAttributeGroupVO[] }

export default function InstanceDetailPage() {
  const { modelId, id } = useParams<{ modelId: string; id: string }>()
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editAttrs, setEditAttrs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: inst, isLoading } = useQuery<CiInstanceVO>({
    queryKey: ['cmdb-instance', modelId, id],
    queryFn: () => api.get(`/cmdb/instances/${modelId}/${id}`).then(r => r.data.data),
  })

  const { data: model } = useQuery<CiModelVO>({
    queryKey: ['cmdb-model', modelId],
    queryFn: () => api.get(`/cmdb/meta/models/${modelId}`).then(r => r.data.data),
    enabled: !!inst,
  })

  useEffect(() => {
    if (inst) {
      setEditAttrs(Object.fromEntries(
        Object.entries(inst.attrs ?? {}).map(([k, v]) => [k, String(v ?? '')])
      ))
    }
  }, [inst])

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/cmdb/instances/${modelId}/${id}`, { attrs: editAttrs }),
    onSuccess: () => {
      toast.success('已保存')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['cmdb-instance', modelId, id] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '保存失败'),
  })

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>
  if (!inst) return <p className="text-destructive">实例不存在</p>

  const canEdit = hasPermission('cmdb_instance', 'update')
  const fieldConfig = inst.field_config ?? []
  const groupNames = Object.fromEntries(
    (model?.attribute_groups ?? []).map(g => [g.group_id, g.name])
  )
  const attrsByGroup = fieldConfig.reduce((acc, a) => {
    const g = a.group_id || 'default'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {} as Record<string, CiAttributeVO[]>)
  const groupIds = [...new Set(fieldConfig.map(a => a.group_id || 'default'))]

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/cmdb/instances/${modelId}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ArrowLeft className="h-4 w-4 mr-1" />返回列表
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{inst.name ?? `#${inst.id}`}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {inst.model_id} · 创建于 {new Date(inst.created_at).toLocaleString('zh-CN')}
              {inst.created_by_name && ` · ${inst.created_by_name}`}
            </p>
          </div>
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" />编辑
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />保存
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {groupIds.map(groupId => {
          const attrs = (attrsByGroup[groupId] ?? []).sort((a, b) => a.sort_order - b.sort_order)
          return (
            <div key={groupId} className="border rounded-lg p-5">
              {groupNames[groupId] && (
                <h2 className="font-semibold text-sm mb-4">{groupNames[groupId]}</h2>
              )}
              <div className="space-y-3">
                {attrs.map(attr => {
                  const rawVal = inst.attrs?.[attr.field_key]
                  const displayVal = rawVal != null ? String(rawVal) : '—'
                  return (
                    <div key={attr.field_key} className="grid grid-cols-3 gap-4 items-start">
                      <div className="text-sm text-muted-foreground pt-2">
                        {attr.name}
                        {attr.unit && <span className="ml-1 text-xs">({attr.unit})</span>}
                      </div>
                      <div className="col-span-2">
                        {editing && attr.is_editable ? (
                          renderEditField(attr, editAttrs[attr.field_key] ?? displayVal,
                            val => setEditAttrs(a => ({ ...a, [attr.field_key]: val })))
                        ) : (
                          <p className="text-sm pt-2">{displayVal}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function renderEditField(attr: CiAttributeVO, value: string, onChange: (v: string) => void) {
  const { field_type, option, placeholder } = attr
  const ph = placeholder ?? ''
  if (field_type === 'longchar') return <Textarea value={value} onChange={e => onChange(e.target.value)} rows={3} />
  if (field_type === 'enum' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    return (
      <Select value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
        <SelectContent>{opts.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
      </Select>
    )
  }
  if (field_type === 'enummulti' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    const selected: string[] = (() => { try { return JSON.parse(value || '[]') } catch { return [] } })()
    const toggle = (id: string) => {
      const next = selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]
      onChange(JSON.stringify(next))
    }
    return (
      <div className="flex flex-wrap gap-3 pt-2">
        {opts.map(o => (
          <label key={o.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} className="rounded" />
            {o.name}
          </label>
        ))}
      </div>
    )
  }
  if (field_type === 'bool') {
    return (
      <Select value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">是</SelectItem>
          <SelectItem value="false">否</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  if (field_type === 'date') return <Input type="date" value={value} onChange={e => onChange(e.target.value)} />
  if (field_type === 'int' || field_type === 'float') return <Input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />
  return <Input value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />
}
