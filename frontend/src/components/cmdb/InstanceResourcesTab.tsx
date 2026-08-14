'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Badge, Card, EmptyState, LoadingState } from '@/design-system/figma-neutral/components'

interface DeviceVO {
  id: number
  name: string
  ip: string | null
  deviceType: string
}

interface ChangeDocVO {
  id: number
  changeNo: string
  title: string
  status: string
  applicantName: string | null
  impactLevel: string | null
  linkCreatedAt: string | null
}

export function InstanceResourcesTab({ instanceId }: { instanceId: string }) {
  const devices = useQuery<DeviceVO[]>({
    queryKey: ['cmdb-instance-devices', instanceId],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}/devices`).then((r) => r.data.data),
  })

  const changeDocs = useQuery<ChangeDocVO[]>({
    queryKey: ['cmdb-instance-changedocs', instanceId],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}/change-docs`).then((r) => r.data.data),
  })

  if (devices.isLoading || changeDocs.isLoading) {
    return <LoadingState label="加载关联资源" />
  }

  return (
    <div className="cwgsyw-stack-list">
      <Section title="关联设备凭证" emptyMsg="暂无关联设备凭证">
        {devices.data?.map((d) => (
          <div key={d.id} className="cwgsyw-inline-controls">
            <div>
              <p className="cwgsyw-type-body-sm">{d.name}</p>
              <p className="cwgsyw-type-label-sm">{d.ip || '-'}</p>
            </div>
            <Badge label={d.deviceType} />
            <Link href={`/devices/${d.id}`} className="cwgsyw-type-label-sm">查看</Link>
          </div>
        ))}
      </Section>

      <Section title="关联变更文档" emptyMsg="暂无关联变更文档">
        {changeDocs.data?.map((d) => (
          <div key={d.id} className="cwgsyw-inline-controls">
            <div>
              <p className="cwgsyw-type-body-sm">{d.title}</p>
              <p className="cwgsyw-type-label-sm">
                {d.changeNo}{d.linkCreatedAt ? ` · ${new Date(d.linkCreatedAt).toLocaleString('zh-CN')}` : ''}
              </p>
            </div>
            <Badge label={d.status} />
            <Link href={`/change-docs/${d.id}`} className="cwgsyw-type-label-sm">查看</Link>
          </div>
        ))}
      </Section>
    </div>
  )
}

function Section({
  title, emptyMsg, children,
}: {
  title: string
  emptyMsg: string
  children: ReactNode
}) {
  const items = Array.isArray(children) ? children : []
  const hasContent = items.some(Boolean)

  return (
    <Card title={title}>
      {hasContent ? <div className="cwgsyw-stack-list">{children}</div> : <EmptyState title={emptyMsg} />}
    </Card>
  )
}
