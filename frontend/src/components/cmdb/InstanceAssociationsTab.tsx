'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Link2, X as XIcon } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiInstanceRelVO {
  id: number
  def_id: string
  is_src: boolean
  peer_id: number
  peer_name: string
  peerModelId: string
  peer_model_name: string
  direction_label: string
  attrs: Record<string, unknown>
  createdAt: string
}

interface CiRelGroupVO {
  kind_id: string
  kind_name: string
  relations: CiInstanceRelVO[]
}

interface CiAssociationDefVO {
  defId: string
  kindId: string
  name: string
  srcModelId: string
  dstModelId: string
  mapping: string
}

interface AssociationAttrVO {
  id: number
  fieldKey: string
  name: string
  fieldType: string
  isRequired: boolean
  enumOptions: string | null
  defaultValue: string | null
  sortOrder: number
}

interface InstanceSearchVO {
  id: number
  name: string
  modelId: string
  model_name: string
}

interface Props {
  modelCode: string
  id: string
}

/**
 * Associations panel for the instance detail view: lists grouped relations,
 * supports deleting a relation and opening the "add relation" dialog.
 * Self-contained — fetches its own data only while mounted (the parent only
 * renders this tab when active).
 */
export function InstanceAssociationsTab({ modelCode, id }: Props) {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedDefId, setSelectedDefId] = useState('')
  const [peerSearch, setPeerSearch] = useState('')
  const [selectedPeerId, setSelectedPeerId] = useState<number | null>(null)
  const [addError, setAddError] = useState('')

  const { data: relGroups = [], isLoading } = useQuery<CiRelGroupVO[]>({
    queryKey: ['cmdb-rel', id],
    queryFn: () => api.get(`/cmdb/instances/${id}/relations`).then(r => r.data.data),
  })

  // 从模型详情获取关联定义（后端未暴露独立 association-defs 端点）
  const { data: modelDetail } = useQuery<{ associationDefs?: CiAssociationDefVO[] }>({
    queryKey: ['cmdb-model-defs', modelCode],
    queryFn: () => api.get(`/cmdb/models/${modelCode}`).then(r => r.data.data),
    enabled: addDialogOpen,
  })
  const allDefs = (modelDetail?.associationDefs ?? []) as CiAssociationDefVO[]

  const applicableDefs = allDefs.filter(
    d => d.srcModelId === modelCode || d.dstModelId === modelCode
  )

  const selectedDef = applicableDefs.find(d => d.defId === selectedDefId)
  const targetModelId = selectedDef
    ? (selectedDef.srcModelId === modelCode ? selectedDef.dstModelId : selectedDef.srcModelId)
    : null

  // 拉取所选关联种类的扩展属性 schema
  const { data: kindAttrs = [] } = useQuery<AssociationAttrVO[]>({
    queryKey: ['cmdb-asst-attrs', selectedDef?.kindId],
    queryFn: () => api.get(`/cmdb/association-kinds/${selectedDef!.kindId}/attributes`).then(r => r.data.data),
    enabled: !!selectedDef && addDialogOpen,
  })

  // 关联扩展属性表单值；切换关联定义时清空
  const [metadata, setMetadata] = useState<Record<string, unknown>>({})

  const { data: searchResult } = useQuery<{ records: InstanceSearchVO[]; total: number }>({
    queryKey: ['cmdb-rel-search', targetModelId, peerSearch],
    queryFn: () => api.get('/cmdb/instances/search', {
      params: { modelId: targetModelId, keyword: peerSearch, size: 8 }
    }).then(r => r.data.data),
    enabled: !!targetModelId && addDialogOpen,
  })

  const deleteRelMutation = useMutation({
    mutationFn: (relId: number) => api.delete(`/cmdb/instances/${id}/relations/${relId}`),
    onSuccess: () => { toast.success('关联已删除'); queryClient.invalidateQueries({ queryKey: ['cmdb-rel', id] }) },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const createRelMutation = useMutation({
    mutationFn: () => {
      if (!selectedDef || !selectedPeerId) throw new Error('请选择关联定义和目标实例')
      return api.post(`/cmdb/instances/${id}/relations`, {
        defId: selectedDef.defId,
        dstInstanceId: selectedPeerId,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      })
    },
    onSuccess: () => {
      toast.success('关联已建立')
      setAddDialogOpen(false)
      setSelectedDefId('')
      setSelectedPeerId(null)
      setPeerSearch('')
      setMetadata({})
      setAddError('')
      queryClient.invalidateQueries({ queryKey: ['cmdb-rel', id] })
    },
    onError: (e: { response?: { data?: { message?: string } } }) => setAddError(e?.response?.data?.message ?? '创建失败'),
  })

  const totalRelations = relGroups.reduce((n, g) => n + g.relations.length, 0)

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="h-4 w-4" />
          关联关系
          <span className="text-xs font-normal text-v2-muted">（{totalRelations}）</span>
        </div>
        <Link href={`/cmdb/instances/by-model/${modelCode}/${id}/associations`}
          className="text-xs text-v2-muted hover:text-v2-fg">
          管理全部关联 →
        </Link>
      </div>

      <div className="px-5 py-4 space-y-4">
        {isLoading ? (
          <p className="text-sm text-v2-muted py-4 text-center">加载中...</p>
        ) : relGroups.length === 0 ? (
          <p className="text-sm text-v2-muted py-4 text-center">暂无关联</p>
        ) : (
          relGroups.map(group => (
            <div key={group.kind_id}>
              <p className="text-xs font-medium text-v2-muted mb-2">[{group.kind_name}]</p>
              <div className="space-y-1">
                {group.relations.map(rel => (
                  <div key={rel.id} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/30 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-v2-muted">{rel.direction_label}</span>
                      <span className="font-medium">{rel.peer_name}</span>
                      <span className="text-xs text-v2-muted">({rel.peer_model_name})</span>
                    </div>
                    {hasPermission('cmdb_instance', 'delete') && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-v2-danger"
                        onClick={() => { if (confirm('删除此关联?')) deleteRelMutation.mutate(rel.id) }}>
                        <XIcon className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {hasPermission('cmdb_instance', 'create') && (
          <div className="pt-2 border-t">
            <Button size="sm" variant="outline"
              onClick={() => { setAddDialogOpen(true); setAddError('') }}>
              + 添加关联
            </Button>
          </div>
        )}
      </div>

      {/* Add Relation Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={open => {
        setAddDialogOpen(open)
        if (!open) { setAddError(''); setSelectedDefId(''); setSelectedPeerId(null); setPeerSearch(''); setMetadata({}) }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加关联</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">关联定义</Label>
              <Select value={selectedDefId} onValueChange={v => {
                setSelectedDefId(v ?? ''); setSelectedPeerId(null); setPeerSearch(''); setMetadata({}); setAddError('')
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="选择关联定义..." />
                </SelectTrigger>
                <SelectContent>
                  {applicableDefs.map(d => (
                    <SelectItem key={d.defId} value={d.defId}>
                      {d.name} ({d.mapping})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDef && (
              <div className="space-y-1.5">
                <Label className="text-sm">
                  目标实例
                  <span className="text-v2-muted ml-1 font-normal">
                    ({searchResult?.records?.[0]?.model_name ?? targetModelId})
                  </span>
                </Label>
                <Input
                  placeholder="搜索实例名称..."
                  value={peerSearch}
                  onChange={e => { setPeerSearch(e.target.value); setSelectedPeerId(null) }}
                />
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {(searchResult?.records ?? []).map(searchInst => (
                    <button key={searchInst.id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${selectedPeerId === searchInst.id ? 'bg-muted font-medium' : ''}`}
                      onClick={() => setSelectedPeerId(searchInst.id)}>
                      {searchInst.name}
                    </button>
                  ))}
                  {(searchResult?.records ?? []).length === 0 && (
                    <p className="text-center text-v2-muted text-xs py-3">无匹配实例</p>
                  )}
                </div>
              </div>
            )}

            {selectedDef && kindAttrs.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm text-v2-muted">关联属性</Label>
                {[...kindAttrs].sort((a, b) => a.sortOrder - b.sortOrder).map(attr => (
                  <RelationAttrField
                    key={attr.id}
                    attr={attr}
                    value={metadata[attr.fieldKey]}
                    onChange={(v) => setMetadata(m => {
                      const next = { ...m }
                      if (v === undefined || v === '' || v === null) delete next[attr.fieldKey]
                      else next[attr.fieldKey] = v
                      return next
                    })}
                  />
                ))}
              </div>
            )}

            {addError && (
              <p className="text-sm text-v2-danger">{addError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>取消</Button>
            <Button
              onClick={() => createRelMutation.mutate()}
              disabled={!selectedDefId || !selectedPeerId || createRelMutation.isPending}>
              {createRelMutation.isPending ? '创建中...' : '建立关联'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * 单个关联扩展属性输入控件。按后端 fieldType 分派：
 * singlechar/int/date → input；enum → select；bool → checkbox。
 * 其他未识别类型回退到 input（不阻塞用户填，由后端校验兜底）。
 */
function RelationAttrField({ attr, value, onChange }: {
  attr: AssociationAttrVO
  value: unknown
  onChange: (v: unknown) => void
}) {
  const label = (
    <Label className="text-xs">
      {attr.name}
      {attr.isRequired && <span className="text-v2-danger ml-0.5">*</span>}
      <span className="text-v2-muted ml-1 font-mono">({attr.fieldKey})</span>
    </Label>
  )

  // bool
  if (attr.fieldType === 'bool') {
    const checked = value === true || value === 'true'
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-v2-border"
        />
        {label}
      </div>
    )
  }

  // enum
  if (attr.fieldType === 'enum') {
    const options = (attr.enumOptions ?? '')
      .split(/[\n,]/).map(s => s.trim()).filter(Boolean)
    const current = (value ?? attr.defaultValue ?? '') as string
    return (
      <div className="space-y-1">
        {label}
        <Select value={current || '__none__'} onValueChange={v => onChange(v === '__none__' ? undefined : v)}>
          <SelectTrigger><SelectValue placeholder="请选择..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">（未设置）</SelectItem>
            {options.map(o => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // int
  if (attr.fieldType === 'int') {
    return (
      <div className="space-y-1">
        {label}
        <Input
          type="number"
          value={(value as string | number | undefined) ?? ''}
          placeholder={attr.defaultValue ?? ''}
          onChange={e => {
            const v = e.target.value
            onChange(v === '' ? undefined : Number(v))
          }}
        />
      </div>
    )
  }

  // date — 使用 <input type="date"> 简化（HTML 原生）
  if (attr.fieldType === 'date') {
    return (
      <div className="space-y-1">
        {label}
        <Input
          type="date"
          value={(value as string | undefined) ?? ''}
          onChange={e => onChange(e.target.value || undefined)}
        />
      </div>
    )
  }

  // singlechar / list / user / 默认
  return (
    <div className="space-y-1">
      {label}
      <Input
        value={(value as string | undefined) ?? ''}
        placeholder={attr.defaultValue ?? ''}
        onChange={e => onChange(e.target.value || undefined)}
      />
    </div>
  )
}
