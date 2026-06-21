'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { useAcknowledgeAlert } from '@/hooks/usePrometheusAlerts'
import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, FilterBar, DataTable, Pagination, type ColumnDef } from '@/components/shared'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

interface AlertVO {
  id: number
  ci_instance_id: number | null
  ci_instance_name: string | null
  alert_name: string
  severity: string
  status: string
  summary: string | null
  description: string | null
  starts_at: string | null
  ends_at: string | null
  acknowledged: boolean
  created_at: string
}

interface PageData {
  records: AlertVO[]
  total: number
  page: number
  size: number
}

type StatusVariant = 'ok' | 'warn' | 'danger' | 'neutral'

function severityMeta(s: string): { variant: StatusVariant; label: string } {
  if (s === 'critical') return { variant: 'danger', label: '严重' }
  if (s === 'warning') return { variant: 'warn', label: '警告' }
  if (s === 'info') return { variant: 'neutral', label: '提示' }
  return { variant: 'neutral', label: s || '未知' }
}

function statusMeta(s: string): { variant: StatusVariant; label: string } {
  if (s === 'firing') return { variant: 'danger', label: '触发中' }
  if (s === 'resolved') return { variant: 'ok', label: '已恢复' }
  return { variant: 'neutral', label: s || '—' }
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

  const canRead = hasPermission('cmdb_alert', 'read')
  const canAck = hasPermission('cmdb_alert', 'acknowledge')

  const { data, isLoading } = useQuery<PageData>({
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

  const columns: ColumnDef<AlertVO>[] = [
    {
      key: 'severity',
      title: '级别',
      render: (r) => {
        const m = severityMeta(r.severity)
        return <StatusBadge status={m.variant}>{m.label}</StatusBadge>
      },
    },
    {
      key: 'status',
      title: '状态',
      render: (r) => {
        const m = statusMeta(r.status)
        return <StatusBadge status={m.variant}>{m.label}</StatusBadge>
      },
    },
    {
      key: 'alert_name',
      title: '告警名称',
      render: (r) => (
        <div>
          <div className="font-medium text-v2-fg">{r.alert_name}</div>
          {r.description && (
            <div className="mt-0.5 line-clamp-1 text-xs text-v2-muted">{r.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'ci_instance',
      title: '关联实例',
      render: (r) => (
        <span className="text-sm text-v2-fg">
          {r.ci_instance_id ? r.ci_instance_name ?? `#${r.ci_instance_id}` : '-'}
        </span>
      ),
    },
    {
      key: 'summary',
      title: '摘要',
      render: (r) => <span className="line-clamp-1 text-sm text-v2-muted">{r.summary ?? '-'}</span>,
    },
    {
      key: 'starts_at',
      title: '触发时间',
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-v2-muted">
          {r.starts_at ? new Date(r.starts_at).toLocaleString('zh-CN') : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (r) =>
        r.acknowledged ? (
          <span className="inline-flex items-center gap-1 text-xs text-v2-muted">
            <CheckCircle2 className="h-3 w-3" />
            已确认
          </span>
        ) : canAck ? (
          <Button size="sm" variant="secondary" disabled={ack.isPending} onClick={() => onAck(r.id)}>
            确认
          </Button>
        ) : (
          <span className="text-v2-subtle">-</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CMDB"
        title="告警中心"
        subtitle="查看 Prometheus 告警，按级别与状态筛选，及时确认并关联到 CI 实例。"
      />

      <FilterBar>
        <Select
          value={severity || '__all__'}
          onValueChange={(v) => {
            setSeverity(v === '__all__' ? '' : v ?? '')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="全部级别" />
          </SelectTrigger>
          <SelectContent>
            {SEVERITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status || '__all__'}
          onValueChange={(v) => {
            setStatus(v === '__all__' ? '' : v ?? '')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={alerts}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty={{ title: '暂无告警', description: '当前筛选条件下没有告警记录。' }}
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  )
}
