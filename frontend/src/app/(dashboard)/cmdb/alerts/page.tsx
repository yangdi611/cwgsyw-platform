'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { useAcknowledgeAlert } from '@/hooks/usePrometheusAlerts'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight, CheckCircle2, Bell, Filter } from 'lucide-react'
import { toast } from 'sonner'

/**
 * Runtime shape of a CMDB alert. The shared `CmdbAlertVO` in
 * `usePrometheusAlerts` is typed in camelCase, but the backend's global Jackson
 * SNAKE_CASE strategy serialises the actual response as snake_case — so we read
 * the fields that way. TODO: align the hook's interface with snake_case.
 */
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

const SEVERITY_META: Record<string, { label: string; cls: string }> = {
  critical: { label: '严重', cls: 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300' },
  warning: { label: '警告', cls: 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  info: { label: '提示', cls: 'border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300' },
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  firing: { label: '触发中', cls: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300' },
  resolved: { label: '已恢复', cls: 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300' },
}

function severityMeta(s: string) {
  return SEVERITY_META[s] ?? { label: s || '未知', cls: 'border-border bg-muted text-muted-foreground' }
}
function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s || '—', cls: 'border-border bg-muted text-muted-foreground' }
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
        .then(r => r.data.data),
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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold">CMDB 告警</h1>
          <p className="text-sm text-muted-foreground mt-1">Prometheus 告警列表与确认</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 border rounded-lg bg-card/50">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={severity || '__all__'}
          onValueChange={v => { setSeverity(v === '__all__' ? '' : (v ?? '')); setPage(1) }}
        >
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="全部级别" />
          </SelectTrigger>
          <SelectContent>
            {SEVERITY_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status || '__all__'}
          onValueChange={v => { setStatus(v === '__all__' ? '' : (v ?? '')); setPage(1) }}
        >
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm py-12 text-center">加载中...</p>
      ) : alerts.length === 0 ? (
        <p className="text-muted-foreground text-sm py-12 text-center">暂无告警</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">级别</TableHead>
                <TableHead className="w-24">状态</TableHead>
                <TableHead>告警名称</TableHead>
                <TableHead className="w-40">关联实例</TableHead>
                <TableHead>摘要</TableHead>
                <TableHead className="w-44">触发时间</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map(a => {
                const sev = severityMeta(a.severity)
                const st = statusMeta(a.status)
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${sev.cls}`}>
                        {sev.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${st.cls}`}>
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {a.alert_name}
                      {a.description && (
                        <span className="block text-xs font-normal text-muted-foreground line-clamp-1 mt-0.5">
                          {a.description}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.ci_instance_id ? (a.ci_instance_name ?? `#${a.ci_instance_id}`) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground line-clamp-1">
                      {a.summary ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {a.starts_at ? new Date(a.starts_at).toLocaleString('zh-CN') : '—'}
                    </TableCell>
                    <TableCell>
                      {a.acknowledged ? (
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />已确认
                        </span>
                      ) : canAck ? (
                        <Button size="sm" variant="outline" disabled={ack.isPending} onClick={() => onAck(a.id)}>
                          确认
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
