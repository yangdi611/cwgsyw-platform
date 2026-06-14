'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiAttributeVO {
  id: number; field_key: string; name: string; field_type: string
  is_required: boolean; is_editable: boolean; option: unknown
  placeholder: string; unit: string; sort_order: number; group_id: string
}
interface CiAttributeGroupVO { id: number; group_id: string; name: string; sort_order: number }
interface CiModelVO {
  model_id: string; name: string
  attributes: CiAttributeVO[]; attribute_groups: CiAttributeGroupVO[]
}

export default function NewInstancePage() {
  const { modelId } = useParams<{ modelId: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [attrs, setAttrs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'create')) router.replace(`/cmdb/instances/by-model/${modelId}`)
  }, [isHydrated, hasPermission, router, modelId])

  const { data: model, isLoading } = useQuery<CiModelVO>({
    queryKey: ['cmdb-model', modelId],
    queryFn: () => api.get(`/cmdb/meta/models/${modelId}`).then(r => r.data.data),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post(`/cmdb/instances/${modelId}`, { attrs }),
    onSuccess: (res) => {
      toast.success('实例已创建')
      router.push(`/cmdb/instances/by-model/${modelId}/${res.data.data.id}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const set = (key: string, val: string) => setAttrs(a => ({ ...a, [key]: val }))

  const groups = model?.attribute_groups ?? []
  const attrsByGroup = (model?.attributes ?? []).reduce((acc, a) => {
    const g = a.group_id || 'default'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {} as Record<string, CiAttributeVO[]>)

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/cmdb/instances/by-model/${modelId}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回列表
        </Link>
        <h1 className="text-2xl font-bold">新建 {model?.name ?? modelId} 实例</h1>
      </div>

      <div className="space-y-6">
        {groups.sort((a, b) => a.sort_order - b.sort_order).map(group => {
          const groupAttrs = (attrsByGroup[group.group_id] ?? [])
            .sort((a, b) => a.sort_order - b.sort_order)
          if (groupAttrs.length === 0) return null
          return (
            <div key={group.group_id} className="border rounded-lg p-5">
              <h2 className="font-semibold text-sm mb-4">{group.name}</h2>
              <div className="space-y-4">
                {groupAttrs.map(attr => (
                  <div key={attr.field_key} className="space-y-1.5">
                    <Label className="text-sm">
                      {attr.name}
                      {attr.is_required && <span className="text-destructive ml-1">*</span>}
                      {attr.unit && <span className="text-muted-foreground ml-1 text-xs">({attr.unit})</span>}
                    </Label>
                    {renderField(attr, attrs[attr.field_key] ?? '', val => set(attr.field_key, val))}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 mt-6">
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          {createMutation.isPending ? '创建中...' : '创建实例'}
        </Button>
        <Link href={`/cmdb/instances/by-model/${modelId}`} className={buttonVariants({ variant: 'outline' })}>取消</Link>
      </div>
    </div>
  )
}

function renderField(attr: CiAttributeVO, value: string, onChange: (v: string) => void) {
  const { field_type, option, placeholder } = attr
  const ph = placeholder ?? ''
  if (field_type === 'longchar') {
    return <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={ph} rows={3} />
  }
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
      <div className="flex flex-wrap gap-3">
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
        <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">是</SelectItem>
          <SelectItem value="false">否</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  if (field_type === 'date') return <Input type="date" value={value} onChange={e => onChange(e.target.value)} />
  if (field_type === 'int' || field_type === 'float') {
    return <Input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />
  }
  return <Input value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />
}
