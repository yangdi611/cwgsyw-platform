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
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
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

  const canRead = hasPermission('cmdb_change', 'read') || hasPermission('cmdb_instance', 'read')

  const {
    data: models,
    isError: isModelsError,
    refetch: refetchModels,
  } = useQuery<CiModelBase[]>({
    queryKey: ['cmdb-models-all'],
    queryFn: () => api.get('/cmdb/models', { params: { size: 100 } }).then((r) => r.data.data.records),
    enabled: isHydrated && canRead,
  })

  const invalidDateRange = Boolean(startDate && endDate && startDate > endDate)

  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<PageData>({
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
    enabled: isHydrated && canRead && !invalidDateRange,
  })

  const changes = data?.records ?? []
  const total = data?.total ?? 0
  const resetPage = () => {
    setPage(1)
    setExpandedId(null)
  }
  const hasFilters = !!(model || startDate || endDate || operatorId || keyword || action)
  const expanded = changes.find((item) => item.id === expandedId)
  const pageCount = Math.max(1, Math.ceil(total / size))

  return (
    <DataManagementPage className="cwgsyw-cmdb-page cwgsyw-cmdb-changes"
      header={
        <div className="cwgsyw-cmdb-instance-page">
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="变更历史"
            subtitle="点击记录查看字段变更"
            actions={
              <Button type="button" size="sm" variant="secondary" onClick={() => router.push('/cmdb/changes/stats')}>
                变更统计
              </Button>
            }
          />
        </div>
      }
      toolbar={
        <FilterBar
          search={
            <SearchInput size="sm"
              aria-label="搜索变更记录"
              placeholder="搜索实例、模型或变更内容"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); resetPage() }}
            />
          }
          filterItems={
            <div className="cwgsyw-cmdb-changes__filters">
              <Select size="sm" overlay
                aria-label="按模型筛选"
                value={model || '__all__'}
                options={[
                  { value: '__all__', label: '全部模型' },
                  ...(models ?? []).map((item) => ({ value: item.modelId, label: item.displayName ?? item.modelId })),
                ]}
                onChange={(value) => { setModel(value === '__all__' ? '' : value); resetPage() }}
              />
              <div className="cwgsyw-cmdb-changes__date-range">
                <Input size="sm" aria-label="开始日期" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); resetPage() }} />
                <span className="cwgsyw-type-label-sm" aria-hidden="true">至</span>
                <Input size="sm" aria-label="结束日期" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); resetPage() }} />
              </div>
              <Input size="sm"
                aria-label="按操作人 ID 筛选"
                type="number"
                inputMode="numeric"
                placeholder="操作人 ID"
                value={operatorId}
                onChange={(e) => { setOperatorId(e.target.value); resetPage() }}
              />
              <Select size="sm" overlay
                aria-label="按动作筛选"
                value={action || '__all__'}
                options={ACTION_OPTIONS}
                onChange={(value) => { setAction(value === '__all__' ? '' : value); resetPage() }}
              />
              <Select size="sm" overlay
                aria-label="每页条数"
                value={String(size)}
                options={[20, 50, 100].map((item) => ({ value: String(item), label: `每页 ${item}` }))}
                onChange={(value) => { setSize(Number(value)); resetPage() }}
              />
            </div>
          }
          reset={hasFilters ? <Button type="button" size="sm" variant="ghost" onClick={() => { setModel(''); setStartDate(''); setEndDate(''); setOperatorId(''); setKeyword(''); setAction(''); resetPage() }}>清除筛选</Button> : null}
        />
      }
      content={
        !isHydrated ? (
          <LoadingState label="正在检查访问权限" />
        ) : !canRead ? (
          <ErrorState title="无权查看变更历史" description="需要 CMDB 变更或实例读取权限。" />
        ) : invalidDateRange ? (
          <ErrorState title="日期范围无效" description="结束日期不能早于开始日期，请调整后重试。" />
        ) : isModelsError ? (
          <ErrorState
            title="模型筛选项加载失败"
            description="无法读取模型列表，请稍后重试。"
            retry={<Button type="button" size="sm" variant="secondary" onClick={() => refetchModels()}>重试</Button>}
          />
        ) : isError ? (
          <ErrorState
            title="变更历史加载失败"
            description="无法读取变更记录，请稍后重试。"
            retry={<Button type="button" size="sm" variant="secondary" onClick={() => refetch()}>重试</Button>}
          />
        ) : isLoading ? (
          <LoadingState label="加载变更历史" />
        ) : changes.length === 0 ? (
          <EmptyState
            title={hasFilters ? '没有符合筛选条件的记录' : '暂无变更记录'}
            description={hasFilters ? '调整筛选条件后重试。' : '实例发生创建、更新或删除后会显示在这里。'}
            action={hasFilters ? <Button type="button" size="sm" variant="secondary" onClick={() => { setModel(''); setStartDate(''); setEndDate(''); setOperatorId(''); setKeyword(''); setAction(''); resetPage() }}>清除筛选</Button> : undefined}
          />
        ) : (
          <div className="cwgsyw-cmdb-changes__content">
            <Table
              className="cwgsyw-cmdb-table"
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
            <div className="cwgsyw-cmdb-changes__mobile-list" aria-label="变更记录">
              {changes.map((change) => {
                const hasDiff = change.beforeJson != null || change.afterJson != null
                return (
                  <Button
                    key={change.id}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="cwgsyw-cmdb-changes__mobile-item"
                    aria-expanded={hasDiff ? expandedId === change.id : undefined}
                    disabled={!hasDiff}
                    onClick={() => setExpandedId((current) => (current === change.id ? null : change.id))}
                  >
                    <span><span>操作类型</span><StatusBadge label={actionMeta(change.action).label} status={actionTone(change.action)} /></span>
                    <span><span>操作人</span>{change.operatorName ?? '系统'}</span>
                    <span className="cwgsyw-cmdb-changes__mobile-summary"><span>变更摘要</span>{change.summary ?? (change.afterJson ? JSON.stringify(change.afterJson).slice(0, 80) : '-')}</span>
                    <span className="cwgsyw-cmdb-changes__mobile-time"><span>时间</span>{new Date(change.createdAt).toLocaleString('zh-CN')}</span>
                  </Button>
                )
              })}
            </div>
            {pageCount > 1 ? (
              <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={(nextPage) => { setPage(nextPage); setExpandedId(null) }} />
            ) : null}
            {isFetching && !isLoading ? <p className="cwgsyw-cmdb-changes__refresh" role="status">正在刷新变更记录…</p> : null}
            {expanded ? (
              <section className="cwgsyw-cmdb-changes__diff" aria-labelledby="cmdb-change-diff-title">
                <header>
                  <h2 id="cmdb-change-diff-title">变更对比</h2>
                  {(expanded.changedFields ?? []).length > 0 ? (
                    <div className="cwgsyw-inline-controls" aria-label="变更字段">
                      {(expanded.changedFields ?? []).map((field) => <Badge key={field} label={field} />)}
                    </div>
                  ) : null}
                </header>
                <div className="cwgsyw-cmdb-changes__diff-body">
                  <JsonDiffView before={expanded.beforeJson} after={expanded.afterJson} />
                </div>
              </section>
            ) : null}
          </div>
        )
      }
    />
  )
}
