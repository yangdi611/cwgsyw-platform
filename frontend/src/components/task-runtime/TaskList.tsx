'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { OneOffTaskDialog } from '@/components/task-runtime/OneOffTaskDialog'
import { DataTable, FilterBar, PageHeader, Pagination, type ColumnDef } from '@/components/shared'
import { Button, Input, StatusBadge } from '@/components/design-system'
import { usePermission } from '@/hooks/usePermission'
import { listTasks, type TaskSummary } from '@/lib/task-runtime-api'

const EXECUTION_LABELS: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  submitted: '已提交',
  changes_requested: '待修改',
  completed: '已完成',
  cancelled: '已取消',
  exception_closed: '异常关闭',
}

export function TaskList() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const [createOpen, setCreateOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [scope, setScope] = useState<'my' | 'group'>('my')
  const [status, setStatus] = useState('all')
  const pageSize = 20
  const tasks = useQuery({
    queryKey: ['tasks', { page, keyword, scope, status }],
    queryFn: () => listTasks({
      page,
      size: pageSize,
      keyword: keyword || undefined,
      scope,
      executionStatus: status === 'all' ? undefined : status,
    }),
  })
  const columns: ColumnDef<TaskSummary>[] = [
    {
      key: 'title',
      title: '任务',
      render: (task) => <div><p className="font-semibold text-v2-fg">{task.title}</p><p className="mt-0.5 text-xs text-v2-muted">{task.templateName}</p></div>,
    },
    {
      key: 'status',
      title: '执行状态',
      render: (task) => <div className="flex flex-wrap gap-1"><StatusBadge status={task.executionStatus === 'completed' ? 'ok' : task.overdue ? 'danger' : task.executionStatus === 'changes_requested' ? 'warn' : 'neutral'}>{EXECUTION_LABELS[task.executionStatus]}</StatusBadge>{task.approvalStatus && <StatusBadge status="neutral">审批：{task.approvalStatus}</StatusBadge>}</div>,
    },
    {
      key: 'dueAt',
      title: '截止时间',
      render: (task) => <span className={task.overdue ? 'font-semibold text-v2-danger' : 'text-v2-muted'}>{task.dueAt ? new Date(task.dueAt).toLocaleString('zh-CN') : '-'}</span>,
    },
    {
      key: 'priority',
      title: '优先级',
      render: (task) => <StatusBadge status={task.priority === 'critical' ? 'danger' : task.priority === 'high' ? 'warn' : 'neutral'}>{task.priority}</StatusBadge>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="统一任务平台"
        title="我的任务"
        subtitle="执行一次性任务、日报、巡检和周期任务；所有表单、附件、提交与审批历史统一追溯。"
        actions={hasPermission('task', 'create') ? <Button variant="primary" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />一次性任务</Button> : undefined}
      />
      <FilterBar>
        <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-v2-muted" /><Input className="pl-9" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} placeholder="搜索任务名称或说明" /></div>
        <div className="flex gap-2">{(['my', 'group'] as const).map((item) => <button key={item} type="button" onClick={() => { setScope(item); setPage(1) }} className={`h-9 rounded-v2-md border px-3 text-sm ${scope === item ? 'border-v2-primary bg-v2-primary-soft text-v2-primary' : 'border-v2-border text-v2-muted'}`}>{item === 'my' ? '我的' : '我的组'}</button>)}</div>
        <select className="h-9 rounded-v2-md border border-v2-border bg-v2-surface px-3 text-sm text-v2-fg" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="all">全部状态</option>{Object.entries(EXECUTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </FilterBar>
      <DataTable
        data={tasks.data?.records ?? []}
        columns={columns}
        rowKey={(task) => task.id}
        loading={tasks.isLoading}
        onRowClick={(task) => router.push(`/tasks/${task.id}`)}
        empty={{ title: '暂无待执行任务', description: '任务计划生成或他人指派后会显示在这里。', action: <ClipboardCheck className="h-5 w-5" /> }}
      />
      <Pagination page={page} pageSize={pageSize} total={tasks.data?.total ?? 0} onPageChange={setPage} />
      <OneOffTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
