'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { usePermission } from '@/hooks/usePermission'
import type { CiInstanceVO, InstanceBasicInfoModelShape, CiAttributeVO } from './InstanceBasicInfoTab/types'
import { renderDisplayValue } from './InstanceBasicInfoTab/FieldDisplay'
import { renderEditField } from './InstanceBasicInfoTab/FieldEditor'
import { MaintStatusBadge, BaselineBadge } from './InstanceBasicInfoTab/StatusBadges'
import { TableFieldDisplay, TableFieldEditor } from './InstanceBasicInfoTab/TableField'
import { Button, Card } from '@/design-system/figma-neutral/components'

interface Props {
  modelCode: string
  inst: CiInstanceVO
}

export function InstanceBasicInfoTab({ modelCode, inst }: Props) {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [prevInstId, setPrevInstId] = useState(inst.id)
  const [editAttrs, setEditAttrs] = useState<Record<string, unknown>>({})

  const modelRes = useQuery({
    queryKey: ['cmdb-model', modelCode],
    queryFn: () => api.get(`/cmdb/models/${modelCode}`).then((r) => r.data.data),
    staleTime: 600_000,
  })

  const model = modelRes.data as InstanceBasicInfoModelShape | undefined
  const groups = useMemo(() => model?.attributeGroups ?? [], [model?.attributeGroups])

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
      queryClient.invalidateQueries({ queryKey: ['cmdb-instance', modelCode, String(inst.id)] })
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
  const canEdit = hasPermission('cmdb_instance', 'update')

  return (
    <div className="cwgsyw-stack-list">
      {(maintStatus || typeof baselineVal === 'number') && (
        <div className="cwgsyw-inline-controls">
          <MaintStatusBadge value={maintStatus} expire={maintExpire} />
          <BaselineBadge value={baselineVal} />
        </div>
      )}

      <div className="cwgsyw-inline-controls">
        <h3 className="cwgsyw-type-title-sm">基本信息</h3>
        {canEdit && !editing && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
            编辑
          </Button>
        )}
        {editing && (
          <>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setEditAttrs({}) }}>
              取消
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={updateMut.isPending}>
              {updateMut.isPending ? '保存中…' : '保存'}
            </Button>
          </>
        )}
      </div>

      {sortedGroupIds.map((grp) => {
        const attrs = attrsByGroup.get(grp.id) ?? []
        return (
          <Card key={grp.id} title={grp.name}>
            <div className="cwgsyw-form">
              {attrs.map((a) => {
                const rawVal = inst.fieldsData[a.fieldKey]
                const editVal = a.fieldKey in editAttrs ? editAttrs[a.fieldKey] : rawVal
                const isTableField = a.fieldType === 'table'
                const isEditing = editing && a.isEditable
                return (
                  <div key={a.id} className="cwgsyw-stack-list">
                    <div className="cwgsyw-type-label-sm">
                      {a.name}
                      {a.unit ? ` (${a.unit})` : ''}
                      {a.isRequired ? ' *' : ''}
                    </div>
                    {isEditing ? (
                      isTableField ? (
                        <TableFieldEditor
                          schema={a.option}
                          rows={Array.isArray(editVal) ? editVal as Record<string, unknown>[] : []}
                          onChange={(rows) => setEditAttrs((prev) => ({ ...prev, [a.fieldKey]: rows }))}
                        />
                      ) : (
                        renderEditField(a, String(editVal ?? ''), (v) => setEditAttrs((prev) => ({ ...prev, [a.fieldKey]: v })))
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
          </Card>
        )
      })}
    </div>
  )
}
