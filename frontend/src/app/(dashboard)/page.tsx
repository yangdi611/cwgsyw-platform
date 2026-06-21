'use client'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/v2/Card'
import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { FilterBar, FilterChip } from '@/components/shared/FilterBar'
import { useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle,
  FileText,
  CheckSquare,
  Activity,
  Database,
  Server,
  Shield,
  Settings,
} from 'lucide-react'

// 模拟数据 - 实际应从 API 获取
const metrics = [
  {
    label: '待处理审批',
    value: 18,
    trend: '+5 超时',
    trendType: 'warn' as const,
    description: '流程中心、变更文档和日报审批合计。',
    href: '/workflow/tasks',
  },
  {
    label: 'CMDB 告警',
    value: 7,
    trend: '2 高危',
    trendType: 'danger' as const,
    description: '包含模型缺失、关系异常和影响链路风险。',
    href: '/cmdb/alerts',
  },
  {
    label: '本周变更文档',
    value: 42,
    trend: '76% 完成',
    trendType: 'ok' as const,
    description: '16 项需要补充影响分析或回滚方案。',
    href: '/change-docs',
  },
  {
    label: '资源健康度',
    value: '94%',
    trend: '稳定',
    trendType: 'ok' as const,
    description: '设备凭证、IP 占用、文件关联完整性。',
    href: '/reports',
  },
]

const recentItems = [
  {
    id: 1,
    name: '核心数据库实例依赖变更',
    code: 'CI-DB-PRD-0821',
    type: 'CMDB 影响分析',
    owner: '运维组',
    status: 'danger' as const,
    statusLabel: '高风险',
    time: '10 分钟前',
    href: '/cmdb/instances/by-model/host/821',
  },
  {
    id: 2,
    name: '生产网络设备密码轮换',
    code: 'DEV-NET-0094',
    type: '设备密码库',
    owner: '安全组',
    status: 'warn' as const,
    statusLabel: '待审批',
    time: '36 分钟前',
    href: '/devices/94',
  },
  {
    id: 3,
    name: '应用发布流程模板更新',
    code: 'TPL-CHANGE-014',
    type: '变更模板',
    owner: '平台组',
    status: 'ok' as const,
    statusLabel: '已更新',
    time: '2 小时前',
    href: '/admin/change-doc-templates/14',
  },
  {
    id: 4,
    name: 'IP 地址池冲突确认',
    code: 'IPAM-10.24.16.0/24',
    type: '资源管理',
    owner: '网络组',
    status: 'warn' as const,
    statusLabel: '需确认',
    time: '3 小时前',
    href: '/ipam/1',
  },
]

const myTasks = [
  {
    id: 1,
    title: '审批：应用发布变更单',
    description: '流程中心 · SLA 剩余 3 小时 · 关联 6 个 CI',
    status: 'warn' as const,
    statusLabel: '待处理',
    progress: 72,
    href: '/workflow/tasks',
  },
  {
    id: 2,
    title: '补充：CI 关联关系说明',
    description: 'CMDB · 影响分析缺失 · 生产环境',
    status: 'danger' as const,
    statusLabel: '高优先级',
    progress: 88,
    href: '/cmdb/instances',
  },
  {
    id: 3,
    title: '确认：IP 地址池冲突处理',
    description: '资源管理 · 2 个冲突段 · 网络组',
    status: 'neutral' as const,
    statusLabel: '待确认',
    progress: 42,
    href: '/ipam',
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

export default function DashboardPage() {
  const [filter, setFilter] = useState('all')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations Command Center"
        title="企业运维工作台"
        subtitle="面向企业用户的统一入口：集中处理审批、CMDB 风险、变更文档、资源状态和系统通知；桌面端充分利用宽度，移动端保留核心任务闭环。"
        actions={
          <>
            <Button variant="secondary">查看全部待办</Button>
            <Button variant="primary">发起流程</Button>
          </>
        }
      />

      {/* 关键指标 */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href}>
            <Card
              hover
              className="h-full cursor-pointer"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-v2-muted">{metric.label}</span>
                  <StatusBadge status={metric.trendType}>{metric.trend}</StatusBadge>
                </div>
                <div className="text-3xl font-bold text-v2-fg font-v2-mono mb-2">
                  {metric.value}
                </div>
                <p className="text-xs text-v2-muted leading-relaxed">
                  {metric.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {/* 主工作区：近期关键事项 + 我的任务 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_0.55fr] gap-4">
        {/* 近期关键事项表格 */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>近期关键事项</CardTitle>
                <p className="text-sm text-v2-muted mt-1">
                  优先展示需要企业用户立即判断或处理的事项。
                </p>
              </div>
              <FilterBar>
                <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
                  全部
                </FilterChip>
                <FilterChip active={filter === 'high'} onClick={() => setFilter('high')}>
                  高风险
                </FilterChip>
                <FilterChip active={filter === 'approval'} onClick={() => setFilter('approval')}>
                  待审批
                </FilterChip>
                <FilterChip active={filter === 'cmdb'} onClick={() => setFilter('cmdb')}>
                  CMDB
                </FilterChip>
              </FilterBar>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-v2-surface-soft">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-v2-muted uppercase tracking-wider">
                    对象
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-v2-muted uppercase tracking-wider">
                    类型
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-v2-muted uppercase tracking-wider">
                    负责人
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-v2-muted uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-v2-muted uppercase tracking-wider">
                    更新时间
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-v2-muted uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-v2-border hover:bg-v2-surface-hover transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-v2-fg">{item.name}</div>
                        <div className="text-xs text-v2-muted font-v2-mono mt-0.5">{item.code}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-v2-fg">{item.type}</td>
                    <td className="px-4 py-3 text-sm text-v2-fg">{item.owner}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status}>{item.statusLabel}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-sm text-v2-muted">{item.time}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={item.href}
                        className="text-sm font-bold text-v2-primary hover:text-v2-primary-hover"
                      >
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 我的任务面板 */}
        <Card>
          <CardHeader>
            <CardTitle>我的任务</CardTitle>
            <p className="text-sm text-v2-muted mt-1">按 SLA 和业务影响排序。</p>
          </CardHeader>
          <div className="divide-y divide-v2-border">
            {myTasks.map((task) => (
              <Link
                key={task.id}
                href={task.href}
                className="block px-6 py-4 hover:bg-v2-surface-hover transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-v2-fg leading-snug mb-1">
                      {task.title}
                    </div>
                    <div className="text-xs text-v2-muted leading-relaxed">
                      {task.description}
                    </div>
                  </div>
                  <StatusBadge status={task.status} className="shrink-0">
                    {task.statusLabel}
                  </StatusBadge>
                </div>
                {/* Progress Bar */}
                <div className="h-1.5 rounded-full bg-v2-surface-soft overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-v2-primary to-teal-500"
                    style={{ width: `${task.progress}%` }}
                    aria-label={`SLA 剩余进度 ${task.progress}%`}
                  />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* 常用业务入口 */}
      <Card>
        <CardHeader>
          <CardTitle>常用业务入口</CardTitle>
          <p className="text-sm text-v2-muted mt-1">
            不是装饰卡片，而是企业用户日常最高频的任务入口。
          </p>
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
                <p className="text-xs text-v2-muted leading-relaxed mb-3">
                  {link.description}
                </p>
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
