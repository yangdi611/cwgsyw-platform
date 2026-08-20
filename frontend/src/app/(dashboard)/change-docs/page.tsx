'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Chip,
  DataManagementPage,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  NeutralDrawer,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

interface ChangeDocListItem {
  id: number
  changeNo: string
  title: string
  status: string
  applicationTemplateId: number | null
  applicationTemplateName: string | null
  planTemplateId: number | null
  planTemplateName: string | null
  applicantName: string
  createdAt: string
}

interface PageData {
  records: ChangeDocListItem[]
  total: number
  page: number
  size: number
}

const STATUS_META: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  draft: { label: '草稿', tone: 'neutral' },
  pending: { label: '待审批', tone: 'warning' },
  plan_pending: { label: '待补填方案', tone: 'warning' },
  approved: { label: '已通过', tone: 'success' },
  rejected: { label: '已拒绝', tone: 'danger' },
}

const STATUS_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审批' },
  { value: 'plan_pending', label: '待补填方案' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'draft', label: '草稿' },
] as const

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status || '未知', tone: 'neutral' as const }
}

function templateSummary(doc: ChangeDocListItem): string {
  const parts: string[] = []
  if (doc.applicationTemplateName) parts.push(`申请：${doc.applicationTemplateName}`)
  if (doc.planTemplateName) parts.push(`方案：${doc.planTemplateName}`)
  return parts.join(' / ')
}

