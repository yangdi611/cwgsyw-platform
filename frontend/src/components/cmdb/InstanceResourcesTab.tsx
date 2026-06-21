'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import Link from 'next/link'
import { Server, FileText, Calendar, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

/* ------ Types ------ */

interface DeviceVO {
  deviceId: number
  name: string
  ipAddr: string
  credentialType: string
}

interface ChangeDocVO {
  docId: number
  title: string
  status: string
  updatedAt: string
}

interface DailyReportVO {
  reportId: number
  date: string
  authorName: string
}

/* ------ Component ------ */

export function InstanceResourcesTab({ instanceId }: { instanceId: string }) {
  const devices = useQuery<DeviceVO[]>({
    queryKey: ['cmdb-instance-devices', instanceId],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}/devices`).then(r => r.data.data),
  })

  const changeDocs = useQuery<ChangeDocVO[]>({
    queryKey: ['cmdb-instance-changedocs', instanceId],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}/change-docs`).then(r => r.data.data),
  })

  const dailyReports = useQuery<DailyReportVO[]>({
    queryKey: ['cmdb-instance-dailyreports', instanceId],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}/daily-reports`).then(r => r.data.data),
  })

  const isLoading = devices.isLoading || changeDocs.isLoading || dailyReports.isLoading

  if (isLoading) {
    return <p className="text-sm text-v2-muted">加载中...</p>
  }

  return (
    <div className="space-y-8">
      {/* 关联设备凭证 */}
      <Section icon={<Server className="h-4 w-4" />} title="关联设备凭证" emptyMsg="暂无关联设备凭证">
        {devices.data?.map(d => (
          <div key={d.deviceId} className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <Server className="h-4 w-4 text-v2-muted shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{d.name}</p>
                <p className="text-xs text-v2-muted">{d.ipAddr}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs">{d.credentialType}</Badge>
              <Link
                href={`/devices/${d.deviceId}`}
                className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
              >
                查看 <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ))}
      </Section>

      {/* 关联变更文档 */}
      <Section icon={<FileText className="h-4 w-4" />} title="关联变更文档" emptyMsg="暂无关联变更文档">
        {changeDocs.data?.map(d => (
          <div key={d.docId} className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-4 w-4 text-v2-muted shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{d.title}</p>
                <p className="text-xs text-v2-muted">{new Date(d.updatedAt).toLocaleString('zh-CN')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs">{d.status}</Badge>
              <Link
                href={`/change-docs/${d.docId}`}
                className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
              >
                查看 <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ))}
      </Section>

      {/* 关联运维日报 */}
      <Section icon={<Calendar className="h-4 w-4" />} title="关联运维日报" emptyMsg="暂无关联运维日报">
        {dailyReports.data?.map(d => (
          <div key={d.reportId} className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-v2-muted shrink-0" />
              <div>
                <p className="text-sm font-medium">{d.date}</p>
                <p className="text-xs text-v2-muted">{d.authorName}</p>
              </div>
            </div>
            <Link
              href={`/daily-reports/${d.reportId}`}
              className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
            >
              查看 <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        ))}
      </Section>
    </div>
  )
}

/* ------ Section sub-component ------ */

function Section({
  icon, title, emptyMsg, children,
}: {
  icon: React.ReactNode
  title: string
  emptyMsg: string
  children: React.ReactNode
}) {
  const items = Array.isArray(children) ? children : []
  const hasContent = items.some(Boolean)

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="border rounded-lg divide-y">
        {hasContent ? children : (
          <p className="text-sm text-v2-muted text-center py-6">{emptyMsg}</p>
        )}
      </div>
    </div>
  )
}
