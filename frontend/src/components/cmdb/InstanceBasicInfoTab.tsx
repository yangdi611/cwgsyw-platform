'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Pencil, Save, X } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import type { CiInstanceVO, CiModelVO, CiAttributeVO, CiAttributeGroupVO } from './InstanceBasicInfoTab/types'
import { renderDisplayValue } from './InstanceBasicInfoTab/FieldDisplay'
import { renderEditField } from './InstanceBasicInfoTab/FieldEditor'
import { MaintStatusBadge, BaselineBadge } from './InstanceBasicInfoTab/StatusBadges'
import { TableFieldDisplay, TableFieldEditor } from './InstanceBasicInfoTab/TableField'

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
  const [editAttrs, setEditAttrs] = useState<Record<string, unknown>>({})

  const modelRes = useQuery({
    queryKey: ['cmdb-model', modelCode],
    queryFn: () => api.get(`/cmdb/models/${modelCode}`).then(r => r.data.data),
    staleTime: 600_000,
  })

  const model = modelRes.data as CiModelVO | undefined
  const groups = model?.attributeGroups ?? []

  if (inst.id !== prevInstId) {
    setPrevInstId(inst.id)
    setEditing(false)
    setEditAttrs({})
  }

  const updateMut = useMutation({
    mutationFn: (fieldsData: Record<string, unknown>) =>
      api.put(`/cmdb/instances/${inst.id}`, { fieldsData }),
    onSuccess: () => {
      toast.success('已保存')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['cmdb-instance', inst.id] })
    },
    onError: (e: Error) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存失败'),
  })

  const handleSave = () => {
    const payload: Record<string, unknown> = {}
    for (const a of inst.attributes) {
      if (a.fieldKey in editAttrs) {
        payload[a.fieldKey] = editAttrs[a.fieldKey]
      } else if (a.fieldKey in inst.fieldsData) {
        payload[a.fieldKey] = inst.fieldsData[a.fieldKey]
      }
    }
    updateMut.mutate(payload)
  }

  const attrsByGroup = useMemo(() => {
    const map = new Map<string, CiAttributeVO[]>()
    for (const a of inst.attributes) {
      const gid = a.groupId || '__ungrouped__'
      if (!map.has(gid)) map.set(gid, [])
      map.get(gid)!.push(a)
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    return map
  }, [inst.attributes])

  const sortedGroupIds = useMemo(() => {
    const arr: { id: string; name: string; sortOrder: number }[] = []
    for (const g of groups) if (attrsByGroup.has(g.groupId)) arr.push({ id: g.groupId, name: g.name, sortOrder: g.sortOrder ?? 0 })
    if (attrsByGroup.has('__ungrouped__')) arr.push({ id: '__ungrouped__', name: '未分组', sortOrder: 9999 })
    arr.sort((a, b) => a.sortOrder - b.sortOrder)
    return arr
  }, [groups, attrsByGroup])

  const maintStatus = inst.fieldsData['_maint_status_derived']
  const maintExpire = inst.fieldsData['maint_expire']
  const baselineVal = inst.fieldsData['_baseline_completeness']

  const canEdit = hasPermission('cmdb_instance', 'manage')

  return (
    <div className="space-y-6">
      {(maintStatus || typeof baselineVal === 'number') && (
        <div className="flex flex-wrap items-center gap-3">
          <MaintStatusBadge value={maintStatus} expire={maintExpire} />
          <BaselineBadge value={baselineVal} />
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-v2-fg">基本信息</h3>
        {canEdit && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />编辑
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditAttrs({}) }}>
              <X className="mr-1 h-3.5 w-3.5" />取消
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
              <Save className="mr-1 h-3.5 w-3.5" />{updateMut.isPending ? '保存中…' : '保存'}
            </Button>
          </div>
        )}
      </div>

      {sortedGroupIds.map(grp => {
        const attrs = attrsByGroup.get(grp.id) ?? []
        return (
          <div key={grp.id} className="space-y-4">
            <h4 className="text-xs font-bold text-v2-muted">{grp.name}</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {attrs.map(a => {
                const rawVal = inst.fieldsData[a.fieldKey]
                const editVal = a.fieldKey in editAttrs ? editAttrs[a.fieldKey] : rawVal
                const isTableField = a.fieldType === 'table'
                return (
                  <div key={a.id} className={isTableField ? 'md:col-span-2' : ''}>
                    <div className="mb-1 flex items-center gap-2">
                      <label className="text-sm font-semibold text-v2-fg">
                        {a.name}{a.isRequired && <span className="text-v2-danger">*</span>}
                      </label>
                      {a.unit && <span className="text-xs text-v2-muted">({a.unit})</span>}
                    </div>
                    {editing && a.isEditable ? (
                      isTableField ? (
                        <TableFieldEditor
                          schema={a.option}
                          rows={Array.isArray(editVal) ? editVal as Record<string, unknown>[] : []}
                          onChange={rows => setEditAttrs(prev => ({ ...prev, [a.fieldKey]: rows }))}
                        />
                      ) : (
                        renderEditField(a, String(editVal ?? ''), v => setEditAttrs(prev => ({ ...prev, [a.fieldKey]: v })))
                      )
                    ) : isTableField ? (
                      <TableFieldDisplay
                        schema={a.option}
                        rows={Array.isArray(rawVal) ? rawVal as Record<string, unknown>[] : []}
                      />
                    ) : (
                      renderDisplayValue(a, rawVal)
                    )}
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
