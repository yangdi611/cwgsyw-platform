'use client'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button, Input, StatusBadge } from '@/components/design-system'
import {
  PageHeader,
  PageShell,
  FilterBar,
  FilterChip,
  DataTable,
  DetailDrawer,
  ErrorState,
  Pagination,
  type ColumnDef,
} from '@/components/shared'
import { ArrowRight, FileText } from 'lucide-react'

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

type StatusVariant = 'ok' | 'warn' | 'danger' | 'neutral'

const STATUS_META: Record<string, { label: string; variant: StatusVariant }> = {
  draft: { label: '草稿', variant: 'neutral' },
  pending: { label: '待审批', variant: 'warn' },
  plan_pending: { label: '待补填方案', variant: 'warn' },
  approved: { label: '已通过', variant: 'ok' },
  rejected: { label: '已拒绝', variant: 'danger' },
}

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s || '未知', variant: 'neutral' as StatusVariant }
}

function templateSummary(d: ChangeDocListItem): string {
  const parts: string[] = []
  if (d.applicationTemplateName) parts.push(`申请：${d.applicationTemplateName}`)
  if (d.planTemplateName) parts.push(`方案：${d.planTemplateName}`)
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
    queryFn: () => api.get('/change-docs', {
      params: {
        status: statusFilter === 'all' ? undefined : statusFilter,
        keyword: keyword || undefined,
        page,
        size: 20,
      },
    }).then((r) => r.data.data),
    enabled: canRead,
  })

  const docs = data?.records ?? []
  const total = data?.total ?? 0

  const updateStatus = (status: string) => {
    setStatusFilter(status)
    setPage(1)
  }

  const columns: ColumnDef<ChangeDocListItem>[] = [
    {
      key: 'title',
      title: '变更标题',
      render: (r) => (
        <span className="font-semibold text-v2-fg">{r.title || '—'}</span>
      ),
    },
    {
      key: 'change_no',
      title: '变更单号',
      render: (r) => {
        const summary = templateSummary(r)
        return (
          <div className="flex flex-col">
            <span className="font-v2-mono text-sm text-v2-fg">{r.changeNo}</span>
            {summary && <span className="text-xs text-v2-muted">{summary}</span>}
          </div>
        )
      },
    },
    {
      key: 'status',
      title: '状态',
      render: (r) => <StatusBadge status={statusMeta(r.status).variant}>{statusMeta(r.status).label}</StatusBadge>,
    },
    {
      key: 'applicant_name',
      title: '申请人',
      render: (r) => <span className="text-v2-fg">{r.applicantName || '-'}</span>,
    },
    {
      key: 'created_at',
      title: '创建时间',
      render: (r) => <span className="text-sm text-v2-muted whitespace-nowrap">{formatDay(r.createdAt)}</span>,
    },
  ]

  if (!canRead) return null

  return (
    <PageShell width="full" density="comfortable">
      <PageHeader
        className="flex-wrap gap-4"
        eyebrow="变更文档"
        title="变更文档"
        subtitle="管理 IT 变更申请单和变更方案，跟踪审批状态与执行结果。"
        actions={
          hasPermission('change_doc', 'create') ? (
            <div className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto" variant="primary" onClick={() => router.push('/change-docs/new')}>
                <FileText className="h-4 w-4" />
                新建变更
              </Button>
            </div>
          ) : undefined
        }
      />

      <FilterBar className="w-full items-stretch sm:items-center">
        <Input
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value)
            setPage(1)
          }}
          placeholder="搜索标题或变更单号"
          className="h-9 w-full sm:w-56"
        />
        <FilterChip active={statusFilter === 'all'} onClick={() => updateStatus('all')}>
          全部
        </FilterChip>
        <FilterChip active={statusFilter === 'pending'} onClick={() => updateStatus('pending')}>
          待审批
        </FilterChip>
        <FilterChip active={statusFilter === 'plan_pending'} onClick={() => updateStatus('plan_pending')}>
          待补填方案
        </FilterChip>
        <FilterChip active={statusFilter === 'approved'} onClick={() => updateStatus('approved')}>
          已通过
        </FilterChip>
        <FilterChip active={statusFilter === 'rejected'} onClick={() => updateStatus('rejected')}>
          已拒绝
        </FilterChip>
        <FilterChip active={statusFilter === 'draft'} onClick={() => updateStatus('draft')}>
          草稿
        </FilterChip>
      </FilterBar>

      {isError ? (
        <div className="rounded-lg border border-v2-border bg-v2-surface">
          <ErrorState
            title="变更文档加载失败"
            description="无法读取变更文档，请稍后重试。"
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={docs}
          rowKey={(r) => r.id}
          loading={isLoading}
          onRowClick={(r) => setSelected(r)}
          empty={{
            title: '暂无变更文档',
            description: '当前状态下没有变更文档，请调整筛选或新建变更。',
            action: hasPermission('change_doc', 'create') ? (
              <Button variant="primary" size="sm" onClick={() => router.push('/change-docs/new')}>
                <FileText className="h-4 w-4" />
                新建变更
              </Button>
            ) : undefined,
          }}
        />
      )}

      <Pagination page={page} pageSize={20} total={total} onPageChange={setPage} />

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title || selected?.changeNo}
        subtitle={
          selected ? (
            <StatusBadge status={statusMeta(selected.status).variant}>
              {statusMeta(selected.status).label}
            </StatusBadge>
          ) : undefined
        }
        footer={
          selected ? (
            <div className="flex items-center justify-end">
              <Button variant="primary" size="sm" onClick={() => router.push(`/change-docs/${selected.id}`)}>
                <FileText className="h-4 w-4" />
                查看完整详情
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-5">
            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-v2-muted">基本信息</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2">
                  <dt className="text-xs text-v2-muted">变更标题</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-v2-fg">{selected.title || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-v2-muted">变更单号</dt>
                  <dd className="mt-0.5 break-all font-v2-mono text-sm text-v2-fg">{selected.changeNo}</dd>
                </div>
                <div>
                  <dt className="text-xs text-v2-muted">状态</dt>
                  <dd className="mt-0.5">
                    <StatusBadge status={statusMeta(selected.status).variant}>
                      {statusMeta(selected.status).label}
                    </StatusBadge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-v2-muted">申请单模板</dt>
                  <dd className="mt-0.5 text-sm text-v2-fg">{selected.applicationTemplateName || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-v2-muted">方案模板</dt>
                  <dd className="mt-0.5 text-sm text-v2-fg">{selected.planTemplateName || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-v2-muted">申请人</dt>
                  <dd className="mt-0.5 text-sm text-v2-fg">{selected.applicantName || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-v2-muted">创建时间</dt>
                  <dd className="mt-0.5 text-sm text-v2-fg">{formatDay(selected.createdAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </DetailDrawer>
    </PageShell>
  )
}
