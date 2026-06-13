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
import { ArrowLeft, Pencil, Save, X, ChevronDown, ChevronUp, Link2, X as XIcon, GitBranch } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CiTopologyGraph, TopologyNode, TopologyEdge } from '@/components/cmdb/CiTopologyGraph'

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

interface CiInstanceRelVO {
  id: number
  def_id: string
  is_src: boolean
  peer_id: number
  peer_name: string
  peer_model_id: string
  peer_model_name: string
  direction_label: string
  attrs: Record<string, unknown>
  created_at: string
}

interface CiRelGroupVO {
  kind_id: string
  kind_name: string
  src_to_dst: string
  dst_to_src: string
  relations: CiInstanceRelVO[]
}

interface CiAssociationDefVO {
  def_id: string
  kind_id: string
  name: string
  src_model_id: string
  dst_model_id: string
  mapping: string
}

interface InstanceSearchVO {
  id: number
  name: string
  model_id: string
  model_name: string
}

export default function InstanceDetailPage() {
  const { modelId, id } = useParams<{ modelId: string; id: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editAttrs, setEditAttrs] = useState<Record<string, string>>({})
  const [relPanelOpen, setRelPanelOpen] = useState(false)
  const [topoPanelOpen, setTopoPanelOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedDefId, setSelectedDefId] = useState('')
  const [peerSearch, setPeerSearch] = useState('')
  const [selectedPeerId, setSelectedPeerId] = useState<number | null>(null)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

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

  const { data: relGroups = [], refetch: refetchRels } = useQuery<CiRelGroupVO[]>({
    queryKey: ['cmdb-rel', id],
    queryFn: () => api.get(`/cmdb/rel/${id}`).then(r => r.data.data),
    enabled: relPanelOpen,
  })

  const { data: topoData, isLoading: topoLoading } = useQuery<{ nodes: TopologyNode[]; edges: TopologyEdge[] }>({
    queryKey: ['cmdb-topology', id],
    queryFn: () => api.get(`/cmdb/topology/${id}`, { params: { depth: 2 } }).then(r => r.data.data),
    enabled: topoPanelOpen,
  })

  const { data: allDefs = [] } = useQuery<CiAssociationDefVO[]>({
    queryKey: ['cmdb-assoc-defs'],
    queryFn: () => api.get('/cmdb/meta/association-defs').then(r => r.data.data),
    enabled: addDialogOpen,
  })

  const applicableDefs = allDefs.filter(
    d => d.src_model_id === modelId || d.dst_model_id === modelId
  )

  const selectedDef = applicableDefs.find(d => d.def_id === selectedDefId)
  const targetModelId = selectedDef
    ? (selectedDef.src_model_id === modelId ? selectedDef.dst_model_id : selectedDef.src_model_id)
    : null

  const { data: searchResult } = useQuery<{ records: InstanceSearchVO[]; total: number }>({
    queryKey: ['cmdb-rel-search', targetModelId, peerSearch],
    queryFn: () => api.get('/cmdb/rel/search', {
      params: { modelId: targetModelId, keyword: peerSearch, size: 8 }
    }).then(r => r.data.data),
    enabled: !!targetModelId && addDialogOpen,
  })

  const deleteRelMutation = useMutation({
    mutationFn: (relId: number) => api.delete(`/cmdb/rel/${relId}`),
    onSuccess: () => { toast.success('关联已删除'); refetchRels() },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const createRelMutation = useMutation({
    mutationFn: () => {
      if (!selectedDef || !selectedPeerId) throw new Error('请选择关联定义和目标实例')
      const isSrc = selectedDef.src_model_id === modelId
      return api.post('/cmdb/rel', {
        def_id: selectedDefId,
        src_id: isSrc ? Number(id) : selectedPeerId,
        dst_id: isSrc ? selectedPeerId : Number(id),
      })
    },
    onSuccess: () => {
      toast.success('关联已建立')
      setAddDialogOpen(false)
      setSelectedDefId('')
      setSelectedPeerId(null)
      setPeerSearch('')
      setAddError('')
      refetchRels()
    },
    onError: (e: any) => setAddError(e?.response?.data?.message ?? '创建失败'),
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

      {/* Association Panel */}
      <div className="mt-6 border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
          onClick={() => setRelPanelOpen(v => !v)}
        >
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            关联关系
          </div>
          {relPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {relPanelOpen && (
          <div className="px-5 pb-5 pt-1 space-y-4 border-t">
            {relGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无关联</p>
            ) : (
              relGroups.map(group => (
                <div key={group.kind_id}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">[{group.kind_name}]</p>
                  <div className="space-y-1">
                    {group.relations.map(rel => (
                      <div key={rel.id} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/30 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{rel.direction_label}</span>
                          <span className="font-medium">{rel.peer_name}</span>
                          <span className="text-xs text-muted-foreground">({rel.peer_model_name})</span>
                        </div>
                        {hasPermission('cmdb_instance', 'delete') && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive"
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

            <div className="flex items-center justify-between pt-2 border-t">
              {hasPermission('cmdb_instance', 'create') && (
                <Button size="sm" variant="outline"
                  onClick={() => { setAddDialogOpen(true); setAddError('') }}>
                  + 添加关联
                </Button>
              )}
              <Link href={`/cmdb/instances/${modelId}/${id}/associations`}
                className="text-xs text-muted-foreground hover:text-foreground ml-auto">
                管理全部关联 →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Topology Preview Panel */}
      <div className="mt-4 border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
          onClick={() => setTopoPanelOpen(v => !v)}
        >
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            拓扑图
          </div>
          <div className="flex items-center gap-2">
            {topoPanelOpen && (
              <Link
                href={`/cmdb/topology/${id}`}
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={e => e.stopPropagation()}
              >
                全屏展开 →
              </Link>
            )}
            {topoPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {topoPanelOpen && (
          <div className="border-t">
            {topoLoading ? (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">加载中...</div>
            ) : !topoData || topoData.nodes.length === 0 ? (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">暂无关联数据</div>
            ) : (
              <CiTopologyGraph
                nodes={topoData.nodes}
                edges={topoData.edges}
                rootId={Number(id)}
                preview={true}
              />
            )}
          </div>
        )}
      </div>

      {/* Add Relation Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={open => {
        setAddDialogOpen(open)
        if (!open) { setAddError(''); setSelectedDefId(''); setSelectedPeerId(null); setPeerSearch('') }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加关联</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">关联定义</Label>
              <Select value={selectedDefId} onValueChange={v => {
                setSelectedDefId(v ?? ''); setSelectedPeerId(null); setPeerSearch(''); setAddError('')
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="选择关联定义..." />
                </SelectTrigger>
                <SelectContent>
                  {applicableDefs.map(d => (
                    <SelectItem key={d.def_id} value={d.def_id}>
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
                  <span className="text-muted-foreground ml-1 font-normal">
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
                    <p className="text-center text-muted-foreground text-xs py-3">无匹配实例</p>
                  )}
                </div>
              </div>
            )}

            {addError && (
              <p className="text-sm text-destructive">{addError}</p>
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
