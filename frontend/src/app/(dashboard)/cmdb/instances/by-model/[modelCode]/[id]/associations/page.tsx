'use client'
import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Trash2, Plus } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { CiInstanceDrawer } from '@/components/cmdb/CiInstanceDrawer'

/**
 * GET /api/cmdb/instances/{id}/relations 返回的扁平关联列表（camelCase）。
 * 对端/方向由前端按 srcInstanceId/dstInstanceId 与当前 id 派生。
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

interface CiInstanceSummary {
  name: string
  modelId: string
  modelCode?: string
}

interface CiAssociationDefListVO { defId: string; name: string }

export default function AssociationsPage() {
  const { modelCode, id } = useParams<{ modelCode: string; id: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [filterKind, setFilterKind] = useState<string>('all')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: inst } = useQuery<CiInstanceSummary>({
    queryKey: ['cmdb-instance', modelCode, id],
    queryFn: async () => {
      try {
        const r = await api.get(`/cmdb/instances/${id}`)
        return {
          name: r.data.data.name,
          modelId: r.data.data.modelId,
        }
      } catch {
        return {} as CiInstanceSummary
      }
    },
    enabled: typeof window !== 'undefined',
  })

  const { data: relations = [], isLoading } = useQuery<CiRelationVO[]>({
    queryKey: ['cmdb-rel', id],
    queryFn: async () => {
      try {
        const r = await api.get(`/cmdb/instances/${id}/relations`)
        return r.data.data ?? []
      } catch {
        return []
      }
    },
    enabled: typeof window !== 'undefined',
  })

  const deleteMutation = useMutation({
    mutationFn: (relId: number) => api.delete(`/cmdb/instances/${id}/relations/${relId}`),
    onSuccess: () => {
      toast.success('关联已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-rel', id] })
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const { data: defs = [] } = useQuery<CiAssociationDefListVO[]>({
    queryKey: ['cmdb-association-defs'],
    queryFn: () => api.get('/cmdb/association-defs').then(r => r.data.data ?? []),
    staleTime: 600_000,
  })
  const kindMap = useMemo(() => new Map(defs.map(d => [d.defId, d.name])), [defs])

  const [drawerInstId, setDrawerInstId] = useState<number | null>(null)

  // 当前实例在每条关联中可能是 src 或 dst；据此派生对端与方向。
  const currentId = Number(id)
  const allRelations = relations.map(rel => {
    const isSrc = rel.srcInstanceId === currentId
    return {
      id: rel.id,
      kindId: rel.associationKind,
      directionLabel: isSrc ? '→' : '←',
      peerName: isSrc ? rel.dstInstanceName : rel.srcInstanceName,
      peerId: isSrc ? rel.dstInstanceId : rel.srcInstanceId,
      metadata: rel.metadata,
      createdAt: rel.createdAt,
    }
  })
  const filtered = filterKind === 'all'
    ? allRelations
    : allRelations.filter(r => r.kindId === filterKind)

  const kindOptions = Array.from(new Set(allRelations.map(r => r.kindId)))
    .map(k => ({ value: k, label: kindMap.get(k) ?? k }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/cmdb/instances/by-model/${modelCode}/${id}`}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors">
          <ArrowLeft className="h-4 w-4" />
          返回详情
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-v2-fg">
            {inst?.name ?? `#${id}`} — 关联管理
          </h1>
          <p className="mt-0.5 text-xs text-v2-muted">共 {allRelations.length} 条关联</p>
        </div>
        {hasPermission('cmdb_relation', 'create') && (
          <Link href={`/cmdb/instances/by-model/${modelCode}/${id}/associations/new`}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md bg-v2-primary text-white text-sm font-semibold shadow-v2-sm hover:bg-v2-primary-hover">
            <Plus className="h-4 w-4" />
            新建关联
          </Link>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={filterKind} onValueChange={(v) => setFilterKind(v ?? 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部种类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部种类</SelectItem>
            {kindOptions.map(k => (
              <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">种类</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">方向</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">对端 CI</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">创建时间</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">关联属性</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                    暂无关联
                  </td>
                </tr>
              ) : (
                filtered.map(rel => (
                  <tr key={rel.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{kindMap.get(rel.kindId) ?? rel.kindId}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {rel.directionLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <button
                        className="text-v2-primary hover:underline"
                        onClick={() => setDrawerInstId(rel.peerId)}
                      >
                        {rel.peerName}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(rel.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      {rel.metadata && Object.keys(rel.metadata).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(rel.metadata).map(([k, v]) => (
                            <Badge key={k} variant="secondary" className="text-xs">
                              {k}={String(v)}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {hasPermission('cmdb_instance', 'delete') && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => { if (confirm('删除此关联?')) deleteMutation.mutate(rel.id) }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <CiInstanceDrawer
        instanceId={drawerInstId}
        onClose={() => setDrawerInstId(null)}
      />
    </div>
  )
}
