'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { getApiErrorMessage, isAxiosError } from '@/lib/api-error'
import '@/design-system/figma-neutral/index.css'
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  DashboardFeedbackPage,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

type Direction = 'bidirectional' | 'upstream' | 'downstream'

interface ImpactNode {
  id: number
  name: string
  modelId: string
  modelName?: string
  status?: string
  businessLevel?: string
}
interface ImpactLayer { depth: number; nodes: ImpactNode[] }
interface ImpactEdge { src: number; dst: number; kind: string; label?: string }
interface ImpactResult {
  rootId: number
  rootName: string
  rootModelId: string
  direction: string
  maxDepth: number
  truncated: boolean
  layers: ImpactLayer[]
  edges: ImpactEdge[]
}

const STATUS_META: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  running: { label: '运行中', tone: 'success' },
  stopped: { label: '已停止', tone: 'neutral' },
  maintenance: { label: '维护中', tone: 'warning' },
  fault: { label: '故障', tone: 'danger' },
  offline: { label: '离线', tone: 'neutral' },
}

const BIZ_LEVEL_META: Record<string, { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  core: { label: '核心', tone: 'danger' },
  important: { label: '重要', tone: 'warning' },
  normal: { label: '一般', tone: 'neutral' },
}

function pushEdge(m: Map<number, ImpactEdge[]>, nodeId: number, e: ImpactEdge) {
  const arr = m.get(nodeId)
  if (arr) {
    if (!arr.some((x) => x.src === e.src && x.dst === e.dst && x.kind === e.kind)) arr.push(e)
  } else {
    m.set(nodeId, [e])
  }
}

