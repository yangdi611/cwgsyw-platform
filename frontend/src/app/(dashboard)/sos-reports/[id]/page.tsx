'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/lib/api-error'
import { sosReportApi } from '@/lib/sos-report-api'
import { REPORT_STATUS, formatBytes, formatDateTime, isFinished } from '@/lib/sos-report-format'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Alert,
  Button,
  DataManagementPage,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  Tabs,
} from '@/design-system/figma-neutral/components'
import { FactsPanel } from './FactsPanel'
import { CmdbPanel } from './CmdbPanel'
import { ReportApprovalBanner } from '../PendingApprovals'

export default function SosReportDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const [tab, setTab] = useState('facts')
  // 首次打开时才加载入库面板；之后保持挂载，切换标签不丢失已填写的内容。
  const [cmdbOpened, setCmdbOpened] = useState(false)
  const id = params.id
  const canRead = hasPermission('sos_report', 'read')

  useEffect(() => {
    if (isHydrated && !canRead) router.replace('/')
  }, [isHydrated, canRead, router])

  const query = useQuery({
    queryKey: ['sos-report', id],
    queryFn: () => sosReportApi.detail(id),
    enabled: canRead,
    refetchInterval: (state) => (state.state.data && !isFinished(state.state.data.status) ? 3000 : false),
  })
  const report = query.data
  useBreadcrumbLabel(report?.hostname ?? report?.fileName)

  if (query.isLoading) return <LoadingState label="正在读取 SOS 报告" />
  if (query.isError || !report) {
    return (
      <ErrorState
        description={getApiErrorMessage(query.error, '无法加载 SOS 报告')}
        retry={<Button type="button" variant="secondary" size="sm" onClick={() => query.refetch()}>重试</Button>}
      />
    )
  }

  const status = REPORT_STATUS[report.status]
  return (
    <DataManagementPage
      embedded
      className="cwgsyw-sos-report"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title={report.hostname || report.fileName}
          subtitle={`${report.fileName} · ${formatBytes(report.fileSize)} · 上传于 ${formatDateTime(report.createdAt)}${report.createdByName ? `（${report.createdByName}）` : ''}`}
          status={<StatusBadge label={status.label} status={status.tone} />}
        />
      }
      content={
        <div className="cwgsyw-sos-report__stack">
          {report.status === 'failed' ? (
            <Alert tone="danger" showDismiss={false} title="解析失败" description={report.errorMessage ?? '无法解析这份报告'} />
          ) : null}
          {!isFinished(report.status) ? (
            <Alert tone="info" showDismiss={false} title="正在解析" description="解析在后台进行，完成后页面会自动刷新。" />
          ) : null}
          {report.status === 'parsed' ? (
            <>
              <ReportApprovalBanner reportId={report.id} />
              {(report.warnings ?? []).map((warning) => (
                <Alert key={warning} tone="warning" showDismiss={false} title="请注意" description={warning} />
              ))}
              <Tabs
                style="cmdb"
                size="sm"
                value={tab}
                onChange={(next) => {
                  setTab(next)
                  if (next === 'cmdb') setCmdbOpened(true)
                }}
                items={[
                  { id: 'facts', label: '结构化数据', panel: <FactsPanel report={report} /> },
                  { id: 'cmdb', label: 'CMDB 入库', panel: cmdbOpened ? <CmdbPanel reportId={id} /> : null },
                ]}
              />
            </>
          ) : null}
        </div>
      }
    />
  )
}
