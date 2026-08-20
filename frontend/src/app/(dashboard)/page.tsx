'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CmdbInstanceShareChart } from '@/components/cmdb/CmdbInstanceShareChart'
import { DashboardOpsCalendarCard } from '@/components/ops-calendar/DashboardOpsCalendarCard'
import { usePermission } from '@/hooks/usePermission'
import { listWorkItems, type WorkItem } from '@/lib/work-item-api'
import api from '@/lib/api'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DashboardFeedbackPage,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

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

const EMPTY_APPROVAL_ICON = '/figma-icons/home-clipboard-check.svg'

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

function HomeEmpty({
  iconSrc,
  figmaNode,
  title,
  description,
}: {
  iconSrc: string
  figmaNode: string
  title: string
  description: string
}) {
  return (
    <div className="cwgsyw-home__empty">
      {/* The exact 22px Figma SVG should be served directly; image optimization adds no value here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconSrc} width={22} height={22} alt="" data-figma-node={figmaNode} />
      <EmptyState showIcon={false} title={title} description={description} />
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const canReadWorkItems = hasPermission('work_item', 'read')
  const canReadAlerts = hasPermission('cmdb_alert', 'read')
  const canReadChangeDocs = hasPermission('change_doc', 'read')
  const canReadChanges = hasPermission('cmdb_change', 'read')
  const canCreateChangeDoc = hasPermission('change_doc', 'create')

  const approvalQuery = useQuery<WorkItem[]>({
    queryKey: ['work-items-dashboard'],
    queryFn: async () => (await listWorkItems({ tab: 'approve', page: 1, size: 6 })).records,
    enabled: isHydrated && canReadWorkItems,
  })
  const alertsQuery = useQuery<{ records: AlertVO[]; total: number }>({
    queryKey: ['cmdb-alerts-dashboard'],
    queryFn: () => api.get('/cmdb/alerts', { params: { page: 1, size: 5 } }).then((response) => response.data.data),
    enabled: isHydrated && canReadAlerts,
  })
  const docsQuery = useQuery<ChangeDocVO[]>({
    queryKey: ['change-docs-dashboard'],
    queryFn: async () => (await api.get('/change-docs')).data.data.records as ChangeDocVO[],
    enabled: isHydrated && canReadChangeDocs,
  })
  const changesQuery = useQuery<{ records: ChangeRecordVO[]; total: number }>({
    queryKey: ['cmdb-changes-dashboard'],
    queryFn: () => api.get('/cmdb/changes', { params: { page: 1, size: 6 } }).then((response) => response.data.data),
    enabled: isHydrated && canReadChanges,
  })

  const pendingTasks = approvalQuery.data ?? []
  const alerts = alertsQuery.data?.records ?? []
  const firingAlerts = alerts.filter((alert) => alert.status !== 'resolved')
  const docsList = Array.isArray(docsQuery.data) ? docsQuery.data : []
  const pendingDocs = docsList.filter((doc) => doc.status === 'pending')
  const metricsLoading = (
    (canReadWorkItems && approvalQuery.isLoading)
    || (canReadAlerts && alertsQuery.isLoading)
    || (canReadChangeDocs && docsQuery.isLoading)
    || (canReadChanges && changesQuery.isLoading)
  )
  const metricsError = (
    (canReadWorkItems && approvalQuery.isError)
    || (canReadAlerts && alertsQuery.isError)
    || (canReadChangeDocs && docsQuery.isError)
    || (canReadChanges && changesQuery.isError)
  )

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
      trendLabel: firingAlerts.some((alert) => alert.severity === 'critical') ? '含严重' : '监控中',
      tone: firingAlerts.some((alert) => alert.severity === 'critical') ? ('danger' as const) : ('success' as const),
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
      value: String(changesQuery.data?.total ?? 0),
      trendLabel: 'CMDB 审计',
      tone: 'neutral' as const,
      description: 'CI 实例的创建/更新/删除记录总数。',
      href: '/cmdb/changes',
      visible: canReadChanges,
    },
  ].filter((metric) => metric.visible)

  const quickLinks = [
    { title: 'CMDB 概览', description: '查看模型分类、实例浏览和近期 CI 动态。', href: '/cmdb', visible: hasPermission('cmdb_instance', 'read') },
    { title: '变更文档', description: '基于模板新建变更，补充影响分析、审批记录和回滚方案。', href: '/change-docs/new', visible: canCreateChangeDoc },
    { title: '我的工作', description: '集中处理待执行、待审批、我发起和已完成事项。', href: '/work?tab=approve', visible: canReadWorkItems },
    { title: '身份与权限', description: '管理用户、用户组、角色和权限矩阵，降低配置分散感。', href: '/users', visible: hasPermission('user', 'read') },
  ].filter((link) => link.visible)

  const header = (
    <PageHeader
      showEyebrow={false}
      showBreadcrumb={false}
      title="工作台"
      subtitle="集中处理审批、CMDB 风险、变更文档与近期变更。"
      actions={
        <div className="cwgsyw-home__actions">
          {canReadWorkItems ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => router.push('/work?tab=approve')}>
              查看全部待办
            </Button>
          ) : null}
          {canCreateChangeDoc ? (
            <Button type="button" size="sm" onClick={() => router.push('/change-docs/new')}>
              发起变更
            </Button>
          ) : null}
        </div>
      }
    />
  )

  if (!isHydrated) {
    return (
      <DashboardFeedbackPage className="cwgsyw-home" header={header} feedback={<LoadingState label="正在检查访问权限" />} />
    )
  }

  return (
    <DashboardFeedbackPage
      className="cwgsyw-home"
      header={header}
      metrics={
        metricsError ? (
          <ErrorState
            title="工作台指标加载失败"
            description="无法读取审批、告警或变更摘要，请稍后重试。"
            retry={<Button type="button" size="sm" variant="secondary" onClick={() => { void approvalQuery.refetch(); void alertsQuery.refetch(); void docsQuery.refetch(); void changesQuery.refetch() }}>重试</Button>}
          />
        ) : metricsLoading ? (
          <LoadingState label="加载工作台指标" />
        ) : metrics.length === 0 ? null : (
          metrics.map((metric) => (
            <Link key={metric.label} href={metric.href} className="cwgsyw-home__metric-link">
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
        )
      }
      feedback={
        <div className="cwgsyw-home__panels">
          <CmdbInstanceShareChart />
          <DashboardOpsCalendarCard />
          {canReadWorkItems ? (
            <section className="cwgsyw-home__panel" aria-labelledby="home-approvals-title">
              <header>
                <h2 id="home-approvals-title">待处理审批</h2>
                <Button type="button" size="sm" variant="secondary" onClick={() => router.push('/work?tab=approve')}>
                  查看全部
                </Button>
              </header>
              <div className="cwgsyw-home__panel-body">
                {approvalQuery.isLoading ? (
                  <LoadingState label="加载待处理审批" />
                ) : approvalQuery.isError ? (
                  <ErrorState
                    title="审批事项加载失败"
                    description="无法读取当前待处理审批。"
                    retry={<Button type="button" size="sm" variant="secondary" onClick={() => void approvalQuery.refetch()}>重试</Button>}
                  />
                ) : pendingTasks.length === 0 ? (
                  <HomeEmpty
                    iconSrc={EMPTY_APPROVAL_ICON}
                    figmaNode="6:24460"
                    title="暂无待处理任务"
                    description="当前没有分配给你的审批事项。"
                  />
                ) : (
                  <div className="cwgsyw-home__list">
                    {pendingTasks.slice(0, 6).map((item) => (
                      <Link key={item.itemId} href={item.href} className="cwgsyw-home__item">
                        <span className="cwgsyw-home__item-title">{item.title}</span>
                        <StatusBadge label="待处理" status="warning" />
                        <span className="cwgsyw-home__item-meta">{item.subtitle} · {item.dueAt ? timeAgo(item.dueAt) : '待处理'}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      }
      supporting={
        <section className="cwgsyw-home__panel" aria-labelledby="home-quick-links-title">
          <header>
            <h2 id="home-quick-links-title">常用业务入口</h2>
          </header>
          <div className="cwgsyw-home__panel-body">
            {quickLinks.length === 0 ? (
              <EmptyState showIcon={false} title="暂无可用入口" description="当前账号没有可显示的常用模块。" />
            ) : (
              <div className="cwgsyw-dashboard-link-list">
                {quickLinks.map((link) => (
                  <Link key={link.title} href={link.href} className="cwgsyw-dashboard-tile">
                    <span className="cwgsyw-dashboard-tile__copy">
                      <span className="cwgsyw-home__tile-title">{link.title}</span>
                      <span className="cwgsyw-home__tile-desc">{link.description}</span>
                    </span>
                    <span className="cwgsyw-home__tile-action">进入模块</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      }
    />
  )
}
