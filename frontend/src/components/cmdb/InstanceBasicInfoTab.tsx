'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Pencil, Save, X } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiAttributeVO {
  id: number; fieldKey: string; name: string; fieldType: string
  isRequired: boolean; isEditable: boolean; option: { id: string; name: string; isDefault?: boolean }[] | null
  placeholder: string; unit: string; sortOrder: number; groupId: string
}
interface CiAttributeGroupVO { groupId: string; name: string; sortOrder: number }
interface CiModelVO { attributeGroups: CiAttributeGroupVO[] }

interface CiInstanceVO {
  id: number; modelId: string; name: string
  fieldsData: Record<string, unknown>
  attributes: CiAttributeVO[]
}

interface Props {
  modelCode: string
  inst: CiInstanceVO
}

/**
 * Basic-info tab for the instance detail view. Renders attribute groups (read
 * mode) and an inline edit mode with per-field dynamic controls via
 * {@link renderEditField}. Self-contained: fetches its own model (for group
 * names) and owns the edit/save state that previously lived in the page.
 */
export function InstanceBasicInfoTab({ modelCode, inst }: Props) {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [prevInstId, setPrevInstId] = useState(inst.id)
  const [editAttrs, setEditAttrs] = useState<Record<string, string>>({})

  const modelRes = useQuery({
    queryKey: ['cmdb-model', modelCode],
    queryFn: () => api.get(`/cmdb/models/${modelCode}`).then(r => r.data.data),
    staleTime: 600_000, // models rarely change during a session
  })
  const model: CiModelVO | undefined = modelRes.data
  const freshAttrs = useMemo(() => Object.fromEntries(
    Object.entries(inst.fieldsData ?? {}).map(([k, v]) => [k, String(v ?? '')])
  ), [inst])

  // Reset editAttrs when instance changes (render-time conditional setState,
  // avoids set-state-in-effect that triggers inside useEffect).
  if (prevInstId !== inst.id) {
    setPrevInstId(inst.id)
    setEditAttrs(freshAttrs)
  }

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/cmdb/instances/${inst.id}`, { fieldsData: editAttrs }),
    onSuccess: () => {
      toast.success('已保存')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['cmdb-instance', modelCode, String(inst.id)] })
    },
    onError: (e: Error) => {
      const apiErr = e as { response?: { data?: { message?: string } } }
      toast.error(apiErr?.response?.data?.message ?? '保存失败')
    },
  })

  const canEdit = hasPermission('cmdb_instance', 'update')
  const fieldConfig = inst.attributes ?? []
  const groupNames = Object.fromEntries(
    (model?.attributeGroups ?? []).map(g => [g.groupId, g.name])
  )
  const attrsByGroup = fieldConfig.reduce((acc, a) => {
    const g = a.groupId || 'default'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {} as Record<string, CiAttributeVO[]>)
  const groupIds = [...new Set(fieldConfig.map(a => a.groupId || 'default'))]

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end gap-2">
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />编辑
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />保存
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      )}

      {groupIds.map(groupId => {
        const attrs = (attrsByGroup[groupId] ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
        return (
          <div key={groupId} className="border rounded-lg p-5">
            {groupNames[groupId] && (
              <h2 className="font-semibold text-sm mb-4">{groupNames[groupId]}</h2>
            )}
            <div className="space-y-3">
              {attrs.map(attr => {
                const rawVal = inst.fieldsData?.[attr.fieldKey]
                const displayVal = rawVal != null ? String(rawVal) : '—'
                return (
                  <div key={attr.fieldKey} className="grid grid-cols-3 gap-4 items-start">
                    <div className="text-sm text-muted-foreground pt-2">
                      {attr.name}
                      {attr.unit && <span className="ml-1 text-xs">({attr.unit})</span>}
                    </div>
                    <div className="col-span-2">
                      {editing && attr.isEditable ? (
                        renderEditField(attr, editAttrs[attr.fieldKey] ?? displayVal,
                          val => setEditAttrs(a => ({ ...a, [attr.fieldKey]: val })))
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
  )
}

function renderEditField(attr: CiAttributeVO, value: string, onChange: (v: string) => void) {
  const { fieldType, option, placeholder } = attr
  const ph = placeholder ?? ''
  if (fieldType === 'longchar') return <Textarea value={value} onChange={e => onChange(e.target.value)} rows={3} />
  if (fieldType === 'enum' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    return (
      <Select value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
        <SelectContent>{opts.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
      </Select>
    )
  }
  if (fieldType === 'enummulti' && Array.isArray(option)) {
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
  if (fieldType === 'bool') {
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
  if (fieldType === 'date') return <Input type="date" value={value} onChange={e => onChange(e.target.value)} />
  if (fieldType === 'int' || fieldType === 'float') return <Input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />
  return <Input value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />
}
