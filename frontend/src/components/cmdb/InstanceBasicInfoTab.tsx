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

  // Pre-compute grid layout per group (for lg 3-col view): row index + col-span
  // — used to (a) extend orphan cells to full row, (b) drop border-b on last-row cells.
  const COLS = 3
  const layoutByGroup = useMemo(() => {
    const result: Record<string, Array<{ row: number; col: number; span: number }>> = {}
    for (const gid of Object.keys(attrsByGroup)) {
      const sorted = [...attrsByGroup[gid]].sort((a, b) => a.sortOrder - b.sortOrder)
      const positions: Array<{ row: number; col: number; span: number }> = []
      let row = 0
      let col = 0
      for (const attr of sorted) {
        if (attr.fieldType === 'longchar') {
          if (col !== 0) { row++; col = 0 }
          positions.push({ row, col: 0, span: COLS })
          row++; col = 0
        } else {
          positions.push({ row, col, span: 1 })
          col++
          if (col >= COLS) { row++; col = 0 }
        }
      }
      // Mark orphan: if a run of consecutive non-wide cells ends with 1-cell row, expand it
      let runStart = 0
      for (let i = 0; i <= sorted.length; i++) {
        const isWideOrEnd = i === sorted.length || sorted[i].fieldType === 'longchar'
        if (isWideOrEnd) {
          const runLen = i - runStart
          if (runLen > 0 && runLen % COLS === 1) {
            positions[i - 1].span = COLS
          }
          runStart = i + 1
        }
      }
      result[gid] = positions
    }
    return result
  }, [attrsByGroup])

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
                <X className="h-4 w-4" />取消
              </Button>
            </>
          )}
        </div>
      )}

      {groupIds.map(groupId => {
        const attrs = (attrsByGroup[groupId] ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
        const layout = layoutByGroup[groupId] ?? []
        const lastRow = layout.length > 0 ? layout[layout.length - 1].row : 0
        return (
          <div key={groupId} className="overflow-hidden rounded-xl border border-v2-border bg-v2-surface">
            {groupNames[groupId] && (
              <div className="px-4 py-2 border-b border-v2-border bg-v2-surface-soft">
                <span className="text-xs font-bold uppercase tracking-wider text-v2-muted">
                  {groupNames[groupId]}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {attrs.map((attr, idx) => {
                const rawVal = inst.fieldsData?.[attr.fieldKey]
                const editVal = rawVal != null ? String(rawVal) : ''
                const pos = layout[idx]
                const isWide = pos.span === COLS
                const isEditing = editing && attr.isEditable
                const isLastRow = pos.row === lastRow
                const isLastCol = pos.col + pos.span >= COLS
                const spanClass = isWide
                  ? 'md:col-span-2 lg:col-span-3'
                  : pos.span === 2 ? 'lg:col-span-2' : ''
                return (
                  <div
                    key={attr.fieldKey}
                    className={`px-4 py-2.5 ${spanClass} ${
                      isLastRow ? '' : 'border-b border-v2-border'
                    } ${isLastCol ? '' : 'lg:border-r border-v2-border'} ${
                      isEditing || isWide ? '' : 'flex items-baseline gap-3'
                    }`}
                  >
                    <dt
                      className={`text-xs text-v2-muted ${
                        isEditing || isWide ? 'mb-1.5' : 'w-24 shrink-0 truncate'
                      }`}
                      title={attr.name}
                    >
                      {attr.name}
                      {attr.unit && <span className="ml-0.5">({attr.unit})</span>}
                      {attr.isRequired && <span className="ml-0.5 text-v2-danger">*</span>}
                    </dt>
                    <dd className={isEditing || isWide ? '' : 'min-w-0 flex-1'}>
                      {isEditing ? (
                        renderEditField(attr, editAttrs[attr.fieldKey] ?? editVal,
                          val => setEditAttrs(a => ({ ...a, [attr.fieldKey]: val })))
                      ) : (
                        renderDisplayValue(attr, rawVal)
                      )}
                    </dd>
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

function renderDisplayValue(attr: CiAttributeVO, rawVal: unknown) {
  if (rawVal == null || rawVal === '') {
    return <span className="text-sm text-v2-subtle">—</span>
  }
  const { fieldType, option } = attr
  if (fieldType === 'enum' && Array.isArray(option)) {
    const found = (option as { id: string; name: string }[]).find(o => o.id === String(rawVal))
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-v2-border bg-v2-surface text-xs font-medium text-v2-fg">
        {found?.name ?? String(rawVal)}
      </span>
    )
  }
  if (fieldType === 'enummulti' && Array.isArray(option)) {
    let ids: string[] = []
    try { ids = JSON.parse(String(rawVal)) } catch { ids = [] }
    const opts = option as { id: string; name: string }[]
    if (ids.length === 0) return <span className="text-sm text-v2-subtle">—</span>
    return (
      <div className="flex flex-wrap gap-1.5">
        {ids.map(id => {
          const found = opts.find(o => o.id === id)
          return (
            <span key={id} className="inline-flex items-center px-2 py-0.5 rounded-md border border-v2-border bg-v2-surface text-xs font-medium text-v2-fg">
              {found?.name ?? id}
            </span>
          )
        })}
      </div>
    )
  }
  if (fieldType === 'bool') {
    return <span className="text-sm text-v2-fg">{String(rawVal) === 'true' ? '是' : '否'}</span>
  }
  if (fieldType === 'int' || fieldType === 'float') {
    return <span className="font-v2-mono tabular-nums text-sm text-v2-fg">{String(rawVal)}</span>
  }
  if (fieldType === 'longchar') {
    return <p className="text-sm text-v2-fg whitespace-pre-wrap break-words leading-relaxed">{String(rawVal)}</p>
  }
  return <span className="text-sm text-v2-fg break-words">{String(rawVal)}</span>
}

function renderEditField(attr: CiAttributeVO, value: string, onChange: (v: string) => void) {
  const { fieldType, option, placeholder } = attr
  const ph = placeholder ?? ''
  if (fieldType === 'longchar') return <Textarea value={value} onChange={e => onChange(e.target.value)} rows={3} />
  if (fieldType === 'enum' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    return (
      <Select value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger><SelectValue placeholder="请选择">{(v: string) => opts.find(o => o.id === v)?.name ?? '请选择'}</SelectValue></SelectTrigger>
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
