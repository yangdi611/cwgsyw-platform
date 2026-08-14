'use client'

import Link from 'next/link'
import { toast } from '@/design-system/figma-neutral/toast'
import { useInstanceAlerts, useAcknowledgeAlert } from '@/hooks/usePrometheusAlerts'
import { Button, Card, EmptyState, LoadingState, StatusBadge } from '@/design-system/figma-neutral/components'

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

interface Props {
  instanceId: string
}

export function InstanceAlertsTab({ instanceId }: Props) {
  const { data, isLoading } = useInstanceAlerts(instanceId)
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
    <Card title="告警" footer={<Link href="/cmdb/alerts" className="cwgsyw-type-label-sm">查看全部告警</Link>}>
      {isLoading ? (
        <LoadingState label="加载告警" />
      ) : alerts.length === 0 ? (
        <EmptyState title="该实例暂无告警" description="当前没有需要处理的告警。" />
      ) : (
        <div className="cwgsyw-stack-list">
          {alerts.map((a) => {
            const sev = severityMeta(a.severity)
            const st = statusMeta(a.status)
            return (
              <Card key={a.id} showHeader={false} padding="sm">
                <div className="cwgsyw-inline-controls">
                  <StatusBadge label={sev.label} status={sev.tone} />
                  <StatusBadge label={st.label} status={st.tone} />
                  <strong className="cwgsyw-type-body-sm">{a.alertName}</strong>
                  {a.acknowledged ? <span className="cwgsyw-type-label-sm">已确认</span> : null}
                  {!a.acknowledged ? (
                    <Button type="button" size="sm" variant="secondary" disabled={ack.isPending} onClick={() => onAck(a.id)}>
                      确认
                    </Button>
                  ) : null}
                </div>
                {a.summary ? <p className="cwgsyw-type-body-sm">{a.summary}</p> : null}
                {a.startsAt ? (
                  <p className="cwgsyw-type-label-sm">
                    触发于 {new Date(a.startsAt).toLocaleString('zh-CN')}
                    {a.endsAt ? ` · 恢复于 ${new Date(a.endsAt).toLocaleString('zh-CN')}` : ''}
                  </p>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}
    </Card>
  )
}
