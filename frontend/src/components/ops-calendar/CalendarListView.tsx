'use client'

import { DataTable, type ColumnDef } from '@/components/shared'
import { TaskStatusBadge, TaskTypeBadge } from './TaskBadges'
import { type TaskVO, fmtTime } from '@/lib/opsCalendar'

interface Props {
  tasks: TaskVO[]
  loading: boolean
  onTaskClick: (taskId: number) => void
}

export function CalendarListView({ tasks, loading, onTaskClick }: Props) {
  const columns: ColumnDef<TaskVO>[] = [
    {
      key: 'title', title: '任务名称',
      render: (r) => <span className="font-semibold text-v2-fg">{r.title}</span>,
    },
    { key: 'taskType', title: '类型', render: (r) => <TaskTypeBadge taskType={r.taskType} /> },
    {
      key: 'plannedStartAt', title: '计划时间',
      render: (r) => <span className="font-v2-mono text-xs text-v2-fg">{fmtTime(r.plannedStartAt)}</span>,
    },
    {
      key: 'dueAt', title: '截止时间',
      render: (r) => <span className="font-v2-mono text-xs text-v2-fg">{fmtTime(r.dueAt)}</span>,
    },
    {
      key: 'assigneeName', title: '负责人',
      render: (r) => r.assigneeName
        ? <span className="text-sm text-v2-fg">{r.assigneeName}</span>
        : <span className="text-v2-subtle">-</span>,
    },
    { key: 'status', title: '状态', render: (r) => <TaskStatusBadge status={r.status} /> },
    {
      key: 'sourceType', title: '来源',
      render: (r) => <span className="text-xs text-v2-muted">{sourceLabel(r.sourceType)}</span>,
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={tasks}
      rowKey={(r) => r.id}
      loading={loading}
      onRowClick={(r) => onTaskClick(r.id)}
      empty={{ title: '暂无任务', description: '当前筛选范围内没有运维日历任务' }}
    />
  )
}

function sourceLabel(s: string): string {
  return { manual: '手动创建', rule: '周期规则', holiday: '节假日', roster: '排班', system: '系统' }[s] ?? s
}
