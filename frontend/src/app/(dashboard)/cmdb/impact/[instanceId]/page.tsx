'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { getApiErrorMessage, isAxiosError } from '@/lib/api-error'
import '@/design-system/figma-neutral/index.css'
import {
  Alert,
  Badge,
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

export function buildImmediateIncomingEdges(layers: ImpactLayer[], edges: ImpactEdge[]) {
  const depthByNode = new Map<number, number>()
  layers.forEach((layer) => layer.nodes.forEach((node) => depthByNode.set(node.id, layer.depth)))

  const incoming = new Map<number, ImpactEdge[]>()
  edges.forEach((edge) => {
    const sourceDepth = depthByNode.get(edge.src)
    const targetDepth = depthByNode.get(edge.dst)
    if (sourceDepth == null || targetDepth == null) return

    if (targetDepth === sourceDepth + 1) pushEdge(incoming, edge.dst, edge)
    if (sourceDepth === targetDepth + 1) pushEdge(incoming, edge.src, edge)
  })
  return incoming
}

export function summarizeImpactEdges(edges: ImpactEdge[]) {
  const summaries = new Map<string, { label: string; count: number }>()
  edges.forEach((edge) => {
    const label = edge.label?.trim() || edge.kind
    const current = summaries.get(label)
    if (current) current.count += 1
    else summaries.set(label, { label, count: 1 })
  })
  return Array.from(summaries.values())
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

  const incomingByNode = useMemo(
    () => buildImmediateIncomingEdges(data?.layers ?? [], data?.edges ?? []),
    [data],
  )

  const totalNodes = useMemo(() => {
    const ids = new Set<number>()
    data?.layers.forEach((l) => l.nodes.forEach((n) => { if (n.id != null) ids.add(n.id) }))
    return ids.size
  }, [data])
  const affectedNodeCount = data ? Math.max(totalNodes - 1, 0) : 0
  const rootNode = data?.layers
    .flatMap((layer) => layer.nodes)
    .find((node) => node.id === data.rootId)
  const rootModelName = rootNode?.modelName?.trim() || data?.rootModelId
  const toggleCollapse = (depth: number) =>
    setCollapsed((current) => {
      const next = new Set(current)
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
    <DashboardFeedbackPage className="cwgsyw-cmdb-page cwgsyw-cmdb-impact"
      header={
        <div className="cwgsyw-cmdb-instance-page">
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title={`影响分析 · ${data?.rootName ?? `#${instanceId}`}`}
          subtitle={`影响节点 ${affectedNodeCount} 个 · 关联 ${data?.edges.length ?? 0} 条`}
          actions={
            <div className="cwgsyw-inline-controls cwgsyw-cmdb-impact__controls">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!data?.rootModelId}
                onClick={() => data?.rootModelId && router.push(`/cmdb/instances/by-model/${data.rootModelId}/${instanceId}`)}
              >
                返回实例
              </Button>
              <Select aria-label="影响方向" size="sm" overlay
                value={direction}
                options={[
                  { value: 'bidirectional', label: '双向' },
                  { value: 'upstream', label: '上游（被影响）' },
                  { value: 'downstream', label: '下游（影响对象）' },
                ]}
                onChange={(value) => setDirection((value as Direction) || 'bidirectional')}
              />
              <Select aria-label="影响深度" size="sm" overlay
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
        !isHydrated ? (
          <LoadingState label="准备影响分析" />
        ) : !canAnalyze ? (
          <ErrorState
            title="无权查看影响分析"
            description="当前账号缺少实例或影响分析读取权限。"
            showRetry={false}
          />
        ) : isLoading ? (
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
          <div className="cwgsyw-cmdb-impact__content">
            {data.truncated ? (
              <Alert tone="warning" title="结果已被截断" description="当前仅展示部分影响范围，可缩小分析深度以聚焦近端节点。" showDismiss={false} />
            ) : null}
            <section className="cwgsyw-cmdb-impact__root" aria-labelledby="impact-root-title">
              <h2 id="impact-root-title">分析起点</h2>
              <Card title={data.rootName} headerAction={rootModelName ? <Badge label={rootModelName} /> : null}>
                <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/instances/by-model/${data.rootModelId}/${data.rootId}`)}>
                  查看详情
                </Button>
              </Card>
            </section>
            {affectedNodeCount === 0 ? (
              <div className="cwgsyw-cmdb-impact__empty">
                <EmptyState
                  showIcon={false}
                  title="暂无受影响节点"
                  description="当前方向和深度下没有发现其他关联实例。"
                />
              </div>
            ) : (
              <MotionConfig reducedMotion="user">
                <div className="cwgsyw-cmdb-impact__layers">
                  {data.layers.map((layer) => {
                    const nodes = layer.nodes.filter((n) => n.id !== data.rootId)
                    if (nodes.length === 0) return null
                    const isCollapsed = collapsed.has(layer.depth)
                    const panelId = `impact-layer-${layer.depth}`
                    const dirLabel = direction === 'upstream' ? '上游' : direction === 'downstream' ? '下游' : '关联'
                    return (
                      <section key={layer.depth} className="cwgsyw-cmdb-impact__layer">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-expanded={!isCollapsed}
                          aria-controls={panelId}
                          onClick={() => toggleCollapse(layer.depth)}
                        >
                          第 {layer.depth} 层 · {dirLabel} · {nodes.length} 个节点
                        </Button>
                        <AnimatePresence initial={false}>
                          {!isCollapsed ? (
                            <motion.div
                              id={panelId}
                              className="cwgsyw-cmdb-impact__layer-panel"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                            >
                              <div className="cwgsyw-cmdb-impact__layer-panel-inner">
                                {nodes.map((node) => {
                                  const statusKey = node.status?.toLowerCase() ?? ''
                                  const statusMeta = STATUS_META[statusKey]
                                  const biz = node.businessLevel ? BIZ_LEVEL_META[node.businessLevel] : null
                                  const edgeSummaries = summarizeImpactEdges(incomingByNode.get(node.id) ?? [])
                                  return (
                                    <Card
                                      key={node.id}
                                      title={node.name}
                                      headerAction={
                                        <div className="cwgsyw-inline-controls cwgsyw-cmdb-impact__meta">
                                          {statusMeta ? <StatusBadge label={statusMeta.label} status={statusMeta.tone} /> : node.status ? <Badge label={node.status} /> : null}
                                          {node.modelName ? <Badge label={node.modelName} /> : null}
                                          {biz ? <StatusBadge label={biz.label} status={biz.tone} /> : null}
                                          {edgeSummaries.map((summary) => (
                                            <Badge
                                              key={summary.label}
                                              label={summary.count > 1 ? `${summary.label} ×${summary.count}` : summary.label}
                                            />
                                          ))}
                                        </div>
                                      }
                                    >
                                      <Link href={`/cmdb/instances/by-model/${node.modelId}/${node.id}`} className="cwgsyw-type-label-sm">查看详情</Link>
                                    </Card>
                                  )
                                })}
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </section>
                    )
                  })}
                </div>
              </MotionConfig>
            )}
          </div>
        )
      }
    />
  )
}