export default function ImpactAnalysisPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [direction, setDirection] = useState<Direction>('bidirectional')
  const [maxDepth, setMaxDepth] = useState(3)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read') || !hasPermission('cmdb_impact', 'read')) {
      router.replace('/')
    }
  }, [isHydrated, hasPermission, router])

  const canAnalyze = isHydrated && hasPermission('cmdb_instance', 'read') && hasPermission('cmdb_impact', 'read')
  const { data, isLoading, isError, error, refetch } = useQuery<ImpactResult, unknown>({
    queryKey: ['cmdb-impact', instanceId, direction, maxDepth],
    queryFn: async () => (await api.post(`/cmdb/instances/${instanceId}/impact`, {
      direction,
      maxDepth,
    })).data.data,
    enabled: typeof window !== 'undefined' && canAnalyze,
    retry: (failureCount, err: unknown) => {
      if (isAxiosError(err) && [403, 404].includes(err.response?.status ?? 0)) return false
      return failureCount < 2
    },
  })

  const depthMap = useMemo(() => {
    const m = new Map<number, number>()
    data?.layers.forEach((l) => l.nodes.forEach((n) => m.set(n.id, l.depth)))
    return m
  }, [data])

  const incomingByNode = useMemo(() => {
    const m = new Map<number, ImpactEdge[]>()
    const rootId = data?.rootId
    data?.edges.forEach((e) => {
      if (e.src === rootId || e.dst === rootId) {
        const otherId = e.src === rootId ? e.dst : e.src
        if (otherId != null && otherId !== rootId) pushEdge(m, otherId, e)
        return
      }
      const sd = depthMap.get(e.src)
      const dd = depthMap.get(e.dst)
      if (sd != null && dd != null) {
        if (dd > sd) pushEdge(m, e.dst, e)
        if (sd > dd) pushEdge(m, e.src, e)
      }
    })
    return m
  }, [data, depthMap])

  const totalNodes = useMemo(() => {
    const ids = new Set<number>()
    data?.layers.forEach((l) => l.nodes.forEach((n) => { if (n.id != null) ids.add(n.id) }))
    return ids.size
  }, [data])

  const toggleCollapse = (depth: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(depth)) next.delete(depth)
      else next.add(depth)
      return next
    })

  const status = isAxiosError(error) ? error.response?.status : undefined
  const errorMessage = status === 404
    ? '实例不存在或已被删除。'
    : status === 403
      ? '你没有查看此实例影响分析的权限。'
      : `加载影响分析失败${status ? `（${status}）` : ''}：${getApiErrorMessage(error, '请稍后重试')}`

  return (
    <DashboardFeedbackPage className="cwgsyw-cmdb-page"
      header={
        <div className="cwgsyw-cmdb-instance-page">
        <PageHeader
            showEyebrow={false}
          title={`影响分析 · ${data?.rootName ?? `#${instanceId}`}`}
          subtitle={`共 ${totalNodes} 个节点，${data?.edges.length ?? 0} 条关联`}
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/cmdb', label: 'CMDB' },
                { label: '影响分析' },
              ]}
            />
          }
          actions={
            <div className="cwgsyw-inline-controls">
              <Button
                type="button"
                variant="secondary"
                disabled={!data?.rootModelId}
                onClick={() => data?.rootModelId && router.push(`/cmdb/instances/by-model/${data.rootModelId}/${instanceId}`)}
              >
                返回实例
              </Button>
              <Select size="sm" overlay
                value={direction}
                options={[
                  { value: 'bidirectional', label: '双向' },
                  { value: 'upstream', label: '上游（被影响）' },
                  { value: 'downstream', label: '下游（影响对象）' },
                ]}
                onChange={(value) => setDirection((value as Direction) || 'bidirectional')}
              />
              <Select size="sm" overlay
                value={String(maxDepth)}
                options={[1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: `深度 ${d}` }))}
                onChange={(value) => setMaxDepth(Number(value) || 3)}
              />
            </div>
          }
        />
        </div>
      }
      feedback={
        isLoading ? (
          <LoadingState label="分析中" />
        ) : isError ? (
          <ErrorState
            title="影响分析失败"
            description={errorMessage}
            retry={status !== 403 ? <Button type="button" variant="secondary" onClick={() => void refetch()}>重试</Button> : null}
          />
        ) : !data || data.layers.length === 0 ? (
          <EmptyState title="暂无影响数据" />
        ) : (
          <div className="cwgsyw-stack-list">
            {data.truncated ? (
              <Alert tone="warning" title="结果已被截断" description="仅展示部分影响范围。如需查看更多节点，请减小分析深度。" showDismiss={false} />
            ) : null}
            <Card title={data.rootName} description="根节点" headerAction={data.rootModelId ? <Badge label={data.rootModelId} /> : null}>
              <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/instances/by-model/${data.rootModelId}/${data.rootId}`)}>
                查看详情
              </Button>
            </Card>
            {data.layers.map((layer) => {
              const nodes = layer.nodes.filter((n) => n.id !== data.rootId)
              if (nodes.length === 0) return null
              const isCollapsed = collapsed.has(layer.depth)
              const dirLabel = direction === 'upstream' ? '上游' : direction === 'downstream' ? '下游' : '关联'
              return (
                <div key={layer.depth} className="cwgsyw-stack-list">
                  <Button type="button" variant="ghost" onClick={() => toggleCollapse(layer.depth)}>
                    第 {layer.depth} 层 · {dirLabel} · {nodes.length} 个节点
                  </Button>
                  {!isCollapsed ? (
                    <div className="cwgsyw-stack-list">
                      {nodes.map((node) => {
                        const statusKey = node.status?.toLowerCase() ?? ''
                        const statusMeta = STATUS_META[statusKey]
                        const biz = node.businessLevel ? BIZ_LEVEL_META[node.businessLevel] : null
                        const edges = incomingByNode.get(node.id) ?? []
                        return (
                          <Card
                            key={node.id}
                            title={node.name}
                            headerAction={
                              <div className="cwgsyw-inline-controls">
                                {statusMeta ? <StatusBadge label={statusMeta.label} status={statusMeta.tone} /> : node.status ? <Badge label={node.status} /> : null}
                                {node.modelName ? <Badge label={node.modelName} /> : null}
                                {biz ? <StatusBadge label={biz.label} status={biz.tone} /> : null}
                              </div>
                            }
                          >
                            {edges.length > 0 ? (
                              <div className="cwgsyw-inline-controls">
                                {edges.map((e, i) => <Badge key={i} label={e.label ?? e.kind} />)}
                              </div>
                            ) : null}
                            <Link href={`/cmdb/instances/by-model/${node.modelId}/${node.id}`} className="cwgsyw-type-label-sm">查看详情</Link>
                          </Card>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      }
    />
  )
}
