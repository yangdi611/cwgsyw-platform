'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card, CardContent } from '@/components/v2/Card'
import { PageHeader } from '@/components/shared'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Textarea } from '@/components/v2/Textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiAttributeVO {
  id: number
  fieldKey: string
  name: string
  fieldType: string
  isRequired: boolean
  isEditable: boolean
  option: { id: string; name: string; isDefault?: boolean }[] | null
  placeholder: string
  unit: string
  sortOrder: number
  groupId: string
}
interface CiAttributeGroupVO {
  id: number
  groupId: string
  name: string
  sortOrder: number
}
interface CiModelVO {
  name: string
  attributes: CiAttributeVO[]
  attributeGroups: CiAttributeGroupVO[]
}

export default function NewInstancePage() {
  const { modelCode } = useParams<{ modelCode: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [attrs, setAttrs] = useState<Record<string, string>>({})
  const [name, setName] = useState('')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'create'))
      router.replace(`/cmdb/instances/by-model/${modelCode}`)
  }, [isHydrated, hasPermission, router, modelCode])

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

  const createMutation = useMutation({
    mutationFn: () => api.post('/cmdb/instances', { modelId: modelCode, name, fieldsData: attrs }),
    onSuccess: (res) => {
      toast.success('实例已创建')
      router.push(`/cmdb/instances/by-model/${modelCode}/${res.data.data.id}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const set = (key: string, val: string) => setAttrs((a) => ({ ...a, [key]: val }))

  const groups = model?.attributeGroups ?? []
  const attrsByGroup = (model?.attributes ?? []).reduce((acc, a) => {
    const g = a.groupId || 'default'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {} as Record<string, CiAttributeVO[]>)

  if (isLoading) return <p className="text-v2-muted">加载中…</p>

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/cmdb/instances/by-model/${modelCode}`}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
        <h1 className="text-2xl font-bold text-v2-fg">新建 {model?.name ?? modelCode} 实例</h1>
      </div>

      <Card>
        <CardContent className="space-y-1.5 p-5">
          <Label className="text-sm">
            实例名称<span className="ml-1 text-v2-danger">*</span>
          </Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入实例名称" />
        </CardContent>
      </Card>

      {groups
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((group) => {
          const groupAttrs = (attrsByGroup[group.groupId] ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
          if (groupAttrs.length === 0) return null
          return (
            <Card key={group.groupId}>
              <CardContent className="p-5">
                <h2 className="mb-4 text-sm font-bold text-v2-fg">{group.name}</h2>
                <div className="space-y-4">
                  {groupAttrs.map((attr) => (
                    <div key={attr.fieldKey} className="space-y-1.5">
                      <Label className="text-sm">
                        {attr.name}
                        {attr.isRequired && <span className="ml-1 text-v2-danger">*</span>}
                        {attr.unit && (
                          <span className="ml-1 text-xs text-v2-muted">({attr.unit})</span>
                        )}
                      </Label>
                      {renderField(attr, attrs[attr.fieldKey] ?? '', (val) => set(attr.fieldKey, val))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}

      <div className="flex gap-2">
        <Button variant="primary" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          {createMutation.isPending ? '创建中…' : '创建实例'}
        </Button>
        <Button variant="secondary" onClick={() => router.push(`/cmdb/instances/by-model/${modelCode}`)}>
          取消
        </Button>
      </div>
    </div>
  )
}

function renderField(attr: CiAttributeVO, value: string, onChange: (v: string) => void) {
  const { fieldType, option, placeholder } = attr
  const ph = placeholder ?? ''
  if (fieldType === 'longchar') {
    return <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} rows={3} />
  }
  if (fieldType === 'enum' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    return (
      <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger>
          <SelectValue placeholder="请选择">
            {(v: string) => opts.find((o) => o.id === v)?.name ?? '请选择'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {opts.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  if (fieldType === 'enummulti' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    const selected: string[] = (() => {
      try {
        return JSON.parse(value || '[]')
      } catch {
        return []
      }
    })()
    const toggle = (id: string) => {
      const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
      onChange(JSON.stringify(next))
    }
    return (
      <div className="flex flex-wrap gap-3">
        {opts.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-1.5 text-sm text-v2-fg">
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={() => toggle(o.id)}
              className="rounded"
            />
            {o.name}
          </label>
        ))}
      </div>
    )
  }
  if (fieldType === 'bool') {
    return (
      <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger>
          <SelectValue placeholder="请选择">
            {(v: string) => (v === 'true' ? '是' : v === 'false' ? '否' : '请选择')}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">是</SelectItem>
          <SelectItem value="false">否</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  if (fieldType === 'date') return <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  if (fieldType === 'int' || fieldType === 'float') {
    return <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} />
  }
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} />
}
