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
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
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

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

function severityMeta(s: string): { tone: StatusTone; label: string } {
  if (s === 'critical') return { tone: 'danger', label: '严重' }
  if (s === 'warning') return { tone: 'warning', label: '警告' }
  if (s === 'info') return { tone: 'info', label: '提示' }
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
// Figma CWGSYW / Icons: alert-circle, node 6:22984.
const EMPTY_ALERT_ICON = '/figma-icons/cmdb-alert-circle.svg'

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

  const canRead = hasPermission('cmdb_alert', 'read')
  const canAck = hasPermission('cmdb_alert', 'acknowledge')

  const { data, isLoading, isFetching, isError, refetch } = useQuery<PageData>({
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
    enabled: isHydrated && canRead,
  })

  const ack = useAcknowledgeAlert()

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
  const hasFilters = Boolean(severity || status)

  return (
    <DataManagementPage className="cwgsyw-cmdb-page cwgsyw-cmdb-alerts"
      header={
        <div className="cwgsyw-cmdb-instance-page">
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="告警中心"
            subtitle="按级别和状态筛选 Prometheus 告警"
          />
        </div>
      }
      filter={
        <FilterBar
          filterItems={
            <div className="cwgsyw-cmdb-alerts__filters">
              <Select size="sm" overlay
                aria-label="按告警级别筛选"
                value={severity || '__all__'}
                options={SEVERITY_OPTIONS}
                onChange={(value) => {
                  setSeverity(value === '__all__' ? '' : value)
                  setPage(1)
                }}
              />
              <Select size="sm" overlay
                aria-label="按告警状态筛选"
                value={status || '__all__'}
                options={STATUS_OPTIONS}
                onChange={(value) => {
                  setStatus(value === '__all__' ? '' : value)
                  setPage(1)
                }}
              />
            </div>
          }
          reset={hasFilters ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => { setSeverity(''); setStatus(''); setPage(1) }}>
              清除筛选
            </Button>
          ) : null}
        />
      }
      content={
        !isHydrated ? (
          <LoadingState label="正在检查访问权限" />
        ) : !canRead ? (
          <ErrorState title="无权查看告警中心" description="需要 CMDB 告警读取权限。" />
        ) : isError ? (
          <ErrorState
            title="告警加载失败"
            description="无法读取告警记录，请稍后重试。"
            retry={
              <Button type="button" size="sm" variant="secondary" onClick={() => refetch()}>
                重试
              </Button>
            }
          />
        ) : isLoading ? (
          <LoadingState label="加载告警记录" />
        ) : alerts.length === 0 ? (
          <div className="cwgsyw-cmdb-alerts__empty">
            {/* The exact 22px Figma SVG should be served directly; image optimization adds no value here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={EMPTY_ALERT_ICON} width={22} height={22} alt="" />
            <EmptyState
              showIcon={false}
              title={hasFilters ? '没有符合筛选条件的告警' : '暂无告警'}
              description={hasFilters ? '调整告警级别或状态后重试。' : 'Prometheus 告警同步后会显示在这里。'}
              action={hasFilters ? <Button type="button" size="sm" variant="secondary" onClick={() => { setSeverity(''); setStatus(''); setPage(1) }}>清除筛选</Button> : undefined}
            />
          </div>
        ) : (
          <div className="cwgsyw-cmdb-alerts__content">
            <Table
              className="cwgsyw-cmdb-table cwgsyw-cmdb-alerts__table"
              showSearch={false}
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
                    <StatusBadge label="已确认" status="neutral" />
                  ) : canAck ? (
                    <Button type="button" size="sm" variant="secondary" aria-label={`确认告警 ${item.alertName}`} disabled={ack.isPending} onClick={() => onAck(item.id)}>
                      确认
                    </Button>
                  ) : (
                    '-'
                  ),
                },
              }))}
            />
            <div className="cwgsyw-cmdb-alerts__mobile-list" aria-label="告警记录">
              {alerts.map((item) => (
                <article key={item.id} className="cwgsyw-cmdb-alerts__mobile-item">
                  <header>
                    <div className="cwgsyw-inline-controls">
                      <StatusBadge label={severityMeta(item.severity).label} status={severityMeta(item.severity).tone} />
                      <StatusBadge label={statusMeta(item.status).label} status={statusMeta(item.status).tone} />
                    </div>
                    {item.acknowledged ? <StatusBadge label="已确认" status="neutral" /> : null}
                  </header>
                  <h2>{item.alertName}</h2>
                  <p>{item.summary ?? '暂无摘要'}</p>
                  <dl>
                    <div><dt>关联实例</dt><dd>{item.ciInstanceId ? item.ciInstanceName ?? `#${item.ciInstanceId}` : '—'}</dd></div>
                    <div><dt>触发时间</dt><dd>{item.startsAt ? new Date(item.startsAt).toLocaleString('zh-CN') : '—'}</dd></div>
                  </dl>
                  {!item.acknowledged && canAck ? (
                    <div className="cwgsyw-cmdb-alerts__mobile-actions">
                      <Button type="button" size="sm" variant="secondary" aria-label={`确认告警 ${item.alertName}`} disabled={ack.isPending} onClick={() => onAck(item.id)}>
                        确认
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            {pageCount > 1 ? <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={setPage} /> : null}
            {isFetching && !isLoading ? <p className="cwgsyw-cmdb-alerts__refresh" role="status">正在刷新告警记录…</p> : null}
          </div>
        )
      }
    />
  )
}
