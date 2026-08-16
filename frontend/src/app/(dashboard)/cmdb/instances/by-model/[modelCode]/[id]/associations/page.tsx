'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { usePermission } from '@/hooks/usePermission'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import { CiInstanceDrawer } from '@/components/cmdb/CiInstanceDrawer'
import '@/design-system/figma-neutral/index.css'
import {
  Badge,
  Breadcrumb,
  Button,
  Chip,
  DataManagementPage,
  EmptyState,
  LoadingState,
  NeutralAlertDialog,
  PageHeader,
  Select,
  Table,
} from '@/design-system/figma-neutral/components'

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
  const [drawerInstId, setDrawerInstId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

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

  useBreadcrumbLabel(inst?.name)

  const deleteMutation = useMutation({
    mutationFn: (relId: number) => api.delete(`/cmdb/instances/${id}/relations/${relId}`),
    onSuccess: () => {
      toast.success('关联已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-rel', id] })
      setDeleteId(null)
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const { data: defs = [] } = useQuery<CiAssociationDefListVO[]>({
    queryKey: ['cmdb-association-defs'],
    queryFn: () => api.get('/cmdb/association-defs').then((r) => r.data.data ?? []),
    staleTime: 600_000,
  })
  const kindMap = useMemo(() => new Map(defs.map((d) => [d.defId, d.name])), [defs])

  const currentId = Number(id)
  const allRelations = relations.map((rel) => {
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
    : allRelations.filter((r) => r.kindId === filterKind)

  const kindOptions = [
    { value: 'all', label: '全部种类' },
    ...Array.from(new Set(allRelations.map((r) => r.kindId))).map((k) => ({
      value: k,
      label: kindMap.get(k) ?? k,
    })),
  ]

  return (
    <>
      <DataManagementPage className="cwgsyw-cmdb-page"
        header={
          <div className="cwgsyw-cmdb-instance-page">
          <PageHeader
            showEyebrow={false}
            title="关联管理"
            subtitle={`${inst?.name ?? `#${id}`} · ${allRelations.length} 条`}
            breadcrumb={
              <Breadcrumb
                items={[
                  { href: '/', label: '工作台' },
                  { href: '/cmdb', label: 'CMDB' },
                  { href: `/cmdb/instances/by-model/${modelCode}`, label: inst?.modelId ?? modelCode },
                  { href: `/cmdb/instances/by-model/${modelCode}/${id}`, label: inst?.name ?? `#${id}` },
                  { label: '关联管理' },
                ]}
              />
            }
            actions={
              hasPermission('cmdb_relation', 'create') ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => router.push(`/cmdb/instances/by-model/${modelCode}/${id}/associations/new`)}
                >
                  新建关联
                </Button>
              ) : undefined
            }
          />
          </div>
        }
        toolbar={
          <Select
            overlay
            size="sm"
            value={filterKind}
            options={kindOptions}
            onChange={(value) => setFilterKind(value || 'all')}
          />
        }
        content={
          isLoading ? (
            <LoadingState label="加载关联" />
          ) : filtered.length === 0 ? (
            <EmptyState title="暂无关联" description="该实例还没有匹配当前筛选的关联。" />
          ) : (
            <Table
              className="cwgsyw-cmdb-table"
              showSearch={false}
              columns={[
                { key: 'kind', label: '种类' },
                { key: 'direction', label: '方向' },
                { key: 'peer', label: '对端 CI' },
                { key: 'createdAt', label: '创建时间' },
                { key: 'attrs', label: '关联属性' },
                { key: 'actions', label: '' },
              ]}
              rows={filtered.map((rel) => ({
                id: String(rel.id),
                cells: {
                  kind: kindMap.get(rel.kindId) ?? rel.kindId,
                  direction: <Chip label={rel.directionLabel} />,
                  peer: (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setDrawerInstId(rel.peerId)}>
                      {rel.peerName}
                    </Button>
                  ),
                  createdAt: new Date(rel.createdAt).toLocaleDateString('zh-CN'),
                  attrs: rel.metadata && Object.keys(rel.metadata).length > 0 ? (
                    <div className="cwgsyw-inline-controls">
                      {Object.entries(rel.metadata).map(([k, v]) => (
                        <Badge key={k} label={`${k}=${String(v)}`} />
                      ))}
                    </div>
                  ) : '—',
                  actions: hasPermission('cmdb_instance', 'delete') ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={deleteMutation.isPending}
                      onClick={() => setDeleteId(rel.id)}
                    >
                      删除
                    </Button>
                  ) : null,
                },
              }))}
            />
          )
        }
      />

      <CiInstanceDrawer instanceId={drawerInstId} onClose={() => setDrawerInstId(null)} />
      <NeutralAlertDialog
        open={deleteId != null}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        title="删除此关联?"
        description="删除后无法恢复，对端实例上的对应关系也会一起消失。"
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => { if (deleteId != null) deleteMutation.mutate(deleteId) }}
      />
    </>
  )
}
