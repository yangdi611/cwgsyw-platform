'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { useAcknowledgeAlert } from '@/hooks/usePrometheusAlerts'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

interface AlertVO {
  id: number
  ciInstanceId: number | null
  ciInstanceName: string | null
  alertName: string
  severity: string
  status: string
  summary: string | null
  description: string | null
  startsAt: string | null
  endsAt: string | null
  acknowledged: boolean
  createdAt: string
}

interface PageData {
  records: AlertVO[]
  total: number
  page: number
  size: number
}

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral'

function severityMeta(s: string): { tone: StatusTone; label: string } {
  if (s === 'critical') return { tone: 'danger', label: '严重' }
  if (s === 'warning') return { tone: 'warning', label: '警告' }
  if (s === 'info') return { tone: 'neutral', label: '提示' }
  return { tone: 'neutral', label: s || '未知' }
}

function statusMeta(s: string): { tone: StatusTone; label: string } {
  if (s === 'firing') return { tone: 'danger', label: '触发中' }
  if (s === 'resolved') return { tone: 'success', label: '已恢复' }
  return { tone: 'neutral', label: s || '—' }
}

const SEVERITY_OPTIONS = [
  { value: '__all__', label: '全部级别' },
  { value: 'critical', label: '严重' },
  { value: 'warning', label: '警告' },
  { value: 'info', label: '提示' },
]

const STATUS_OPTIONS = [
  { value: '__all__', label: '全部状态' },
  { value: 'firing', label: '触发中' },
  { value: 'resolved', label: '已恢复' },
]

const PAGE_SIZE = 20

export default function CmdbAlertsPage() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_alert', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const canRead = isHydrated && hasPermission('cmdb_alert', 'read')
  const canAck = hasPermission('cmdb_alert', 'acknowledge')

  const { data, isLoading, isError, refetch } = useQuery<PageData>({
    queryKey: ['cmdb-alerts', severity, status, page],
    queryFn: () =>
      api
        .get('/cmdb/alerts', {
          params: {
            severity: severity || undefined,
            status: status || undefined,
            page,
            size: PAGE_SIZE,
          },
        })
        .then((r) => r.data.data),
    enabled: canRead,
  })

  const ack = useAcknowledgeAlert()

  if (!canRead) return null

  const onAck = (alertId: number) => {
    ack.mutate(alertId, {
      onSuccess: () => toast.success('告警已确认'),
      onError: (e: Error) => {
        const apiErr = e as { response?: { data?: { message?: string } } }
        toast.error(apiErr?.response?.data?.message ?? '确认失败')
      },
    })
  }

  const alerts = data?.records ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <DataManagementPage
      header={
        <PageHeader
          eyebrow="CMDB"
          title="告警中心"
          subtitle="查看 Prometheus 告警，按级别与状态筛选，及时确认并关联到 CI 实例。"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/cmdb', label: 'CMDB' },
                { label: '告警中心' },
              ]}
            />
          }
        />
      }
      filter={
        <FilterBar
          filterItems={
            <div className="cwgsyw-inline-controls">
              <Select
                value={severity || '__all__'}
                options={SEVERITY_OPTIONS}
                onChange={(value) => {
                  setSeverity(value === '__all__' ? '' : value)
                  setPage(1)
                }}
              />
              <Select
                value={status || '__all__'}
                options={STATUS_OPTIONS}
                onChange={(value) => {
                  setStatus(value === '__all__' ? '' : value)
                  setPage(1)
                }}
              />
            </div>
          }
        />
      }
      content={
        isError ? (
          <ErrorState
            title="告警加载失败"
            description="无法读取告警记录，请稍后重试。"
            retry={
              <Button type="button" variant="secondary" onClick={() => refetch()}>
                重试
              </Button>
            }
          />
        ) : alerts.length === 0 && !isLoading ? (
          <EmptyState title="暂无告警" description="当前筛选条件下没有告警记录。" />
        ) : (
          <>
            <Table
              showSearch={false}
              state={isLoading ? 'loading' : 'data'}
              columns={[
                { key: 'severity', label: '级别' },
                { key: 'status', label: '状态' },
                { key: 'alert_name', label: '告警名称' },
                { key: 'ci_instance', label: '关联实例' },
                { key: 'summary', label: '摘要' },
                { key: 'starts_at', label: '触发时间' },
                { key: 'actions', label: '操作', align: 'right' },
              ]}
              rows={alerts.map((item) => ({
                id: String(item.id),
                cells: {
                  severity: <StatusBadge label={severityMeta(item.severity).label} status={severityMeta(item.severity).tone} />,
                  status: <StatusBadge label={statusMeta(item.status).label} status={statusMeta(item.status).tone} />,
                  alert_name: item.alertName,
                  ci_instance: item.ciInstanceId ? item.ciInstanceName ?? `#${item.ciInstanceId}` : '-',
                  summary: item.summary ?? '-',
                  starts_at: item.startsAt ? new Date(item.startsAt).toLocaleString('zh-CN') : '-',
                  actions: item.acknowledged ? (
                    '已确认'
                  ) : canAck ? (
                    <Button type="button" size="sm" variant="secondary" disabled={ack.isPending} onClick={() => onAck(item.id)}>
                      确认
                    </Button>
                  ) : (
                    '-'
                  ),
                },
              }))}
            />
            <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={setPage} />
          </>
        )
      }
    />
  )
}
