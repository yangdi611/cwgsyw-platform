'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { OneOffTaskDialog } from '@/components/task-runtime/OneOffTaskDialog'
import {
  TaskEmpty,
  TASK_CLIPBOARD_LIST_ICON,
  TASK_CLIPBOARD_LIST_NODE,
} from '@/components/task-runtime/TaskEmpty'
import { usePermission } from '@/hooks/usePermission'
import { listTasks } from '@/lib/task-runtime-api'
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import {
  Button,
  DataManagementPage,
  ErrorState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  Table,
  Tabs,
} from '@/design-system/figma-neutral/components'

const EXECUTION_LABELS: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  submitted: '已提交',
  changes_requested: '待修改',
  completed: '已完成',
  cancelled: '已取消',
  exception_closed: '异常关闭',
}

const APPROVAL_LABELS: Record<string, string> = {
  not_required: '无需审批',
  not_started: '未开始',
  in_review: '审批中',
  approved: '已通过',
  changes_requested: '待修改',
  terminated: '已终止',
  failed: '失败',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  critical: '紧急',
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
    queryFn: () =>
      listTasks({
        page,
        size: pageSize,
        keyword: keyword || undefined,
        scope,
        executionStatus: status === 'all' ? undefined : status,
      }),
  })
  const records = tasks.data?.records ?? []
  const total = tasks.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-tasks-page"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="任务列表"
            subtitle="执行一次性任务、日报、巡检和周期任务；所有表单、附件、提交与审批历史统一追溯。"
            actions={
              hasPermission('task', 'create') ? (
                <Button type="button" size="sm" variant="primary" onClick={() => setCreateOpen(true)}>
                  一次性任务
                </Button>
              ) : null
            }
          />
        }
        filter={
          <div className="cwgsyw-tasks-toolbar cwgsyw-tasks-toolbar--split">
            <SearchInput
              size="sm"
              value={keyword}
              placeholder="搜索任务名称..."
              onChange={(event) => {
                setKeyword(event.target.value)
                setPage(1)
              }}
            />
            <Select
              className="cwgsyw-tasks-status-select"
              size="sm"
              overlay
              aria-label="按执行状态筛选"
              value={status}
              options={[{ value: 'all', label: '全部状态' }, ...Object.entries(EXECUTION_LABELS).map(([value, label]) => ({ value, label }))]}
              onChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
            />
            <Tabs
              style="cmdb"
              size="sm"
              value={scope}
              onChange={(id) => {
                setScope(id as 'my' | 'group')
                setPage(1)
              }}
              items={[
                { id: 'my', label: '我的', panel: null },
                { id: 'group', label: '我的组', panel: null },
              ]}
            />
          </div>
        }
        content={
          <>
            {tasks.isError ? (
              <ErrorState
                title="任务加载失败"
                description="无法读取任务列表，请重试。"
                retry={
                  <Button type="button" size="sm" variant="secondary" onClick={() => void tasks.refetch()}>
                    重试
                  </Button>
                }
              />
            ) : (
            <div className="cwgsyw-cmdb-table">
            <Table
              showSearch={false}
              density="compact"
              columns={[
                { key: 'title', label: '任务' },
                { key: 'template', label: '模板' },
                { key: 'status', label: '执行状态' },
                { key: 'dueAt', label: '截止时间' },
                { key: 'priority', label: '优先级' },
              ]}
              rows={records.map((task) => ({
                id: String(task.id),
                cells: {
                  title: task.title,
                  template: task.templateName || '-',
                  status: (
                    <div className="cwgsyw-inline-controls">
                      <StatusBadge
                        label={EXECUTION_LABELS[task.executionStatus] ?? task.executionStatus}
                        status={task.executionStatus === 'completed' ? 'success' : task.overdue ? 'danger' : task.executionStatus === 'changes_requested' ? 'warning' : 'neutral'}
                      />
                      {task.approvalStatus && task.approvalStatus !== 'not_required' ? (
                        <StatusBadge label={APPROVAL_LABELS[task.approvalStatus] ?? task.approvalStatus} status="neutral" />
                      ) : null}
                    </div>
                  ),
                  dueAt: task.dueAt ? new Date(task.dueAt).toLocaleString('zh-CN') : '-',
                  priority: PRIORITY_LABELS[task.priority] ?? task.priority,
                },
              }))}
              state={tasks.isLoading ? 'loading' : records.length === 0 ? 'empty' : 'data'}
              empty={
                <TaskEmpty
                  iconSrc={TASK_CLIPBOARD_LIST_ICON}
                  figmaNode={TASK_CLIPBOARD_LIST_NODE}
                  title="暂无待执行任务"
                  description="任务计划生成或他人指派后会显示在这里。"
                />
              }
              onRowClick={(id) => router.push(`/tasks/${id}`)}
            />
            </div>
            )}
            <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={setPage} />
          </>
        }
      />
      <OneOffTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
