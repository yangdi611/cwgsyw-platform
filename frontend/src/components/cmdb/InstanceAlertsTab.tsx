'use client'

import Link from 'next/link'
import { BellOff, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useInstanceAlerts, useAcknowledgeAlert } from '@/hooks/usePrometheusAlerts'

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

interface Props {
  instanceId: string
}

/**
 * Alerts scoped to a single CI instance. Reuses the {@link useInstanceAlerts}
 * hook (and {@link useAcknowledgeAlert} mutation, which invalidates both the
 * instance-scoped and global alert query caches).
 */
export function InstanceAlertsTab({ instanceId }: Props) {
  const { data, isLoading } = useInstanceAlerts(instanceId)
  // See AlertVO note above: cast to the runtime snake_case shape.
  const alerts = (data as unknown as AlertVO[] | undefined) ?? []
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

  return (
    <div className="border rounded-lg p-5">
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">加载中...</p>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <BellOff className="h-8 w-8 mb-2" />
          <p className="text-sm">该实例暂无告警</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => {
            const sev = severityMeta(a.severity)
            const st = statusMeta(a.status)
            return (
              <div key={a.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${sev.cls}`}>{sev.label}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                      <span className="text-sm font-medium truncate">{a.alert_name}</span>
                      {a.acknowledged && (
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />已确认
                        </span>
                      )}
                    </div>
                    {a.summary && (
                      <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{a.summary}</p>
                    )}
                    {a.starts_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        触发于 {new Date(a.starts_at).toLocaleString('zh-CN')}
                        {a.ends_at && ` · 恢复于 ${new Date(a.ends_at).toLocaleString('zh-CN')}`}
                      </p>
                    )}
                  </div>
                  {!a.acknowledged && (
                    <Button size="sm" variant="outline" disabled={ack.isPending} onClick={() => onAck(a.id)}>
                      确认
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 pt-3 border-t text-right">
        <Link href="/cmdb/alerts" className="text-xs text-muted-foreground hover:text-foreground">
          查看全部告警 →
        </Link>
      </div>
    </div>
  )
}
