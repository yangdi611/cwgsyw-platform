'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { JsonDiffView } from '@/components/cmdb/JsonDiffView'
import { actionMeta, ChangeHistoryV2VO } from '@/components/cmdb/ChangeRecordItem'
import type { CiModelBase } from '@/types/cmdb-model'
import '@/design-system/figma-neutral/index.css'
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  DataManagementPage,
  EmptyState,
  FilterBar,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

interface PageData {
  records: ChangeHistoryV2VO[]
  total: number
  page: number
  size: number
}

const ACTION_OPTIONS = [
  { value: '__all__', label: '全部动作' },
  { value: 'create_instance', label: '创建' },
  { value: 'update_instance', label: '更新' },
  { value: 'delete_instance', label: '删除' },
]

function actionTone(a: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (a?.includes('create')) return 'success'
  if (a?.includes('delete')) return 'danger'
  if (a?.includes('update')) return 'warning'
  return 'neutral'
}

function toIso(date: string, endOfDay = false): string | undefined {
  if (!date) return undefined
  if (!endOfDay) return `${date}T00:00:00`
  const [year, month, day] = date.split('-').map(Number)
  const nextDay = new Date(year, month - 1, day + 1)
  return `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T00:00:00`
}

export default function CmdbChangesPage() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()

  const [model, setModel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [operatorId, setOperatorId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_change', 'read') && !hasPermission('cmdb_instance', 'read')) {
      router.replace('/')
    }
  }, [isHydrated, hasPermission, router])

  const { data: models } = useQuery<CiModelBase[]>({
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

  const canRead = hasPermission('cmdb_change', 'read') || hasPermission('cmdb_instance', 'read')

  const { data, isLoading, isFetching } = useQuery<PageData>({
    queryKey: ['cmdb-changes-v2', model, startDate, endDate, operatorId, keyword, action, page, size],
    queryFn: () =>
      api
        .get('/cmdb/changes', {
          params: {
            entityType: 'ci_instance',
            modelId: model || undefined,
            keyword: keyword || undefined,
            from: toIso(startDate, false),
            to: toIso(endDate, true),
            operatorId: operatorId || undefined,
            action: action || undefined,
            page,
            size,
          },
        })
        .then((r) => r.data.data),
    enabled: canRead,
  })

  const changes = data?.records ?? []
  const total = data?.total ?? 0
  const resetPage = () => setPage(1)
  const hasFilters = !!(model || startDate || endDate || operatorId || keyword || action)
  const expanded = changes.find((item) => item.id === expandedId)

  return (
    <DataManagementPage
      header={
        <PageHeader
          eyebrow="CMDB"
          title="变更历史"
          subtitle="CI 实例变更审计与字段级 diff 追溯，点击行展开查看变更前后对比。"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/cmdb', label: 'CMDB' },
                { label: '变更历史' },
              ]}
            />
          }
          actions={
            <Button type="button" variant="secondary" onClick={() => router.push('/cmdb/changes/stats')}>
              变更统计
            </Button>
          }
        />
      }
      toolbar={
        <FilterBar
          search={
            <SearchInput
              placeholder="搜索实例、模型或变更内容"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); resetPage() }}
            />
          }
          filterItems={
            <div className="cwgsyw-inline-controls">
              <Select
                value={model || '__all__'}
                options={[
                  { value: '__all__', label: '全部模型' },
                  ...(models ?? []).map((item) => ({ value: item.modelId, label: item.displayName ?? item.modelId })),
                ]}
                onChange={(value) => { setModel(value === '__all__' ? '' : value); resetPage() }}
              />
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); resetPage() }} />
              <span className="cwgsyw-type-label-sm">至</span>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); resetPage() }} />
              <Input
                type="number"
                inputMode="numeric"
                placeholder="操作人 ID"
                value={operatorId}
                onChange={(e) => { setOperatorId(e.target.value); resetPage() }}
              />
              <Select
                value={action || '__all__'}
                options={ACTION_OPTIONS}
                onChange={(value) => { setAction(value === '__all__' ? '' : value); resetPage() }}
              />
              <Select
                value={String(size)}
                options={[20, 50, 100].map((item) => ({ value: String(item), label: `每页 ${item}` }))}
                onChange={(value) => { setSize(Number(value)); resetPage() }}
              />
            </div>
          }
          reset={hasFilters ? <Button type="button" variant="ghost" onClick={() => { setModel(''); setStartDate(''); setEndDate(''); setOperatorId(''); setKeyword(''); setAction(''); resetPage() }}>清除</Button> : null}
        />
      }
      content={
        isLoading ? (
          <LoadingState label="加载变更历史" />
        ) : changes.length === 0 ? (
          <EmptyState title="暂无变更记录" />
        ) : (
          <div className="cwgsyw-stack-list">
            <Table
              showSearch={false}
              columns={[
                { key: 'action', label: '操作类型' },
                { key: 'operator', label: '操作人' },
                { key: 'summary', label: '变更摘要' },
                { key: 'time', label: '时间' },
              ]}
              rows={changes.map((ch) => ({
                id: String(ch.id),
                selected: expandedId === ch.id,
                cells: {
                  action: <StatusBadge label={actionMeta(ch.action).label} status={actionTone(ch.action)} />,
                  operator: ch.operatorName ?? '系统',
                  summary: ch.summary ?? (ch.afterJson ? JSON.stringify(ch.afterJson).slice(0, 80) : '-'),
                  time: new Date(ch.createdAt).toLocaleString('zh-CN'),
                },
              }))}
              onRowClick={(id) => {
                const hit = changes.find((item) => String(item.id) === id)
                if (!hit) return
                const hasDiff = hit.beforeJson != null || hit.afterJson != null
                if (hasDiff) setExpandedId((current) => (current === hit.id ? null : hit.id))
              }}
            />
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(total / size))}
              totalCount={total}
              onPageChange={setPage}
            />
            {isFetching && !isLoading ? <p className="cwgsyw-type-label-sm">刷新中…</p> : null}
            {expanded ? (
              <Card title="变更对比">
                {(expanded.changedFields ?? []).length > 0 ? (
                  <div className="cwgsyw-inline-controls">
                    {(expanded.changedFields ?? []).map((field) => <Badge key={field} label={field} />)}
                  </div>
                ) : null}
                <JsonDiffView before={expanded.beforeJson} after={expanded.afterJson} />
              </Card>
            ) : null}
          </div>
        )
      }
    />
  )
}
