'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardOpsCalendarCard } from '@/components/ops-calendar/DashboardOpsCalendarCard'
import { usePermission } from '@/hooks/usePermission'
import { listWorkItems, type WorkItem } from '@/lib/work-item-api'
import api from '@/lib/api'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Card,
  DashboardFeedbackPage,
  EmptyState,
  MetricCard,
  PageHeader,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

async function safe<T>(p: Promise<{ data: { data: T } }>): Promise<T | undefined> {
  try {
    return (await p).data.data
  } catch {
    return undefined
  }
}

interface AlertVO {
  id: number
  severity: string
  status: string
  alertName: string
  ciInstanceName: string | null
  startsAt: string | null
  summary: string | null
}
interface ChangeDocVO {
  id: number
  changeNo: string
  status: string
  templateName: string
  applicantName: string
  createdAt: string
}
interface ChangeDocPageVO {
  records: ChangeDocVO[]
  total: number
}
interface ChangeRecordVO {
  id: number
  action: string
  summary: string | null
  operatorName: string | null
  createdAt: string
}

function timeAgo(iso: string): string {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

export default function DashboardPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const canReadWorkItems = hasPermission('work_item', 'read')
  const canReadAlerts = hasPermission('cmdb_alert', 'read')
  const canReadChangeDocs = hasPermission('change_doc', 'read')
  const canReadChanges = hasPermission('cmdb_change', 'read')

  const { data: approvalItems } = useQuery<WorkItem[] | undefined>({
    queryKey: ['work-items-dashboard'],
    queryFn: async () => (await listWorkItems({ tab: 'approve', page: 1, size: 6 })).records,
    enabled: canReadWorkItems,
  })
  const { data: alertsData } = useQuery<{ records: AlertVO[]; total: number } | undefined>({
    queryKey: ['cmdb-alerts-dashboard'],
    queryFn: () => safe(api.get('/cmdb/alerts', { params: { page: 1, size: 5 } })),
    enabled: canReadAlerts,
  })
  const { data: docs } = useQuery<ChangeDocVO[] | undefined>({
    queryKey: ['change-docs-dashboard'],
    queryFn: async () => (await safe<ChangeDocPageVO>(api.get('/change-docs')))?.records,
    enabled: canReadChangeDocs,
  })
  const { data: changesData } = useQuery<{ records: ChangeRecordVO[]; total: number } | undefined>({
    queryKey: ['cmdb-changes-dashboard'],
    queryFn: () => safe(api.get('/cmdb/changes', { params: { page: 1, size: 6 } })),
    enabled: canReadChanges,
  })

  const pendingTasks = approvalItems ?? []
  const alerts = alertsData?.records ?? []
  const firingAlerts = alerts.filter((a) => a.status !== 'resolved')
  const docsList = Array.isArray(docs) ? docs : []
  const pendingDocs = docsList.filter((d) => d.status === 'pending')

  const metrics = [
    {
      label: '待处理审批',
      value: String(pendingTasks.length),
      trendLabel: pendingTasks.length > 0 ? '待处理' : '已清空',
      tone: pendingTasks.length > 0 ? ('warning' as const) : ('success' as const),
      description: '统一任务平台分配给你的审批事项。',
      href: '/work?tab=approve',
      visible: canReadWorkItems,
    },
    {
      label: 'CMDB 告警',
      value: String(firingAlerts.length),
      trendLabel: firingAlerts.some((a) => a.severity === 'critical') ? '含严重' : '监控中',
      tone: firingAlerts.some((a) => a.severity === 'critical') ? ('danger' as const) : ('success' as const),
      description: 'Prometheus 同步的未恢复告警。',
      href: '/cmdb/alerts',
      visible: canReadAlerts,
    },
    {
      label: '变更文档',
      value: String(docsList.length),
      trendLabel: `${pendingDocs.length} 待审批`,
      tone: pendingDocs.length > 0 ? ('warning' as const) : ('success' as const),
      description: '全部变更申请单，含草稿与已归档。',
      href: '/change-docs',
      visible: canReadChangeDocs,
    },
    {
      label: '近期变更',
      value: String(changesData?.total ?? 0),
      trendLabel: 'CMDB 审计',
      tone: 'neutral' as const,
      description: 'CI 实例的创建/更新/删除记录总数。',
      href: '/cmdb/changes',
      visible: canReadChanges,
    },
  ].filter((metric) => metric.visible)

  const quickLinks = [
    { title: 'CMDB 概览', description: '查看模型分类、实例浏览和近期 CI 动态。', href: '/cmdb', visible: hasPermission('cmdb_instance', 'read') },
    { title: '变更文档', description: '基于模板新建变更，补充影响分析、审批记录和回滚方案。', href: '/change-docs/new', visible: hasPermission('change_doc', 'create') },
    { title: '我的工作', description: '集中处理待执行、待审批、我发起和已完成事项。', href: '/work?tab=approve', visible: canReadWorkItems },
    { title: '身份与权限', description: '管理用户、用户组、角色和权限矩阵，降低配置分散感。', href: '/users', visible: hasPermission('user', 'read') },
  ].filter((link) => link.visible)

  return (
    <DashboardFeedbackPage
      header={
        <PageHeader
          eyebrow="Operations Command Center"
          title="企业运维工作台"
          subtitle="集中处理审批、CMDB 风险、变更文档与近期变更；数据来自后端实时接口。"
          breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }]} />}
          actions={
            <div className="cwgsyw-inline-controls">
              {canReadWorkItems ? (
                <Button type="button" variant="secondary" onClick={() => router.push('/work?tab=approve')}>
                  查看全部待办
                </Button>
              ) : null}
              {hasPermission('change_doc', 'create') ? (
                <Button type="button" onClick={() => router.push('/change-docs/new')}>
                  发起变更
                </Button>
              ) : null}
            </div>
          }
        />
      }
      metrics={
        metrics.map((metric) => (
          <Link key={metric.label} href={metric.href}>
            <MetricCard
              label={metric.label}
              value={metric.value}
              description={metric.description}
              tone={metric.tone}
              trendLabel={metric.trendLabel}
              showTrend
            />
          </Link>
        ))
      }
      supporting={
        <div className="cwgsyw-stack-list">
          <DashboardOpsCalendarCard />
          {canReadWorkItems ? (
            <Card title="待处理审批" description="统一任务和审批中心分配给你的待办。">
              {pendingTasks.length === 0 ? (
                <EmptyState title="暂无待处理任务" />
              ) : (
                <div className="cwgsyw-stack-list">
                  {pendingTasks.slice(0, 6).map((t) => (
                    <Link key={t.itemId} href={t.href} className="cwgsyw-inline-controls">
                      <span className="cwgsyw-type-body-sm">{t.title}</span>
                      <StatusBadge label="待处理" status="warning" />
                      <span className="cwgsyw-type-label-sm">{t.subtitle} · {t.dueAt ? timeAgo(t.dueAt) : '待处理'}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          ) : null}
        </div>
      }
      feedback={
        <Card title="常用业务入口" description="企业用户日常最高频的任务入口。">
          <div className="cwgsyw-dashboard-link-list">
            {quickLinks.map((link) => (
              <Link key={link.title} href={link.href} className="cwgsyw-dashboard-tile">
                <span className="cwgsyw-dashboard-tile__copy">
                  <strong className="cwgsyw-type-title-sm">{link.title}</strong>
                  <span className="cwgsyw-type-body-sm">{link.description}</span>
                </span>
                <span className="cwgsyw-type-label-sm">进入模块</span>
              </Link>
            ))}
          </div>
        </Card>
      }
    />
  )
}
