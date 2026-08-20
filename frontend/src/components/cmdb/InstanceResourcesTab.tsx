'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Badge, EmptyState, LoadingState } from '@/design-system/figma-neutral/components'

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
    <div className="cwgsyw-cmdb-instance-tab cwgsyw-cmdb-instance-tab__resources">
      <Section
        title="关联设备凭证"
        emptyMsg="暂无关联设备凭证"
        emptyIcon={{ src: '/figma-icons/cmdb-resource-key.svg', figmaNode: '6:27336', width: 22, height: 21 }}
      >
        {devices.data?.map((d) => (
          <div key={d.id} className="cwgsyw-cmdb-instance-tab__row">
            <div className="cwgsyw-cmdb-instance-tab__row-main">
              <p className="cwgsyw-cmdb-instance-tab__row-title">{d.name}</p>
              <p className="cwgsyw-cmdb-instance-tab__muted">{d.ip || '-'}</p>
            </div>
            <Badge label={d.deviceType} />
            <Link href={`/devices/${d.id}`}>查看</Link>
          </div>
        ))}
      </Section>

      <Section
        title="关联变更文档"
        emptyMsg="暂无关联变更文档"
        emptyIcon={{ src: '/figma-icons/cmdb-resource-file-diff.svg', figmaNode: '6:25779', width: 18, height: 22 }}
      >
        {changeDocs.data?.map((d) => (
          <div key={d.id} className="cwgsyw-cmdb-instance-tab__row">
            <div className="cwgsyw-cmdb-instance-tab__row-main">
              <p className="cwgsyw-cmdb-instance-tab__row-title">{d.title}</p>
              <p className="cwgsyw-cmdb-instance-tab__muted">
                {d.changeNo}{d.linkCreatedAt ? ` · ${new Date(d.linkCreatedAt).toLocaleString('zh-CN')}` : ''}
              </p>
            </div>
            <Badge label={d.status} />
            <Link href={`/change-docs/${d.id}`}>查看</Link>
          </div>
        ))}
      </Section>
    </div>
  )
}

function Section({
  title, emptyMsg, emptyIcon, children,
}: {
  title: string
  emptyMsg: string
  emptyIcon?: { src: string; figmaNode: string; width: number; height: number }
  children: ReactNode
}) {
  const items = Array.isArray(children) ? children : []
  const hasContent = items.some(Boolean)

  return (
    <section className="cwgsyw-cmdb-instance-tab__section">
      <div className="cwgsyw-cmdb-instance-tab__head"><h2>{title}</h2></div>
      <div className="cwgsyw-cmdb-instance-tab__body">
        {hasContent ? <div className="cwgsyw-cmdb-instance-tab__rows">{children}</div> : emptyIcon ? (
          <div className="cwgsyw-cmdb-instance-tab__empty">
            <span className="cwgsyw-cmdb-instance-tab__empty-icon" aria-hidden="true">
              <Image
                src={emptyIcon.src}
                alt=""
                width={emptyIcon.width}
                height={emptyIcon.height}
                data-figma-node={emptyIcon.figmaNode}
                className="cwgsyw-cmdb-instance-tab__empty-icon-image"
              />
            </span>
            <EmptyState title={emptyMsg} showIcon={false} />
          </div>
        ) : <EmptyState title={emptyMsg} />}
      </div>
    </section>
  )
}
