'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/v2/Dialog'
import { toast } from 'sonner'
import { Plus, PencilLine, Trash2, RefreshCw, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CiModelAdminItem } from '@/types/cmdb-model'
import { getModelDisplayName } from './utils'
import { getApiErrorMessage, isAxiosError } from '@/lib/api-error'

interface CiAssociationDefVO {
  id: number
  defId: string
  name: string
  kindId: string
  kindName: string
  srcModelId: string
  srcModelName: string
  dstModelId: string
  dstModelName: string
  mapping: string
  onDelete: string | null
  isBuiltIn: boolean
}

const MAPPING_OPTIONS = [
  { value: '1:1', label: '一对一 (1:1)' },
  { value: '1:n', label: '一对多 (1:n)' },
  { value: 'n:n', label: '多对多 (n:n)' },
]

const ON_DELETE_OPTIONS = [
  { value: 'none', label: '不级联' },
  { value: 'cascade', label: '级联删除' },
  { value: 'restrict', label: '阻止删除' },
]

function AssociationDefsSection({
  models, kinds, canWrite,
}: {
  models: { modelId: string; name: string; displayName?: string }[]
  kinds: { id: number; code: string; name: string; isBuiltIn: boolean }[]
  canWrite: boolean
}) {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const emptyForm = { defId: '', name: '', kindId: '', srcModelId: '', dstModelId: '', mapping: '1:n', onDelete: 'none' }
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', mapping: '1:n', onDelete: 'none' })

  const { data: defs = [], isLoading, isError, error, refetch } = useQuery<CiAssociationDefVO[], unknown>({
    queryKey: ['cmdb-association-defs'],
    queryFn: async () => (await api.get('/cmdb/association-defs')).data.data,
    enabled: typeof window !== 'undefined',
    retry: (failureCount: number, err: unknown) => {
      if (isAxiosError(err)) {
        const status = err.response?.status
        if (status === 403 || status === 401) return false
      }
      return failureCount < 2
    },
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/cmdb/association-defs', form),
    onSuccess: () => {
      toast.success('关联定义已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-association-defs'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-defs'] })
      setCreating(false)
      setForm(emptyForm)
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '创建失败')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: typeof editForm }) =>
      api.put(`/cmdb/association-defs/${id}`, body),
    onSuccess: () => {
      toast.success('已更新')
      queryClient.invalidateQueries({ queryKey: ['cmdb-association-defs'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-defs'] })
      setEditingId(null)
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '更新失败')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/association-defs/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-association-defs'] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-defs'] })
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '删除失败')),
  })

  function startEdit(d: CiAssociationDefVO) {
    setEditingId(d.id)
    setEditForm({ name: d.name, mapping: d.mapping, onDelete: d.onDelete ?? 'none' })
  }

  const formValid = form.defId && form.name && form.kindId && form.srcModelId && form.dstModelId && form.mapping

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold">模型关联定义</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            声明「哪两个模型之间能用哪种关联种类建立关系」。实例详情页的「添加关联」依赖此处的定义。
          </p>
        </div>
        {canWrite && !creating && (
          <Button size="sm" onClick={() => { setForm(emptyForm); setCreating(true) }}>
            <Plus className="h-4 w-4 mr-1" />新建关联定义
          </Button>
        )}
      </div>

      {creating && (
        <div className="border rounded-lg p-4 mb-4 bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">标识 * <span className="text-muted-foreground">(英文/下划线，唯一)</span></Label>
              <Input
                value={form.defId}
                onChange={e => setForm(f => ({ ...f, defId: e.target.value }))}
                placeholder="如: app_run_on_host"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">名称 *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="如: 应用运行在主机"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">源模型 *</Label>
              <Select value={form.srcModelId} onValueChange={v => setForm(f => ({ ...f, srcModelId: v ?? '' }))}>
                <SelectTrigger>
                  <SelectValue>
                    {form.srcModelId
                      ? (models.find(m => m.modelId === form.srcModelId)?.displayName ?? models.find(m => m.modelId === form.srcModelId)?.name ?? form.srcModelId)
                      : '请选择源模型'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {models.map(m => (
                    <SelectItem key={m.modelId} value={m.modelId}>
                      {m.displayName ?? m.name} <span className="text-muted-foreground ml-1 font-mono text-xs">({m.modelId})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">目标模型 *</Label>
              <Select value={form.dstModelId} onValueChange={v => setForm(f => ({ ...f, dstModelId: v ?? '' }))}>
                <SelectTrigger>
                  <SelectValue>
                    {form.dstModelId
                      ? (models.find(m => m.modelId === form.dstModelId)?.displayName ?? models.find(m => m.modelId === form.dstModelId)?.name ?? form.dstModelId)
                      : '请选择目标模型'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {models.map(m => (
                    <SelectItem key={m.modelId} value={m.modelId}>
                      {m.displayName ?? m.name} <span className="text-muted-foreground ml-1 font-mono text-xs">({m.modelId})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">关联种类 *</Label>
              <Select value={form.kindId} onValueChange={v => setForm(f => ({ ...f, kindId: v ?? '' }))}>
                <SelectTrigger>
                  <SelectValue>
                    {form.kindId ? (kinds.find(k => k.code === form.kindId)?.name ?? form.kindId) : '请选择关联种类'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {kinds.map(k => (
                    <SelectItem key={k.code} value={k.code}>
                      {k.name} <span className="text-muted-foreground ml-1 font-mono text-xs">({k.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">基数 *</Label>
              <Select value={form.mapping} onValueChange={v => setForm(f => ({ ...f, mapping: v ?? '1:n' }))}>
                <SelectTrigger>
                  <SelectValue>
                    {MAPPING_OPTIONS.find(o => o.value === form.mapping)?.label ?? form.mapping}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MAPPING_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">删除策略</Label>
              <Select value={form.onDelete} onValueChange={v => setForm(f => ({ ...f, onDelete: v ?? 'none' }))}>
                <SelectTrigger>
                  <SelectValue>
                    {ON_DELETE_OPTIONS.find(o => o.value === form.onDelete)?.label ?? form.onDelete}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ON_DELETE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setCreating(false); setForm(emptyForm) }}>取消</Button>
            <Button size="sm" disabled={!formValid || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">加载中...</div>
        ) : isError ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-destructive">
              {isAxiosError(error) && error.response?.status === 403
                ? '无 cmdb_relation:read 权限，请联系管理员'
                : `加载失败：${getApiErrorMessage(error, '未知错误')}`}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />重试
            </Button>
          </div>
        ) : defs.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            暂无关联定义。{canWrite && '点击右上角"新建关联定义"开始配置。'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">标识</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">名称</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">源 → 目标</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">关联种类</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">基数</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground">删除策略</th>
                {canWrite && <th className="text-right px-3 py-2 font-medium text-muted-foreground">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {defs.map((d: CiAssociationDefVO) => editingId === d.id ? (
                <tr key={d.id} className="bg-muted/20">
                  <td className="px-3 py-2.5 font-mono text-xs">{d.defId}</td>
                  <td className="px-3 py-2.5">
                    <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {d.srcModelName} → {d.dstModelName}
                  </td>
                  <td className="px-3 py-2.5">{d.kindName}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Select value={editForm.mapping} onValueChange={v => setEditForm(f => ({ ...f, mapping: v ?? '1:n' }))}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue>{MAPPING_OPTIONS.find(o => o.value === editForm.mapping)?.label ?? editForm.mapping}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {MAPPING_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Select value={editForm.onDelete} onValueChange={v => setEditForm(f => ({ ...f, onDelete: v ?? 'none' }))}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue>{ON_DELETE_OPTIONS.find(o => o.value === editForm.onDelete)?.label}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ON_DELETE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" className="h-7" disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: d.id, body: editForm })}>
                        保存
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditingId(null)}>
                        取消
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{d.defId}</code>
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    {d.name}
                    {d.isBuiltIn && <Badge variant="secondary" className="ml-2 text-xs">内置</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className="text-foreground">{d.srcModelName}</span>
                    <ArrowRight className="inline h-3 w-3 mx-1 text-muted-foreground" />
                    <span className="text-foreground">{d.dstModelName}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-xs">{d.kindName}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-center font-mono text-xs">{d.mapping}</td>
                  <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">
                    {ON_DELETE_OPTIONS.find(o => o.value === (d.onDelete ?? 'none'))?.label ?? d.onDelete}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          disabled={d.isBuiltIn}
                          title={d.isBuiltIn ? '内置定义不可编辑' : '编辑'}
                          onClick={() => startEdit(d)}>
                          <PencilLine className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                          disabled={d.isBuiltIn}
                          title={d.isBuiltIn ? '内置定义不可删除' : '删除'}
                          onClick={() => {
                            if (confirm(`删除关联定义「${d.name}」？已被实例使用时会拒绝删除。`)) {
                              deleteMutation.mutate(d.id)
                            }
                          }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Attribute Groups Tab — manages ci_attribute_group, scoped per model
// ─────────────────────────────────────────────────────────────────────────

interface AttributeGroupVO {
  id: number
  groupId: string
  name: string
  sortOrder: number
  isBuiltIn: boolean
  attributeCount: number
}


export { AssociationDefsSection }
