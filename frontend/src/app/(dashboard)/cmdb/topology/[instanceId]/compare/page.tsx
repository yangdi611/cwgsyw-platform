'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { CiTopologyGraph, TopologyNode, TopologyEdge, DiffStatus } from '@/components/cmdb/CiTopologyGraph'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  DetailDrawerPage,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

interface CompareNodeV2 extends TopologyNode {
  fieldsData?: Record<string, unknown> | null
}
interface CompareEdge {
  src: number
  dst: number
  kind: string
  label: string
  status: DiffStatus
}
interface TopologyCompareVO {
  added: CompareNodeV2[]
  removed: CompareNodeV2[]
  modified: CompareNodeV2[]
  unchanged: CompareNodeV2[]
  edges: CompareEdge[]
}

const DIFF_LEGEND: { status: DiffStatus; label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }[] = [
  { status: 'added', label: '新增', tone: 'success' },
  { status: 'removed', label: '删除', tone: 'danger' },
  { status: 'modified', label: '修改', tone: 'warning' },
  { status: 'unchanged', label: '未变', tone: 'neutral' },
]

function mergeCompare(vo: TopologyCompareVO) {
  const nodes: TopologyNode[] = []
  const nodeDiffMap = new Map<number, DiffStatus>()
  ;(['added', 'removed', 'modified', 'unchanged'] as DiffStatus[]).forEach((status) => {
    vo[status].forEach((n) => {
      nodes.push({
        id: n.id, name: n.name, modelId: n.modelId, modelName: n.modelName,
        modelColor: n.modelColor, status: n.status, owner: n.owner,
        isRoot: n.isRoot, keyAttrs: n.keyAttrs,
      })
      nodeDiffMap.set(n.id, status)
    })
  })
  const edges: TopologyEdge[] = vo.edges.map((e) => ({
    src: e.src, dst: e.dst, kind: e.kind, label: e.label,
  }))
  const edgeDiffMap = new Map<string, DiffStatus>()
  vo.edges.forEach((e) => edgeDiffMap.set(`${e.src}-${e.dst}-${e.kind}`, e.status ?? 'unchanged'))
  return { nodes, edges, nodeDiffMap, edgeDiffMap }
}

export default function TopologyComparePage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()

  const [fromTime, setFromTime] = useState('')
  const [toTime, setToTime] = useState('')
  const [compareDepth, setCompareDepth] = useState(3)
  const [compareNonce, setCompareNonce] = useState(0)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'read') || !hasPermission('cmdb_topology', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const compareQuery = useQuery<TopologyCompareVO>({
    queryKey: ['cmdb-topology-compare', instanceId, fromTime, toTime, compareDepth, compareNonce],
    queryFn: () =>
      api
        .get(`/cmdb/topology/${instanceId}/compare`, {
          params: {
            fromTime: fromTime || undefined,
            toTime: toTime || undefined,
            depth: compareDepth,
          },
        })
        .then((r) => r.data.data),
    enabled: compareNonce > 0 && !!fromTime && !!toTime && isHydrated
      && hasPermission('cmdb_instance', 'read') && hasPermission('cmdb_topology', 'read'),
  })

  const graphInput = useMemo(() => {
    if (compareQuery.data) return mergeCompare(compareQuery.data)
    return { nodes: [], edges: [], nodeDiffMap: null, edgeDiffMap: null }
  }, [compareQuery.data])

  const rootNode = graphInput.nodes.find((n) => n.isRoot)

  return (
    <DetailDrawerPage className="cwgsyw-cmdb-page"
      header={
        <div className="cwgsyw-cmdb-instance-page">
        <PageHeader
            showEyebrow={false}
          title={`${rootNode?.name ?? `#${instanceId}`} 的拓扑对比`}
          subtitle="选择起止日期后开始对比"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: `/cmdb/topology/${instanceId}`, label: '拓扑图' },
                { label: '对比' },
              ]}
            />
          }
          actions={
            <Button type="button" variant="secondary" onClick={() => router.push(`/cmdb/topology/${instanceId}`)}>
              返回拓扑图
            </Button>
          }
        />
        </div>
      }
      workspaceToolbar={
        <div className="cwgsyw-inline-controls">
          <span className="cwgsyw-type-label-sm">起始时间</span>
          <Input size="sm" type="datetime-local" step="1" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
          <span className="cwgsyw-type-label-sm">截止时间</span>
          <Input size="sm" type="datetime-local" step="1" value={toTime} onChange={(e) => setToTime(e.target.value)} />
          <span className="cwgsyw-type-label-sm">深度</span>
          <Input size="sm"
            type="number"
            min={1}
            max={5}
            value={String(compareDepth)}
            onChange={(e) => setCompareDepth(Math.min(5, Math.max(1, Number(e.target.value) || 3)))}
          />
          <Button
            type="button"
            disabled={!fromTime || !toTime || compareQuery.isFetching}
            onClick={() => setCompareNonce((n) => n + 1)}
          >
            {compareQuery.isFetching ? '对比中' : '开始对比'}
          </Button>
          {compareQuery.data ? DIFF_LEGEND.map((item) => (
            <StatusBadge
              key={item.status}
              label={`${item.label} ${compareQuery.data[item.status]?.length ?? 0}`}
              status={item.tone}
            />
          )) : null}
        </div>
      }
      content={
        compareQuery.isFetching ? (
          <LoadingState label="加载对比结果" />
        ) : compareQuery.isError ? (
          <ErrorState title="对比失败" description="请检查时间范围与深度。" showRetry={false} />
        ) : !graphInput.nodes.length ? (
          <EmptyState title="点击「开始对比」生成差异拓扑" />
        ) : (
          <CiTopologyGraph
            nodes={graphInput.nodes}
            edges={graphInput.edges}
            rootId={Number(instanceId)}
            preview={false}
            nodeDiffMap={graphInput.nodeDiffMap}
            edgeDiffMap={graphInput.edgeDiffMap}
          />
        )
      }
    />
  )
}
