'use client'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import {
  PageHeader,
  FilterBar,
  FilterChip,
  DataTable,
  DetailDrawer,
  type ColumnDef,
} from '@/components/shared'
import { ArrowRight, FileText } from 'lucide-react'

interface ChangeDocListItem {
  id: number
  changeNo: string
  templateName: string
  status: string
  applicantName: string
  createdAt: string
}

type StatusVariant = 'ok' | 'warn' | 'danger' | 'neutral'

const STATUS_META: Record<string, { label: string; variant: StatusVariant }> = {
  draft: { label: '草稿', variant: 'neutral' },
  pending: { label: '待审批', variant: 'warn' },
  approved: { label: '已通过', variant: 'ok' },
  rejected: { label: '已拒绝', variant: 'danger' },
}

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s || '未知', variant: 'neutral' as StatusVariant }
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
  const [selected, setSelected] = useState<ChangeDocListItem | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('change_doc', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: docs = [], isLoading } = useQuery<ChangeDocListItem[]>({
    queryKey: ['change-docs'],
    queryFn: () => api.get('/change-docs').then((r) => r.data.data),
    enabled: hasPermission('change_doc', 'read'),
  })

  const filtered = docs.filter((d) => statusFilter === 'all' || d.status === statusFilter)

  const columns: ColumnDef<ChangeDocListItem>[] = [
    {
      key: 'changeNo',
      title: '变更单号',
      render: (r) => (
        <span className="font-semibold text-v2-fg">
          {r.changeNo}
          {r.templateName ? ` — ${r.templateName}` : ''}
        </span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      render: (r) => <StatusBadge status={statusMeta(r.status).variant}>{statusMeta(r.status).label}</StatusBadge>,
    },
    {
      key: 'applicantName',
      title: '申请人',
      render: (r) => <span className="text-v2-fg">{r.applicantName || '-'}</span>,
    },
    {
      key: 'createdAt',
      title: '创建时间',
      render: (r) => <span className="text-sm text-v2-muted whitespace-nowrap">{formatDay(r.createdAt)}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="变更文档"
        title="变更文档"
        subtitle="管理 IT 变更申请单和变更方案，跟踪审批状态与执行结果。"
        actions={
          hasPermission('change_doc', 'create') ? (
            <Button variant="primary" onClick={() => router.push('/change-docs/new')}>
              <FileText className="h-4 w-4" />
              新建变更
            </Button>
          ) : undefined
        }
      />

      <FilterBar>
        <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
          全部
        </FilterChip>
        <FilterChip active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')}>
          待审批
        </FilterChip>
        <FilterChip active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')}>
          已通过
        </FilterChip>
        <FilterChip active={statusFilter === 'rejected'} onClick={() => setStatusFilter('rejected')}>
          已拒绝
        </FilterChip>
        <FilterChip active={statusFilter === 'draft'} onClick={() => setStatusFilter('draft')}>
          草稿
        </FilterChip>
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(r) => r.id}
        loading={isLoading}
        onRowClick={(r) => setSelected(r)}
        empty={{ title: '暂无变更文档', description: '当前状态下没有变更文档，请调整筛选或新建变更。' }}
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.changeNo}
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
                <div>
                  <dt className="text-xs text-v2-muted">变更单号</dt>
                  <dd className="mt-0.5 break-all font-v2-mono text-sm text-v2-fg">{selected.changeNo}</dd>
                </div>
                <div>
                  <dt className="text-xs text-v2-muted">模板</dt>
                  <dd className="mt-0.5 text-sm text-v2-fg">{selected.templateName || '-'}</dd>
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
    </div>
  )
}
