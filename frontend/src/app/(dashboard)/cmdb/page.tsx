'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Settings, Server, Database, Network, Box } from 'lucide-react'
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

const ICON_MAP: Record<string, React.ElementType> = {
  server: Server, database: Database, network: Network,
}

export default function CmdbPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })

  useEffect(() => {
    if (!hasPermission('cmdb_model', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: models = [], isLoading } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models'],
    queryFn: () => api.get('/cmdb/meta/models').then(r => r.data.data),
    enabled: hasPermission('cmdb_model', 'read'),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/cmdb/meta/models', {
      model_id: form.modelId, name: form.name, icon: form.icon,
      group_code: form.groupCode || undefined, description: form.description || undefined,
    }),
    onSuccess: (res) => {
      toast.success('模型已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      setCreating(false)
      setForm({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })
      router.push(`/cmdb/models/${res.data.data.model_id}`)
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
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">配置管理数据库 (CMDB)</h1>
          <p className="text-sm text-muted-foreground mt-1">管理 CI 模型和配置数据</p>
        </div>
        <div className="flex gap-2">
          <Link href="/cmdb/associations" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            关联关系管理
          </Link>
          {hasPermission('cmdb_model', 'write') && (
            <Button size="sm" onClick={() => setCreating(v => !v)}>
              <Plus className="h-4 w-4 mr-1" />新建模型
            </Button>
          )}
        </div>
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
                    <Link key={model.model_id} href={`/cmdb/models/${model.model_id}`}
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
                        {hasPermission('cmdb_model', 'write') && <Settings className="h-4 w-4 text-muted-foreground shrink-0" />}
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
