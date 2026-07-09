'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/v2/Dialog'
import { toast } from 'sonner'
import { Plus, PencilLine, Trash2, RefreshCw } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import type { CiAttributeGroupVO, CiModelVO } from './types'
import { getApiErrorMessage } from './utils'

function AttributeGroupsTab() {
  const { hasPermission } = usePermission()
  const canWrite = hasPermission('cmdb_model', 'update')
  const queryClient = useQueryClient()
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ groupId: '', name: '', sortOrder: 0 })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', sortOrder: 0 })

  // Model picker
  const { data: models = [] } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models')
        return r.data.data.records
      } catch { return [] }
    },
    enabled: typeof window !== 'undefined',
  })

  const { data: groups = [], isLoading } = useQuery<CiAttributeGroupVO[]>({
    queryKey: ['cmdb-attribute-groups', selectedModel],
    queryFn: async () => {
      try {
        const r = await api.get(`/cmdb/models/${selectedModel}/attribute-groups`)
        return r.data.data
      } catch { return [] }
    },
    enabled: !!selectedModel,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post(`/cmdb/models/${selectedModel}/attribute-groups`, form),
    onSuccess: () => {
      toast.success('分组已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-attribute-groups', selectedModel] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model', selectedModel] })
      setCreating(false)
      setForm({ groupId: '', name: '', sortOrder: 0 })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof editForm }) =>
      api.put(`/cmdb/models/${selectedModel}/attribute-groups/${id}`, body),
    onSuccess: () => {
      toast.success('已更新')
      queryClient.invalidateQueries({ queryKey: ['cmdb-attribute-groups', selectedModel] })
      setEditingId(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/models/${selectedModel}/attribute-groups/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-attribute-groups', selectedModel] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Label className="text-sm">模型</Label>
        <Select value={selectedModel} onValueChange={v => { setSelectedModel(v ?? ''); setEditingId(null); setCreating(false) }}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="请选择模型">
              {(v: string) => {
                const m = models.find(mm => mm.modelId === v)
                return m ? `${m.name} (${m.modelId})` : '请选择模型'
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {models.map(m => (
              <SelectItem key={m.modelId} value={m.modelId}>
                {m.name} <span className="text-muted-foreground ml-1">({m.modelId})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedModel && canWrite && (
          <Button size="sm" onClick={() => setCreating(c => !c)} className="ml-auto">
            <Plus className="h-4 w-4 mr-1" />新建分组
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">为选定模型管理属性分组（如 基本信息 / 硬件信息）。新建模型属性时从这里选择所属分组。</p>

      {!selectedModel ? (
        <p className="text-muted-foreground text-sm text-center py-12">请先选择模型</p>
      ) : (
        <>
          {creating && (
            <div className="border rounded-lg p-4 mb-6 bg-muted/30 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">分组ID * <span className="text-muted-foreground">(英文/下划线)</span></Label>
                  <Input value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))} placeholder="如: hardware" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">名称 *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 硬件信息" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">排序</Label>
                  <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value || 0) }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.groupId || !form.name || createMutation.isPending}>创建</Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>取消</Button>
              </div>
            </div>
          )}

          {isLoading ? <p className="text-muted-foreground text-sm">加载中...</p> : groups.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">暂无分组</p>
          ) : (
            <div className="border rounded-lg divide-y">
              {groups.map(g => (
                <div key={g.id} className="p-4">
                  {editingId === g.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">分组ID（不可改）</Label>
                          <Input disabled value={g.groupId} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">名称</Label>
                          <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">排序</Label>
                          <Input type="number" value={editForm.sortOrder} onChange={e => setEditForm(f => ({ ...f, sortOrder: Number(e.target.value || 0) }))} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateMutation.mutate({ id: g.id, body: editForm })} disabled={updateMutation.isPending}>保存</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>取消</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{g.name}</span>
                          <code className="text-xs text-muted-foreground">{g.groupId}</code>
                          <Badge variant="outline" className="text-xs">{g.attributeCount} 属性</Badge>
                        </div>
                      </div>
                      {canWrite && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(g.id); setEditForm({ name: g.name, sortOrder: g.sortOrder }) }}>
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost"
                            disabled={(g.attributeCount ?? 0) > 0}
                            title={(g.attributeCount ?? 0) > 0 ? '分组下尚有属性' : ''}
                            onClick={() => { if (confirm(`确认删除分组 "${g.name}"？`)) deleteMutation.mutate(g.id) }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export { AttributeGroupsTab }
