'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Trash2, Plus } from 'lucide-react'
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
  created_at: string
}

interface CiRelGroupVO {
  kind_id: string
  kind_name: string
  relations: CiInstanceRelVO[]
}

interface CiInstanceSummary {
  name: string
  model_id: string
}

export default function AssociationsPage() {
  const { modelId, id } = useParams<{ modelId: string; id: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [filterKind, setFilterKind] = useState<string>('all')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: inst } = useQuery<CiInstanceSummary>({
    queryKey: ['cmdb-instance', modelId, id],
    queryFn: () => api.get(`/cmdb/instances/${modelId}/${id}`).then(r => ({
      name: r.data.data.name,
      model_id: r.data.data.model_id,
    })),
  })

  const { data: relGroups = [], isLoading } = useQuery<CiRelGroupVO[]>({
    queryKey: ['cmdb-rel', id],
    queryFn: () => api.get(`/cmdb/instances/${id}/relations`).then(r => r.data.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (relId: number) => api.delete(`/cmdb/instances/${id}/relations/${relId}`),
    onSuccess: () => {
      toast.success('关联已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-rel', id] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  // Flatten all relations for table display
  const allRelations = relGroups.flatMap(g =>
    g.relations.map(r => ({ ...r, kind_name: g.kind_name, kind_id: g.kind_id }))
  )
  const filtered = filterKind === 'all'
    ? allRelations
    : allRelations.filter(r => r.kind_id === filterKind)

  const kindOptions = relGroups.map(g => ({ value: g.kind_id, label: g.kind_name }))

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/cmdb/instances/by-model/${modelId}/${id}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回详情
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {inst?.name ?? `#${id}`} — 关联管理
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">共 {allRelations.length} 条关联</p>
        </div>
        {hasPermission('cmdb_relation', 'create') && (
          <Link href={`/cmdb/instances/by-model/${modelId}/${id}/associations/new`}
            className={buttonVariants({ variant: 'default', size: 'sm' })}>
            <Plus className="h-4 w-4 mr-1" />新建关联
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
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">模型</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">创建时间</th>
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
                    <td className="px-4 py-3 text-muted-foreground">{rel.kind_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {rel.direction_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/cmdb/instances/by-model/${rel.peer_model_id}/${rel.peer_id}`}
                        className="hover:underline">
                        {rel.peer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{rel.peer_model_name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(rel.created_at).toLocaleDateString('zh-CN')}
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
    </div>
  )
}
