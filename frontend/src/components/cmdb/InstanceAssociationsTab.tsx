'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Link2, X as XIcon } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { CiInstanceDrawer } from '@/components/cmdb/CiInstanceDrawer'

/**
 * GET /api/cmdb/instances/{id}/relations 返回的扁平关联列表。
 * 后端 CiRelationVO 经 @JsonNaming(LowerCamelCaseStrategy) 序列化，字段为 camelCase。
 * 当前实例在每条关联中可能是 src 或 dst，对端/方向由前端派生。
 */
interface CiRelationVO {
  id: number
  srcInstanceId: number
  srcInstanceName: string
  dstInstanceId: number
  dstInstanceName: string
  associationKind: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface CiAssociationDefVO {
  defId: string
  kindId: string
  name: string
  srcModelId: string
  dstModelId: string
  mapping: string
}

interface CiAssociationDefListVO {
  defId: string
  name: string
  kindName: string
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
  const [drawerInstId, setDrawerInstId] = useState<number | null>(null)

  const { data: defs = [] } = useQuery<CiAssociationDefListVO[]>({
    queryKey: ['cmdb-association-defs'],
    queryFn: () => api.get('/cmdb/association-defs').then(r => r.data.data ?? []),
    staleTime: 600_000,
  })
  const kindMap = useMemo(() => new Map(defs.map(d => [d.defId, d.name])), [defs])

  const { data: relations = [], isLoading } = useQuery<CiRelationVO[]>({
    queryKey: ['cmdb-rel', id],
    queryFn: () => api.get(`/cmdb/instances/${id}/relations`).then(r => r.data.data ?? []),
  })

  // 按 associationKind 分组，保留原有「[种类] 分组」展示。
  const currentId = Number(id)
  const groups = useMemo(() => {
    const map = new Map<string, CiRelationVO[]>()
    for (const rel of relations) {
      const k = rel.associationKind || '(未分类)'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(rel)
    }
    return Array.from(map, ([kind, rels]) => ({ kind, rels }))
  }, [relations])

  const needsNodeRole = groups.some(g => g.kind === 'host_belong_resource_pool')
  const hostPeerIds = useMemo(() => {
    if (!needsNodeRole) return []
    const ids = new Set<number>()
    for (const g of groups) {
      if (g.kind === 'host_belong_resource_pool') {
        for (const rel of g.rels) {
          ids.add(rel.srcInstanceId === currentId ? rel.dstInstanceId : rel.srcInstanceId)
        }
      }
    }
    return Array.from(ids)
  }, [groups, needsNodeRole, currentId])

  const hostResults = useQueries({
    queries: hostPeerIds.map(hostId => ({
      queryKey: ['cmdb-instance-drawer', hostId],
      queryFn: () => api.get(`/cmdb/instances/${hostId}`).then(r => r.data.data),
      staleTime: 600_000,
    })),
  })
  const hostRoleMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const q of hostResults) {
      if (q.data) map.set(q.data.id, (q.data.fieldsData?.node_role as string) ?? '')
    }
    return map
  }, [hostResults])
  const roleOrder = (r: string) => r === 'master' ? 0 : r === 'worker' ? 1 : r ? 2 : 3
  const roleLabel: Record<string, string> = { master: '控制节点', worker: '工作节点', storage: '存储节点', network: '网络节点' }

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

  const totalRelations = relations.length

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

      <div className="p-4 space-y-3">
        {isLoading ? (
          <p className="text-sm text-v2-muted py-4 text-center">加载中...</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-v2-muted py-4 text-center">暂无关联</p>
        ) : (
          groups.map(group => {
            const isHostPool = group.kind === 'host_belong_resource_pool'
            const sortedRels = isHostPool
              ? [...group.rels].sort((a, b) => {
                  const peerA = a.srcInstanceId === currentId ? a.dstInstanceId : a.srcInstanceId
                  const peerB = b.srcInstanceId === currentId ? b.dstInstanceId : b.srcInstanceId
                  return roleOrder(hostRoleMap.get(peerA) ?? '') - roleOrder(hostRoleMap.get(peerB) ?? '')
                })
              : group.rels
            return (
            <div key={group.kind} className="overflow-hidden rounded-lg border border-v2-border bg-v2-surface">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-v2-border bg-v2-surface-soft">
                <span className="text-xs font-semibold text-v2-fg">{kindMap.get(group.kind) ?? group.kind}</span>
                <span className="text-xs text-v2-muted">({group.rels.length})</span>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-v2-border text-v2-muted">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide">对端 CI</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide w-14">方向</th>
                    {isHostPool && <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide w-24">节点角色</th>}
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide">关联属性</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-v2-border">
                  {sortedRels.map(rel => {
                    const isSrc = rel.srcInstanceId === currentId
                    const peerName = isSrc ? rel.dstInstanceName : rel.srcInstanceName
                    const peerId = isSrc ? rel.dstInstanceId : rel.srcInstanceId
                    const metaEntries = rel.metadata ? Object.entries(rel.metadata) : []
                    const nodeRole = isHostPool ? (hostRoleMap.get(peerId) ?? '') : ''
                    return (
                      <tr key={rel.id}
                        className="cursor-pointer hover:bg-v2-surface-hover transition-colors"
                        onClick={() => setDrawerInstId(peerId)}>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold text-v2-fg">{peerName}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs border border-v2-border rounded px-1.5 py-0.5 text-v2-muted">
                            {isSrc ? '→' : '←'}
                          </span>
                        </td>
                        {isHostPool && (
                          <td className="px-3 py-2.5">
                            {nodeRole ? (
                              <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
                                nodeRole === 'master'
                                  ? 'border-v2-primary/40 bg-v2-primary-soft text-v2-primary'
                                  : 'border-v2-border bg-v2-surface-soft text-v2-muted'
                              }`}>
                                {roleLabel[nodeRole] ?? nodeRole}
                              </span>
                            ) : (
                              <span className="text-v2-subtle">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-xs text-v2-muted">
                          {metaEntries.length > 0
                            ? metaEntries.map(([k, v]) => `${k}=${String(v)}`).join('，')
                            : <span className="text-v2-subtle">—</span>
                          }
                        </td>
                        <td className="px-2 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          {hasPermission('cmdb_instance', 'delete') && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-v2-danger"
                              onClick={() => { if (confirm('删除此关联?')) deleteRelMutation.mutate(rel.id) }}>
                              <XIcon className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )
          })
        )}

        {hasPermission('cmdb_instance', 'create') && (
          <div className="pt-1">
            <Button size="sm" variant="outline"
              onClick={() => { setAddDialogOpen(true); setAddError('') }}>
              + 添加关联
            </Button>
          </div>
        )}
      </div>

      {/* CI Instance Drawer */}
      <CiInstanceDrawer
        instanceId={drawerInstId}
        onClose={() => setDrawerInstId(null)}
      />

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
