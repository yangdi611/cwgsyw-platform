'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/v2/Card'
import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { FilterBar, FilterChip } from '@/components/shared/FilterBar'
import { useState } from 'react'
import api from '@/lib/api'
import {
  ArrowRight,
  Database,
  FileText,
  CheckSquare,
  Shield,
} from 'lucide-react'

// 轻量 API 包装：失败时返回空，避免首页因单个接口故障白屏
async function safe<T>(p: Promise<{ data: { data: T } }>): Promise<T | undefined> {
  try {
    return (await p).data.data
  } catch {
    return undefined
  }
}

interface TaskVO {
  taskId: string
  taskName: string
  businessType: string
  createTime: string
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

function actionLabel(a: string): string {
  if (a?.includes('create')) return '创建'
  if (a?.includes('delete')) return '删除'
  if (a?.includes('update')) return '更新'
  return a || '操作'
}

export default function DashboardPage() {
  const [filter, setFilter] = useState('all')

  const { data: tasks } = useQuery<TaskVO[] | undefined>({
    queryKey: ['workflow-tasks'],
    queryFn: () => safe(api.get('/workflow/tasks/group')),
  })
  const { data: alertsData } = useQuery<{ records: AlertVO[]; total: number } | undefined>({
    queryKey: ['cmdb-alerts-dashboard'],
    queryFn: () => safe(api.get('/cmdb/alerts', { params: { page: 1, size: 5 } })),
  })
  const { data: docs } = useQuery<ChangeDocVO[] | undefined>({
    queryKey: ['change-docs-dashboard'],
    queryFn: () => safe(api.get('/change-docs')),
  })
  const { data: changesData } = useQuery<{ records: ChangeRecordVO[]; total: number } | undefined>({
    queryKey: ['cmdb-changes-dashboard'],
    queryFn: () => safe(api.get('/cmdb/changes', { params: { page: 1, size: 6 } })),
  })

  const pendingTasks = tasks ?? []
  const alerts = alertsData?.records ?? []
  const firingAlerts = alerts.filter((a) => a.status !== 'resolved')
  const docsList = docs ?? []
  const pendingDocs = docsList.filter((d) => d.status === 'pending')
  const recentChanges = changesData?.records ?? []

  const metrics = [
    {
      label: '待处理审批',
      value: pendingTasks.length,
      trend: pendingTasks.length > 0 ? '待处理' : '已清空',
      trendType: pendingTasks.length > 0 ? ('warn' as const) : ('ok' as const),
      description: '流程中心分配给你的审批任务。',
      href: '/workflow/tasks',
    },
    {
      label: 'CMDB 告警',
      value: firingAlerts.length,
      trend: firingAlerts.some((a) => a.severity === 'critical') ? '含严重' : '监控中',
      trendType: firingAlerts.some((a) => a.severity === 'critical')
        ? ('danger' as const)
        : ('ok' as const),
      description: 'Prometheus 同步的未恢复告警。',
      href: '/cmdb/alerts',
    },
    {
      label: '变更文档',
      value: docsList.length,
      trend: `${pendingDocs.length} 待审批`,
      trendType: pendingDocs.length > 0 ? ('warn' as const) : ('ok' as const),
      description: '全部变更申请单，含草稿与已归档。',
      href: '/change-docs',
    },
    {
      label: '近期变更',
      value: changesData?.total ?? 0,
      trend: 'CMDB 审计',
      trendType: 'neutral' as const,
      description: 'CI 实例的创建/更新/删除记录总数。',
      href: '/cmdb/changes',
    },
  ]

  const quickLinks = [
    {
      title: 'CMDB 实例管理',
      description: '查询、筛选、维护实例，并从详情抽屉查看拓扑、告警和变更历史。',
      icon: Database,
      href: '/cmdb/instances',
    },
    {
      title: '变更文档',
      description: '基于模板新建变更，补充影响分析、审批记录和回滚方案。',
      icon: FileText,
      href: '/change-docs/new',
    },
    {
      title: '流程任务',
      description: '集中处理审批、转派、驳回、评论和流程实例追踪。',
      icon: CheckSquare,
      href: '/workflow/tasks',
    },
    {
      title: '身份与权限',
      description: '管理用户、用户组、角色和权限矩阵，降低配置分散感。',
      icon: Shield,
      href: '/users',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations Command Center"
        title="企业运维工作台"
        subtitle="集中处理审批、CMDB 风险、变更文档与近期变更；数据来自后端实时接口。"
        actions={
          <>
            <Button variant="secondary" onClick={() => (window.location.href = '/workflow/tasks')}>
              查看全部待办
            </Button>
            <Button variant="primary" onClick={() => (window.location.href = '/change-docs/new')}>
              发起变更
            </Button>
          </>
        }
      />

      {/* 关键指标 */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href}>
            <Card hover className="h-full cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-v2-muted">{metric.label}</span>
                  <StatusBadge status={metric.trendType}>{metric.trend}</StatusBadge>
                </div>
                <div className="text-3xl font-bold text-v2-fg font-v2-mono mb-2">
                  {metric.value}
                </div>
                <p className="text-xs text-v2-muted leading-relaxed">{metric.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {/* 主工作区：近期变更 + 我的任务 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_0.55fr] gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>近期 CMDB 变更</CardTitle>
                <p className="text-sm text-v2-muted mt-1">实例的创建、更新、删除审计记录。</p>
              </div>
              <FilterBar>
                <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
                  全部
                </FilterChip>
                <FilterChip active={filter === 'create'} onClick={() => setFilter('create')}>
                  创建
                </FilterChip>
                <FilterChip active={filter === 'update'} onClick={() => setFilter('update')}>
                  更新
                </FilterChip>
                <FilterChip active={filter === 'delete'} onClick={() => setFilter('delete')}>
                  删除
                </FilterChip>
              </FilterBar>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            {recentChanges.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-v2-muted">暂无变更记录</p>
            ) : (
              <table className="w-full">
                <thead className="bg-v2-surface-soft">
                  <tr>
                    {['动作', '摘要', '操作人', '时间', '操作'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-bold text-v2-muted uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentChanges
                    .filter((c) => filter === 'all' || c.action?.includes(filter))
                    .map((c) => {
                      const isCreate = c.action?.includes('create')
                      const isDelete = c.action?.includes('delete')
                      const variant = isCreate ? 'ok' : isDelete ? 'danger' : 'warn'
                      return (
                        <tr
                          key={c.id}
                          className="border-b border-v2-border hover:bg-v2-surface-hover transition-colors"
                        >
                          <td className="px-4 py-3">
                            <StatusBadge status={variant as 'ok' | 'warn' | 'danger'}>
                              {actionLabel(c.action)}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-3 text-sm text-v2-fg max-w-xs truncate">
                            {c.summary || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-v2-fg">{c.operatorName || '系统'}</td>
                          <td className="px-4 py-3 text-sm text-v2-muted whitespace-nowrap">
                            {timeAgo(c.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href="/cmdb/changes"
                              className="text-sm font-bold text-v2-primary hover:text-v2-primary-hover"
                            >
                              查看
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* 待办任务面板 */}
        <Card>
          <CardHeader>
            <CardTitle>待处理审批</CardTitle>
            <p className="text-sm text-v2-muted mt-1">来自流程中心的待办任务。</p>
          </CardHeader>
          <div className="divide-y divide-v2-border">
            {pendingTasks.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-v2-muted">暂无待处理任务</p>
            ) : (
              pendingTasks.slice(0, 6).map((t) => (
                <Link
                  key={t.taskId}
                  href="/workflow/tasks"
                  className="block px-6 py-4 hover:bg-v2-surface-hover transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="text-sm font-bold text-v2-fg leading-snug">{t.taskName}</div>
                    <StatusBadge status="warn">待处理</StatusBadge>
                  </div>
                  <div className="text-xs text-v2-muted">
                    {t.businessType} · {timeAgo(t.createTime)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* 常用业务入口 */}
      <Card>
        <CardHeader>
          <CardTitle>常用业务入口</CardTitle>
          <p className="text-sm text-v2-muted mt-1">企业用户日常最高频的任务入口。</p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.title}
                href={link.href}
                className="group p-4 rounded-v2-md border border-v2-border bg-v2-surface hover:border-v2-primary-border hover:shadow-v2-md transition-all"
              >
                <link.icon className="h-5 w-5 text-v2-primary mb-2" />
                <div className="text-sm font-bold text-v2-fg mb-1">{link.title}</div>
                <p className="text-xs text-v2-muted leading-relaxed mb-3">{link.description}</p>
                <div className="text-xs font-bold text-v2-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                  进入模块 <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
