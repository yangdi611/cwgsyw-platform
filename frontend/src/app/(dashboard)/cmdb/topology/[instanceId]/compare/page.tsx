'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { CiTopologyGraph, TopologyNode, TopologyEdge, DiffStatus } from '@/components/cmdb/CiTopologyGraph'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DetailDrawerPage,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

interface CompareNodeV2 {
  id: number
  name: string
  modelId?: string | null
  model_id?: string | null
  modelName?: string | null
  model_name?: string | null
  modelColor?: string | null
  model_color?: string | null
  status?: string | null
  owner?: string | null
  isRoot?: boolean
  is_root?: boolean
  keyAttrs?: Record<string, unknown> | null
  key_attrs?: Record<string, unknown> | null
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
    ;(vo[status] ?? []).forEach((n) => {
      nodes.push({
        id: n.id,
        name: n.name,
        modelId: n.modelId ?? n.model_id ?? null,
        modelName: n.modelName ?? n.model_name ?? null,
        modelColor: n.modelColor ?? n.model_color ?? null,
        status: n.status ?? null,
        owner: n.owner ?? null,
        isRoot: n.isRoot ?? n.is_root ?? false,
        keyAttrs: n.keyAttrs ?? n.key_attrs ?? null,
      })
      nodeDiffMap.set(n.id, status)
    })
  })
  const edges: TopologyEdge[] = (vo.edges ?? []).map((e) => ({
    src: e.src, dst: e.dst, kind: e.kind, label: e.label,
  }))
  const edgeDiffMap = new Map<string, DiffStatus>()
  ;(vo.edges ?? []).forEach((e) => edgeDiffMap.set(`${e.src}-${e.dst}-${e.kind}`, e.status ?? 'unchanged'))
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

  const canReadTopology = isHydrated
    && hasPermission('cmdb_instance', 'read')
    && hasPermission('cmdb_topology', 'read')
  const hasInvalidTimeRange = Boolean(fromTime && toTime && new Date(fromTime) > new Date(toTime))

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
    enabled: compareNonce > 0 && !!fromTime && !!toTime && !hasInvalidTimeRange && canReadTopology,
  })
  const canSubmitCompare = Boolean(fromTime && toTime && !hasInvalidTimeRange && !compareQuery.isFetching)

  const graphInput = useMemo(() => {
    if (compareQuery.data) return mergeCompare(compareQuery.data)
    return { nodes: [], edges: [], nodeDiffMap: null, edgeDiffMap: null }
  }, [compareQuery.data])

  const rootNode = graphInput.nodes.find((n) => n.isRoot)
  const changedNodeCount = compareQuery.data
    ? (compareQuery.data.added?.length ?? 0)
      + (compareQuery.data.removed?.length ?? 0)
      + (compareQuery.data.modified?.length ?? 0)
    : 0

  const submitCompare = () => {
    if (!canSubmitCompare) return
    setCompareNonce((nonce) => nonce + 1)
  }

  return (
    <DetailDrawerPage className="cwgsyw-cmdb-page cwgsyw-cmdb-topology-compare"
      header={
        <div className="cwgsyw-cmdb-instance-page">
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title={`${rootNode?.name ?? `实例 #${instanceId}`} 的拓扑对比`}
            subtitle="选择两个时间点，对比节点、关联和关键属性的变化。"
            actions={
              <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/topology/${instanceId}`)}>
                返回拓扑图
              </Button>
            }
          />
        </div>
      }
      workspaceToolbar={
        <form
          className="cwgsyw-cmdb-topology-compare__form"
          onSubmit={(event) => {
            event.preventDefault()
            submitCompare()
          }}
        >
          <Field label="起始时间" required>
            <Input size="sm" type="datetime-local" step="1" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
          </Field>
          <Field
            label="截止时间"
            required
            state={hasInvalidTimeRange ? 'error' : 'default'}
            errorText="截止时间不能早于起始时间"
            showError={hasInvalidTimeRange}
          >
            <Input size="sm" type="datetime-local" step="1" value={toTime} onChange={(e) => setToTime(e.target.value)} />
          </Field>
          <Field label="对比深度" helperText="可选 1–5 层">
            <Input
              size="sm"
              type="number"
              min={1}
              max={5}
              value={String(compareDepth)}
              onChange={(e) => setCompareDepth(Math.min(5, Math.max(1, Number(e.target.value) || 3)))}
            />
          </Field>
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmitCompare}
            loading={compareQuery.isFetching}
          >
            {compareQuery.isFetching ? '对比中' : '开始对比'}
          </Button>
        </form>
      }
      content={
        !isHydrated ? (
          <div className="cwgsyw-cmdb-topology-compare__state"><LoadingState label="正在准备拓扑对比" /></div>
        ) : !canReadTopology ? (
          <div className="cwgsyw-cmdb-topology-compare__state">
            <ErrorState title="没有查看拓扑对比的权限" description="正在返回工作台。" showRetry={false} />
          </div>
        ) : compareQuery.isFetching ? (
          <div className="cwgsyw-cmdb-topology-compare__state"><LoadingState label="加载对比结果" /></div>
        ) : compareQuery.isError ? (
          <div className="cwgsyw-cmdb-topology-compare__state">
            <ErrorState
              title="对比失败"
              description="请检查时间范围、深度或网络后重试。"
              retry={<Button type="button" size="sm" variant="secondary" onClick={() => void compareQuery.refetch()}>重新加载</Button>}
            />
          </div>
        ) : !graphInput.nodes.length ? (
          <div className="cwgsyw-cmdb-topology-compare__state">
            <EmptyState
              title={compareQuery.data ? '所选时间范围暂无拓扑节点' : '尚未生成差异拓扑'}
              description={compareQuery.data ? '可以调整时间范围或深度后再次对比。' : '填写起止时间并点击“开始对比”。'}
            />
          </div>
        ) : (
          <div className="cwgsyw-cmdb-topology-compare__result">
            <section className="cwgsyw-cmdb-topology-compare__summary" aria-labelledby="topology-compare-summary-title">
              <div>
                <h2 id="topology-compare-summary-title">差异摘要</h2>
                <p>共发现 {changedNodeCount} 个变化节点；未变化节点继续显示以保留拓扑上下文。</p>
              </div>
              <div className="cwgsyw-cmdb-topology-compare__legend" aria-label="差异图例">
                {DIFF_LEGEND.map((item) => (
                  <StatusBadge
                    key={item.status}
                    size="sm"
                    label={`${item.label} ${compareQuery.data?.[item.status]?.length ?? 0}`}
                    status={item.tone}
                  />
                ))}
              </div>
            </section>
            <section className="cwgsyw-cmdb-topology-compare__workspace" aria-labelledby="topology-compare-canvas-title">
              <div className="cwgsyw-cmdb-topology-compare__canvas-header">
                <h2 id="topology-compare-canvas-title">差异拓扑画布</h2>
                <p>节点和关联仅在具有真实差异时使用状态色。</p>
              </div>
              <div className="cwgsyw-cmdb-topology-compare__canvas">
                <CiTopologyGraph
                  nodes={graphInput.nodes}
                  edges={graphInput.edges}
                  rootId={Number(instanceId)}
                  preview={false}
                  nodeDiffMap={graphInput.nodeDiffMap}
                  edgeDiffMap={graphInput.edgeDiffMap}
                />
              </div>
            </section>
          </div>
        )
      }
    />
  )
}
