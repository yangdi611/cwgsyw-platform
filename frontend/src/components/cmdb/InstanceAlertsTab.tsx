'use client'

import Image from 'next/image'
import Link from 'next/link'
import { toast } from '@/design-system/figma-neutral/toast'
import { useInstanceAlerts, useAcknowledgeAlert } from '@/hooks/usePrometheusAlerts'
import { Button, EmptyState, LoadingState, StatusBadge } from '@/design-system/figma-neutral/components'

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
    <section className="cwgsyw-cmdb-instance-tab__section cwgsyw-cmdb-instance-tab__alerts">
      <div className="cwgsyw-cmdb-instance-tab__head">
        <h2>告警</h2>
        <Link href="/cmdb/alerts">查看全部告警</Link>
      </div>
      <div className="cwgsyw-cmdb-instance-tab__body">
        {isLoading ? (
          <LoadingState label="加载告警" />
        ) : alerts.length === 0 ? (
          <div className="cwgsyw-cmdb-instance-tab__empty">
            <span className="cwgsyw-cmdb-instance-tab__empty-icon" aria-hidden="true">
              <Image
                src="/figma-icons/cmdb-alert-circle.svg"
                alt=""
                width={22}
                height={22}
                data-figma-node="6:22984"
                className="cwgsyw-cmdb-instance-tab__empty-icon-image"
              />
            </span>
            <EmptyState
              showIcon={false}
              title="该实例暂无告警"
              description="当前没有需要处理的告警。"
            />
          </div>
        ) : (
          <div className="cwgsyw-cmdb-instance-tab__rows">
            {alerts.map((a) => {
              const sev = severityMeta(a.severity)
              const st = statusMeta(a.status)
              return (
                <article key={a.id} className="cwgsyw-cmdb-instance-tab__row cwgsyw-cmdb-instance-tab__alert-row">
                  <div className="cwgsyw-cmdb-instance-tab__row-main">
                    <div className="cwgsyw-inline-controls">
                      <StatusBadge label={sev.label} status={sev.tone} />
                      <StatusBadge label={st.label} status={st.tone} />
                      <span className="cwgsyw-cmdb-instance-tab__row-title">{a.alertName}</span>
                      {a.acknowledged ? <span className="cwgsyw-cmdb-instance-tab__muted">已确认</span> : null}
                    </div>
                    {a.summary ? <p>{a.summary}</p> : null}
                    {a.startsAt ? (
                      <p className="cwgsyw-cmdb-instance-tab__muted">
                        触发于 {new Date(a.startsAt).toLocaleString('zh-CN')}
                        {a.endsAt ? ` · 恢复于 ${new Date(a.endsAt).toLocaleString('zh-CN')}` : ''}
                      </p>
                    ) : null}
                  </div>
                  {!a.acknowledged ? (
                    <Button type="button" size="sm" variant="secondary" disabled={ack.isPending} onClick={() => onAck(a.id)}>
                      确认
                    </Button>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
