'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface AsstKind { id: number; kind_id: string; name: string; src_to_dst: string; dst_to_src: string; is_built_in: boolean }
interface AsstDef { id: number; def_id: string; kind_id: string; src_model_id: string; dst_model_id: string; name: string; mapping: string; is_built_in: boolean }
interface CiModelVO { id: number; model_id: string; name: string }

export default function AssociationsPage() {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canWrite = hasPermission('cmdb_model', 'write')
  const [addingKind, setAddingKind] = useState(false)
  const [addingDef, setAddingDef] = useState(false)
  const [newKind, setNewKind] = useState({ kindId: '', name: '', srcToDst: '', dstToSrc: '' })
  const [newDef, setNewDef] = useState({ kindId: '', srcModelId: '', dstModelId: '', name: '', mapping: 'n:n' })

  const { data: kinds = [] } = useQuery<AsstKind[]>({ queryKey: ['cmdb-asst-kinds'], queryFn: () => api.get('/cmdb/meta/association-kinds').then(r => r.data.data) })
  const { data: defs = [] } = useQuery<AsstDef[]>({ queryKey: ['cmdb-asst-defs'], queryFn: () => api.get('/cmdb/meta/association-defs').then(r => r.data.data) })
  const { data: models = [] } = useQuery<CiModelVO[]>({ queryKey: ['cmdb-models'], queryFn: () => api.get('/cmdb/meta/models').then(r => r.data.data) })

  const createKindMutation = useMutation({
    mutationFn: () => api.post('/cmdb/meta/association-kinds', { kind_id: newKind.kindId, name: newKind.name, src_to_dst: newKind.srcToDst || undefined, dst_to_src: newKind.dstToSrc || undefined }),
    onSuccess: () => { toast.success('关联种类已创建'); queryClient.invalidateQueries({ queryKey: ['cmdb-asst-kinds'] }); setAddingKind(false); setNewKind({ kindId: '', name: '', srcToDst: '', dstToSrc: '' }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const createDefMutation = useMutation({
    mutationFn: () => api.post('/cmdb/meta/association-defs', { kind_id: newDef.kindId, src_model_id: newDef.srcModelId, dst_model_id: newDef.dstModelId, name: newDef.name || undefined, mapping: newDef.mapping }),
    onSuccess: () => { toast.success('关联关系已创建'); queryClient.invalidateQueries({ queryKey: ['cmdb-asst-defs'] }); setAddingDef(false); setNewDef({ kindId: '', srcModelId: '', dstModelId: '', name: '', mapping: 'n:n' }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const deleteDefMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/meta/association-defs/${id}`),
    onSuccess: () => { toast.success('已删除'); queryClient.invalidateQueries({ queryKey: ['cmdb-asst-defs'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cmdb" className={buttonVariants({ variant: 'ghost', size: 'sm' })}><ArrowLeft className="h-4 w-4 mr-1" />返回</Link>
        <h1 className="text-2xl font-bold">关联关系管理</h1>
      </div>

      {/* Association Kinds */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">关联种类</h2>
          {canWrite && <Button size="sm" variant="outline" onClick={() => setAddingKind(v => !v)}><Plus className="h-4 w-4 mr-1" />新建种类</Button>}
        </div>
        {addingKind && (
          <div className="border rounded-lg p-4 mb-3 bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">种类ID *</Label><Input value={newKind.kindId} onChange={e => setNewKind(f => ({...f, kindId: e.target.value}))} placeholder="如: support" /></div>
              <div className="space-y-1"><Label className="text-xs">名称 *</Label><Input value={newKind.name} onChange={e => setNewKind(f => ({...f, name: e.target.value}))} placeholder="如: 支撑" /></div>
              <div className="space-y-1"><Label className="text-xs">正向描述</Label><Input value={newKind.srcToDst} onChange={e => setNewKind(f => ({...f, srcToDst: e.target.value}))} placeholder="如: 支撑" /></div>
              <div className="space-y-1"><Label className="text-xs">反向描述</Label><Input value={newKind.dstToSrc} onChange={e => setNewKind(f => ({...f, dstToSrc: e.target.value}))} placeholder="如: 被支撑" /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createKindMutation.mutate()} disabled={!newKind.kindId || !newKind.name || createKindMutation.isPending}>创建</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingKind(false)}>取消</Button>
            </div>
          </div>
        )}
        <div className="border rounded-lg divide-y">
          {kinds.map(k => (
            <div key={k.kind_id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <code className="text-xs bg-muted px-2 py-0.5 rounded">{k.kind_id}</code>
                <span className="text-sm font-medium">{k.name}</span>
                {(k.src_to_dst || k.dst_to_src) && <span className="text-xs text-muted-foreground">{k.src_to_dst} / {k.dst_to_src}</span>}
              </div>
              {k.is_built_in && <Badge variant="secondary" className="text-xs">内置</Badge>}
            </div>
          ))}
          {kinds.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground text-center">暂无关联种类</p>}
        </div>
      </div>

      {/* Association Defs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">模型关联定义</h2>
          {canWrite && <Button size="sm" variant="outline" onClick={() => setAddingDef(v => !v)}><Plus className="h-4 w-4 mr-1" />新建关联</Button>}
        </div>
        {addingDef && (
          <div className="border rounded-lg p-4 mb-3 bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">源模型 *</Label>
                <Select value={newDef.srcModelId} onValueChange={v => setNewDef(f => ({...f, srcModelId: v ?? ''}))}>
                  <SelectTrigger><SelectValue placeholder="选择模型" /></SelectTrigger>
                  <SelectContent>{models.map(m => <SelectItem key={m.model_id} value={m.model_id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">目标模型 *</Label>
                <Select value={newDef.dstModelId} onValueChange={v => setNewDef(f => ({...f, dstModelId: v ?? ''}))}>
                  <SelectTrigger><SelectValue placeholder="选择模型" /></SelectTrigger>
                  <SelectContent>{models.map(m => <SelectItem key={m.model_id} value={m.model_id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">关联种类 *</Label>
                <Select value={newDef.kindId} onValueChange={v => setNewDef(f => ({...f, kindId: v ?? ''}))}>
                  <SelectTrigger><SelectValue placeholder="选择种类" /></SelectTrigger>
                  <SelectContent>{kinds.map(k => <SelectItem key={k.kind_id} value={k.kind_id}>{k.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">基数</Label>
                <Select value={newDef.mapping} onValueChange={v => setNewDef(f => ({...f, mapping: v ?? 'n:n'}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">1:1 一对一</SelectItem>
                    <SelectItem value="1:n">1:n 一对多</SelectItem>
                    <SelectItem value="n:n">n:n 多对多</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createDefMutation.mutate()} disabled={!newDef.kindId || !newDef.srcModelId || !newDef.dstModelId || createDefMutation.isPending}>创建</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingDef(false)}>取消</Button>
            </div>
          </div>
        )}
        <div className="border rounded-lg divide-y">
          {defs.map(d => (
            <div key={d.def_id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{models.find(m => m.model_id === d.src_model_id)?.name ?? d.src_model_id}</span>
                <span className="text-xs text-muted-foreground">—{kinds.find(k => k.kind_id === d.kind_id)?.name ?? d.kind_id}→</span>
                <span className="text-sm font-medium">{models.find(m => m.model_id === d.dst_model_id)?.name ?? d.dst_model_id}</span>
                <Badge variant="outline" className="text-xs">{d.mapping}</Badge>
                {d.is_built_in && <Badge variant="secondary" className="text-xs">内置</Badge>}
              </div>
              {canWrite && !d.is_built_in && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                  onClick={() => { if (confirm('删除此关联定义?')) deleteDefMutation.mutate(d.id) }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          {defs.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground text-center">暂无关联定义</p>}
        </div>
      </div>
    </div>
  )
}
