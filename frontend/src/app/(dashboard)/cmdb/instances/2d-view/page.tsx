'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Grid3x3, RefreshCw, Layers } from 'lucide-react'

/* ---------- Types ---------- */

interface CiModelVO {
  id: number; name: string; displayName: string; group: string; groupName: string
  isBuiltIn: boolean; instanceCount: number; attributes: any[]; createdAt: string; updatedAt: string
}

interface CiAttributeVO {
  id: number; modelId: string; fieldKey: string; name: string
  groupId: string; groupName: string; fieldType: string
  isRequired: boolean; isEditable: boolean; isUnique: boolean
  isBuiltIn: boolean; isListShow: boolean; defaultValue: string
  enumOptions: string; sortOrder: number
}

interface GroupableAttrVO {
  fieldKey: string; name: string; fieldType: string
}

interface TwoDimCellVO {
  id: number; name: string; status: string; owner: string
}

interface TwoDimGroupVO {
  groupValue: string; instances: TwoDimCellVO[]
}

interface TwoDimensionViewVO {
  modelId: string; modelName: string; groupBy: string
  groups: TwoDimGroupVO[]; groupableAttrs: GroupableAttrVO[]
}

/* ---------- Constants ---------- */

const GROUPABLE_FIELD_TYPES = new Set(['singlechar', 'enum'])

/* ---------- Component ---------- */

export default function TwoDViewPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()

  const [model, setModel] = useState('')
  const [groupBy, setGroupBy] = useState('')

  // Permission check
  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  // Fetch all models
  const { data: models = [] } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models-all'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models', { params: { size: 100 } })
        return r.data.data.records
      } catch {
        return []
      }
    },
    enabled: typeof window !== 'undefined',
  })

  // Fetch model attributes when model selected
  const selectedModel = models.find(m => m.name === model)
  const { data: modelAttrs = [] } = useQuery<CiAttributeVO[]>({
    queryKey: ['cmdb-model-attrs', selectedModel?.id],
    queryFn: () => api.get(`/cmdb/models/${selectedModel!.id}/attributes`).then(r => r.data.data),
    enabled: !!selectedModel,
  })

  // Filter groupable attrs
  const groupableAttrs: GroupableAttrVO[] = modelAttrs
    .filter(a => GROUPABLE_FIELD_TYPES.has(a.fieldType))
    .map(a => ({ fieldKey: a.fieldKey, name: a.name, fieldType: a.fieldType }))

  // Auto-set first groupable attr when model changes
  useEffect(() => {
    if (groupableAttrs.length > 0) {
      setGroupBy(groupableAttrs[0].fieldKey)
    } else {
      setGroupBy('')
    }
  }, [model]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch 2D view data
  const { data: viewData, isLoading, isError, error, refetch } = useQuery<TwoDimensionViewVO>({
    queryKey: ['cmdb-2d-view', model, groupBy],
    queryFn: () => api.get('/cmdb/instances/2d-view', {
      params: { modelId: model, groupBy },
    }).then(r => r.data.data),
    enabled: !!model && !!groupBy,
  })

  // Display the groupable attrs selector (now populated from pre-fetch)
  const displayGroupableAttrs = viewData?.groupableAttrs ?? groupableAttrs

  const handleModelChange = (v: string | null) => {
    setModel(v ?? '')
    setGroupBy('')
  }

  const handleRefresh = () => {
    refetch()
    toast.success('已刷新')
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'running': return 'default' as const
      case 'stopped': return 'secondary' as const
      case 'maintenance': return 'outline' as const
      default: return 'outline' as const
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'running': return '运行中'
      case 'stopped': return '已停用'
      case 'maintenance': return '维护中'
      default: return status || '-'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-v2-fg">
          <Grid3x3 className="h-6 w-6" />
          2D 视图
        </h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={!model}>
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <Select value={model} onValueChange={handleModelChange}>
            <SelectTrigger className="w-44"><SelectValue placeholder="选择模型" /></SelectTrigger>
            <SelectContent>
              {models.map(m => (
                <SelectItem key={m.name} value={m.name}>{m.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">分组:</span>
          <Select value={groupBy} onValueChange={v => setGroupBy(v ?? '')} disabled={displayGroupableAttrs.length === 0}>
            <SelectTrigger className="w-44"><SelectValue placeholder="选择分组字段" /></SelectTrigger>
            <SelectContent>
              {displayGroupableAttrs.map(a => (
                <SelectItem key={a.fieldKey} value={a.fieldKey}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {!model ? (
        <div className="text-center py-16 text-muted-foreground">
          <Grid3x3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>请选择一个模型以查看 2D 视图</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">加载中...</p>
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm text-destructive">
            {(error as any)?.response?.data?.message ?? '加载失败，该模型可能未启用 2D 视图'}
          </p>
          <Button size="sm" variant="outline" className="mt-4" onClick={handleRefresh}>
            重试
          </Button>
        </div>
      ) : !viewData || viewData.groups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Grid3x3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>该模型下暂无实例数据</p>
        </div>
      ) : (
        <div className="space-y-6">
          {viewData.groups.map(group => (
            <Card key={group.groupValue}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{group.groupValue}</span>
                  <Badge variant="secondary" className="ml-2">
                    {group.instances.length} 个实例
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {group.instances.map(inst => (
                    <Link
                      key={inst.id}
                      href={`/cmdb/instances/${inst.id}`}
                      className="block rounded-lg border p-3 hover:bg-accent transition-colors"
                    >
                      <div className="font-medium text-sm mb-1 truncate">{inst.name}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusColor(inst.status)} className="text-xs">
                          {statusLabel(inst.status)}
                        </Badge>
                        {inst.owner && (
                          <span className="text-xs text-muted-foreground truncate">
                            {inst.owner}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
