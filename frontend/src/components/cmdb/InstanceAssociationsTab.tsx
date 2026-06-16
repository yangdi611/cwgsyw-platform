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
  peer_model_id: string
  peer_model_name: string
  direction_label: string
  attrs: Record<string, unknown>
  created_at: string
}

interface CiRelGroupVO {
  kind_id: string
  kind_name: string
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

interface Props {
  modelId: string
  id: string
}

/**
 * Associations panel for the instance detail view: lists grouped relations,
 * supports deleting a relation and opening the "add relation" dialog.
 * Self-contained — fetches its own data only while mounted (the parent only
 * renders this tab when active).
 */
export function InstanceAssociationsTab({ modelId, id }: Props) {
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

  const { data: allDefs = [] } = useQuery<CiAssociationDefVO[]>({
    queryKey: ['cmdb-assoc-defs'],
    queryFn: () => api.get('/cmdb/association-defs').then(r => r.data.data),
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
    queryFn: () => api.get('/cmdb/instances/search', {
      params: { modelId: targetModelId, keyword: peerSearch, size: 8 }
    }).then(r => r.data.data),
    enabled: !!targetModelId && addDialogOpen,
  })

  const deleteRelMutation = useMutation({
    mutationFn: (relId: number) => api.delete(`/cmdb/instances/${id}/relations/${relId}`),
    onSuccess: () => { toast.success('关联已删除'); queryClient.invalidateQueries({ queryKey: ['cmdb-rel', id] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const createRelMutation = useMutation({
    mutationFn: () => {
      if (!selectedDef || !selectedPeerId) throw new Error('请选择关联定义和目标实例')
      const isSrc = selectedDef.src_model_id === modelId
      return api.post(`/cmdb/instances/${id}/relations`, {
        dst_instance_id: selectedPeerId,
        association_kind: selectedDef.kind_id,
      })
    },
    onSuccess: () => {
      toast.success('关联已建立')
      setAddDialogOpen(false)
      setSelectedDefId('')
      setSelectedPeerId(null)
      setPeerSearch('')
      setAddError('')
      queryClient.invalidateQueries({ queryKey: ['cmdb-rel', id] })
    },
    onError: (e: any) => setAddError(e?.response?.data?.message ?? '创建失败'),
  })

  const totalRelations = relGroups.reduce((n, g) => n + g.relations.length, 0)

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="h-4 w-4" />
          关联关系
          <span className="text-xs font-normal text-muted-foreground">（{totalRelations}）</span>
        </div>
        <Link href={`/cmdb/instances/by-model/${modelId}/${id}/associations`}
          className="text-xs text-muted-foreground hover:text-foreground">
          管理全部关联 →
        </Link>
      </div>

      <div className="px-5 py-4 space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">加载中...</p>
        ) : relGroups.length === 0 ? (
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
