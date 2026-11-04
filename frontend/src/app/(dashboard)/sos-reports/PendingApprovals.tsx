'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { sosReportApi, type SosPendingApproval } from '@/lib/sos-report-api'
import { aiFields, formatDateTime } from '@/lib/sos-report-format'
import { usePermission } from '@/hooks/usePermission'
import { Alert, Button, Card, Table } from '@/design-system/figma-neutral/components'
import { ApprovalDialog } from './ApprovalDialog'

/** 报告详情页的审批入口。通知里的链接落在详情页，审批人不用再回列表找。 */
export function ReportApprovalBanner({ reportId }: { reportId: number }) {
  const { hasPermission } = usePermission()
  const [reviewing, setReviewing] = useState<SosPendingApproval | null>(null)
  const query = useQuery({
    queryKey: ['sos-report-approvals'],
    queryFn: sosReportApi.approvals,
    enabled: hasPermission('sos_report', 'approve'),
  })
  const approvals = (query.data ?? []).filter((approval) => approval.reportId === reportId)
  if (approvals.length === 0) return null

  return (
    <>
      {approvals.map((approval) => (
        <Alert
          key={approval.requestId}
          tone="warning"
          showDismiss={false}
          title="这份报告有待你审批的入库申请"
          description={`实例“${approval.instanceName}”${aiFields(approval.fieldDetails).length > 0 ? `，其中 ${aiFields(approval.fieldDetails).length} 个字段的规则来自 AI 建议` : ''}。`}
          action={<Button type="button" size="sm" onClick={() => setReviewing(approval)}>审批</Button>}
        />
      ))}
      {reviewing ? <ApprovalDialog approval={reviewing} onClose={() => setReviewing(null)} /> : null}
    </>
  )
}

/** “待我审批”。系统没有通用的待办中心，所以放在 SOS 报告页。没有待办时不占位。 */
export function PendingApprovals() {
  const { hasPermission } = usePermission()
  const [reviewing, setReviewing] = useState<SosPendingApproval | null>(null)
  const query = useQuery({
    queryKey: ['sos-report-approvals'],
    queryFn: sosReportApi.approvals,
    enabled: hasPermission('sos_report', 'approve'),
  })
  const approvals = query.data ?? []
  if (approvals.length === 0) return null

  return (
    <>
      <Card title={`待我审批（${approvals.length}）`}>
        <Table
          className="cwgsyw-cmdb-table"
          density="compact"
          showSearch={false}
          columns={[
            { key: 'instanceName', label: '实例' },
            { key: 'action', label: '方式' },
            { key: 'ai', label: 'AI 参与' },
            { key: 'submitter', label: '提交人' },
            { key: 'createdAt', label: '提交时间' },
            { key: 'report', label: '报告' },
            { key: 'actions', label: <span className="cwgsyw-sr-only">操作</span>, align: 'right' },
          ]}
          rows={approvals.map((approval) => ({
            id: String(approval.requestId),
            cells: {
              instanceName: approval.instanceName,
              action: approval.action === 'create' ? '新增' : '更新',
              ai: aiFields(approval.fieldDetails).length > 0 ? `${aiFields(approval.fieldDetails).length} 个字段` : '无',
              submitter: approval.submitterName ?? '—',
              createdAt: formatDateTime(approval.createdAt),
              report: <Link href={`/sos-reports/${approval.reportId}`}>查看报告</Link>,
              actions: (
                <Button type="button" size="sm" aria-label={`审批 ${approval.instanceName}`} onClick={() => setReviewing(approval)}>
                  审批
                </Button>
              ),
            },
          }))}
          state="data"
        />
      </Card>
      {reviewing ? <ApprovalDialog approval={reviewing} onClose={() => setReviewing(null)} /> : null}
    </>
  )
}
