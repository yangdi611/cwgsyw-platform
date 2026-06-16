'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Settings, Server, Database, Network, Box, ArrowRight, Trash2 } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiModelVO {
  id: number
  model_id: string
  name: string
  icon: string
  group_code: string
  description: string
  is_built_in: boolean
  is_paused: boolean
}

interface AsstKind { id: number; kind_id: string; name: string; src_to_dst: string; dst_to_src: string; is_built_in: boolean }
interface AsstDef { id: number; def_id: string; kind_id: string; src_model_id: string; dst_model_id: string; name: string; mapping: string; is_built_in: boolean }

const ICON_MAP: Record<string, React.ElementType> = {
  server: Server, database: Database, network: Network,
}

const MAPPING_BADGE: Record<string, string> = {
  '1:1': 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300',
  '1:n': 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300',
  'n:n': 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300',
}

export default function AdminPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [tab, setTab] = useState<'models' | 'associations'>('models')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_model', 'write')) router.replace('/cmdb')
  }, [isHydrated, hasPermission, router])

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">CMDB 配置管理</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b mb-6">
        <button
          onClick={() => setTab('models')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'models'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          模型管理
        </button>
        <button
          onClick={() => setTab('associations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'associations'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          关联定义
        </button>
      </div>

      {tab === 'models' && <ModelsTab />}
      {tab === 'associations' && <AssociationsTab />}
    </div>
  )
}

function ModelsTab() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })

  const { data: models = [], isLoading } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models'],
    queryFn: () => api.get('/cmdb/models').then(r => r.data.data),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/cmdb/models', {
      model_id: form.modelId, name: form.name, icon: form.icon,
      group_code: form.groupCode || undefined, description: form.description || undefined,
    }),
    onSuccess: (res) => {
      toast.success('模型已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      setCreating(false)
      setForm({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })
      router.push(`/cmdb/admin/models/${res.data.data.model_id}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const grouped = models.reduce((acc, m) => {
    const key = m.group_code || '未分类'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, CiModelVO[]>)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">管理 CI 模型和属性定义</p>
        {hasPermission('cmdb_model', 'write') && (
          <Button size="sm" onClick={() => setCreating(v => !v)}>
            <Plus className="h-4 w-4 mr-1" />新建模型
          </Button>
        )}
      </div>

      {creating && (
        <div className="border rounded-lg p-4 mb-6 bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">模型ID * <span className="text-muted-foreground">(英文/下划线)</span></Label>
              <Input value={form.modelId} onChange={e => setForm(f => ({ ...f, modelId: e.target.value }))} placeholder="如: mysql_instance" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">模型名称 *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如: MySQL实例" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">所属分类</Label>
              <Input value={form.groupCode} onChange={e => setForm(f => ({ ...f, groupCode: e.target.value }))} placeholder="如: middleware" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">描述</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.modelId || !form.name || createMutation.isPending}>创建</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>取消</Button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-muted-foreground text-sm">加载中...</p> : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([group, groupModels]) => (
            <div key={group}>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">{group}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {groupModels.map(model => {
                  const Icon = ICON_MAP[model.icon] ?? Box
                  return (
                    <Link key={model.model_id} href={`/cmdb/admin/models/${model.model_id}`}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors block">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-md">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{model.name}</span>
                            {model.is_built_in && <Badge variant="secondary" className="text-xs">内置</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{model.model_id}</p>
                        </div>
                        <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
          {models.length === 0 && <p className="text-muted-foreground text-sm text-center py-12">暂无模型</p>}
        </div>
      )}
    </div>
  )
}

function AssociationsTab() {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canWrite = hasPermission('cmdb_model', 'write')
  const [addingKind, setAddingKind] = useState(false)
  const [addingDef, setAddingDef] = useState(false)
  const [newKind, setNewKind] = useState({ kindId: '', name: '', srcToDst: '', dstToSrc: '' })
  const [newDef, setNewDef] = useState({ kindId: '', srcModelId: '', dstModelId: '', name: '', mapping: 'n:n' })

  const { data: kinds = [] } = useQuery<AsstKind[]>({ queryKey: ['cmdb-asst-kinds'], queryFn: () => api.get('/cmdb/association-kinds').then(r => r.data.data) })
  const { data: defs = [] } = useQuery<AsstDef[]>({ queryKey: ['cmdb-asst-defs'], queryFn: () => api.get('/cmdb/association-defs').then(r => r.data.data) })
  const { data: models = [] } = useQuery<CiModelVO[]>({ queryKey: ['cmdb-models'], queryFn: () => api.get('/cmdb/models').then(r => r.data.data) })

  const createKindMutation = useMutation({
    mutationFn: () => api.post('/cmdb/association-kinds', { kind_id: newKind.kindId, name: newKind.name, src_to_dst: newKind.srcToDst || undefined, dst_to_src: newKind.dstToSrc || undefined }),
    onSuccess: () => { toast.success('关联种类已创建'); queryClient.invalidateQueries({ queryKey: ['cmdb-asst-kinds'] }); setAddingKind(false); setNewKind({ kindId: '', name: '', srcToDst: '', dstToSrc: '' }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const createDefMutation = useMutation({
    mutationFn: () => api.post('/cmdb/association-defs', { kind_id: newDef.kindId, src_model_id: newDef.srcModelId, dst_model_id: newDef.dstModelId, name: newDef.name || undefined, mapping: newDef.mapping }),
    onSuccess: () => { toast.success('关联关系已创建'); queryClient.invalidateQueries({ queryKey: ['cmdb-asst-defs'] }); setAddingDef(false); setNewDef({ kindId: '', srcModelId: '', dstModelId: '', name: '', mapping: 'n:n' }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const deleteDefMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/association-defs/${id}`),
    onSuccess: () => { toast.success('已删除'); queryClient.invalidateQueries({ queryKey: ['cmdb-asst-defs'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  return (
    <div>
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
        <div className="space-y-2">
          {defs.map(d => {
            const srcModel = models.find(m => m.model_id === d.src_model_id)
            const dstModel = models.find(m => m.model_id === d.dst_model_id)
            const kindName = kinds.find(k => k.kind_id === d.kind_id)?.name ?? d.kind_id
            const SrcIcon = ICON_MAP[srcModel?.icon ?? ''] ?? Box
            const DstIcon = ICON_MAP[dstModel?.icon ?? ''] ?? Box
            return (
              <div key={d.def_id} className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                    {/* source model */}
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 min-w-0">
                      <SrcIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{srcModel?.name ?? d.src_model_id}</span>
                    </span>
                    {/* arrow + association kind */}
                    <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                      <ArrowRight className="h-4 w-4" />
                      <span className="text-xs">{kindName}</span>
                    </span>
                    {/* destination model */}
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 min-w-0">
                      <DstIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{dstModel?.name ?? d.dst_model_id}</span>
                    </span>
                    {/* mapping cardinality badge */}
                    <Badge variant="secondary" className={cn('font-mono', MAPPING_BADGE[d.mapping])}>
                      {d.mapping}
                    </Badge>
                    {d.is_built_in && <Badge variant="secondary" className="text-xs">内置</Badge>}
                  </div>
                  {canWrite && !d.is_built_in && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive shrink-0"
                      disabled={deleteDefMutation.isPending}
                      onClick={() => { if (confirm('删除此关联定义?')) deleteDefMutation.mutate(d.id) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          {defs.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground text-center">暂无关联定义</p>}
        </div>
      </div>
    </div>
  )
}