function formatDay(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function ChangeDocsPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ChangeDocListItem | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('change_doc', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const canRead = isHydrated && hasPermission('change_doc', 'read')

  const { data, isLoading, isError, refetch } = useQuery<PageData>({
    queryKey: ['change-docs', statusFilter, keyword, page],
    queryFn: () =>
      api.get('/change-docs', {
        params: {
          status: statusFilter === 'all' ? undefined : statusFilter,
          keyword: keyword || undefined,
          page,
          size: 20,
        },
      }).then((response) => response.data.data),
    enabled: canRead,
  })

  const docs = data?.records ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 20))

  const updateStatus = (status: string) => {
    setStatusFilter(status)
    setPage(1)
  }

  if (!isHydrated) {
    return (
      <DataManagementPage
        embedded
        className="cwgsyw-change-docs-list"
        content={<LoadingState label="正在准备变更文档…" />}
      />
    )
  }

  if (!hasPermission('change_doc', 'read')) return null

  const hasActiveFilters = statusFilter !== 'all' || Boolean(keyword)

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-change-docs-list"
        header={
          <PageHeader
            title="变更文档"
            subtitle="管理 IT 变更申请单和变更方案，跟踪审批状态与执行结果。"
            actions={
              hasPermission('change_doc', 'create') ? (
                <Button className="cwgsyw-change-docs-list__create" type="button" size="sm" onClick={() => router.push('/change-docs/new')}>
                  新建变更
                </Button>
              ) : undefined
            }
          />
        }
        filter={
          <FilterBar
            search={
              <SearchInput
                value={keyword}
                placeholder="搜索标题或变更单号"
                aria-label="搜索变更标题或变更单号"
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setPage(1)
                  setSelected(null)
                }}
                onClear={() => {
                  setKeyword('')
                  setPage(1)
                  setSelected(null)
                }}
              />
            }
            filterItems={
              <div className="cwgsyw-change-docs-list__status-filters" role="group" aria-label="变更文档状态">
                {STATUS_FILTERS.map((item) => (
                  <Chip
                    key={item.value}
                    label={item.label}
                    selected={statusFilter === item.value}
                    onClick={() => updateStatus(item.value)}
                  />
                ))}
              </div>
            }
          />
        }
        content={
          isError ? (
            <ErrorState
              title="变更文档加载失败"
              description="无法读取变更文档，请稍后重试。"
              retry={<Button type="button" variant="secondary" onClick={() => void refetch()}>重试</Button>}
            />
          ) : isLoading ? (
            <LoadingState label="正在加载变更文档…" />
          ) : docs.length === 0 ? (
            <EmptyState
              title="暂无变更文档"
              description={hasActiveFilters ? '没有符合当前筛选条件的变更文档。' : '当前还没有变更文档。'}
              action={
                hasActiveFilters ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setKeyword('')
                      setStatusFilter('all')
                      setPage(1)
                    }}
                  >
                    清除筛选
                  </Button>
                ) : hasPermission('change_doc', 'create') ? (
                  <Button type="button" size="sm" onClick={() => router.push('/change-docs/new')}>
                    新建变更
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="cwgsyw-change-docs-list__content">
              <Table
                showSearch={false}
                density="compact"
                className="cwgsyw-change-docs-list__table"
                onRowClick={(id) => setSelected(docs.find((doc) => String(doc.id) === id) ?? null)}
                columns={[
                  { key: 'title', label: '变更标题' },
                  { key: 'changeNo', label: '变更单号' },
                  { key: 'status', label: '状态' },
                  { key: 'applicantName', label: '申请人' },
                  { key: 'createdAt', label: '创建时间' },
                ]}
                rows={docs.map((doc) => {
                  const status = statusMeta(doc.status)
                  const summary = templateSummary(doc)
                  return {
                    id: String(doc.id),
                    selected: selected?.id === doc.id,
                    cells: {
                      title: doc.title || '—',
                      changeNo: summary ? `${doc.changeNo} ${summary}` : doc.changeNo,
                      status: <StatusBadge label={status.label} status={status.tone} />,
                      applicantName: doc.applicantName || '-',
                      createdAt: formatDay(doc.createdAt),
                    },
                  }
                })}
              />
              <Pagination
                page={page}
                pageCount={pageCount}
                totalCount={total}
                onPageChange={(nextPage) => {
                  setPage(nextPage)
                  setSelected(null)
                }}
              />
            </div>
          )
        }
      />
      <NeutralDrawer
        open={!!selected}
        onOpenChange={(open) => { if (!open) setSelected(null) }}
        title="变更详情"
        description={selected?.changeNo}
        className="cwgsyw-change-docs-preview-drawer"
        showClose
      >
        {selected ? (
          <div className="cwgsyw-change-docs-preview">
            <header className="cwgsyw-change-docs-preview__header">
              <h2>{selected.title || '未命名变更'}</h2>
              <StatusBadge label={statusMeta(selected.status).label} status={statusMeta(selected.status).tone} />
            </header>
            <dl className="cwgsyw-change-docs-preview__list">
              <div className="cwgsyw-change-docs-preview__row">
                <dt>变更标题</dt>
                <dd>{selected.title || '-'}</dd>
              </div>
              <div className="cwgsyw-change-docs-preview__row">
                <dt>变更单号</dt>
                <dd>{selected.changeNo}</dd>
              </div>
              <div className="cwgsyw-change-docs-preview__row">
                <dt>申请单模板</dt>
                <dd>{selected.applicationTemplateName || '-'}</dd>
              </div>
              <div className="cwgsyw-change-docs-preview__row">
                <dt>方案模板</dt>
                <dd>{selected.planTemplateName || '-'}</dd>
              </div>
              <div className="cwgsyw-change-docs-preview__row">
                <dt>申请人</dt>
                <dd>{selected.applicantName || '-'}</dd>
              </div>
              <div className="cwgsyw-change-docs-preview__row">
                <dt>创建时间</dt>
                <dd>{formatDay(selected.createdAt)}</dd>
              </div>
            </dl>
            <div className="cwgsyw-change-docs-preview__actions">
              <Button type="button" size="sm" onClick={() => router.push(`/change-docs/${selected.id}`)}>
                查看完整详情
              </Button>
            </div>
          </div>
        ) : null}
      </NeutralDrawer>
    </>
  )
}
