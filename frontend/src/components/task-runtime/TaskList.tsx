'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { OneOffTaskDialog } from '@/components/task-runtime/OneOffTaskDialog'
import { usePermission } from '@/hooks/usePermission'
import { listTasks } from '@/lib/task-runtime-api'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Chip,
  DataManagementPage,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  Table,
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
        header={
          <PageHeader
            eyebrow="统一任务平台"
            title="我的任务"
            subtitle="执行一次性任务、日报、巡检和周期任务；所有表单、附件、提交与审批历史统一追溯。"
            breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: '我的任务' }]} />}
            actions={
              hasPermission('task', 'create') ? (
                <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
                  一次性任务
                </Button>
              ) : null
            }
          />
        }
        filter={
          <FilterBar
            search={
              <SearchInput
                value={keyword}
                placeholder="搜索任务名称或说明"
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setPage(1)
                }}
              />
            }
            filterItems={
              <div className="cwgsyw-inline-controls">
                <Chip label="我的" selected={scope === 'my'} onClick={() => { setScope('my'); setPage(1) }} />
                <Chip label="我的组" selected={scope === 'group'} onClick={() => { setScope('group'); setPage(1) }} />
                <Select
                  value={status}
                  options={[{ value: 'all', label: '全部状态' }, ...Object.entries(EXECUTION_LABELS).map(([value, label]) => ({ value, label }))]}
                  onChange={(value) => {
                    setStatus(value)
                    setPage(1)
                  }}
                />
              </div>
            }
          />
        }
        content={
          <>
            {tasks.isError ? (
              <ErrorState
                title="任务加载失败"
                description="无法读取任务列表，请重试。"
                retry={
                  <Button type="button" variant="secondary" onClick={() => void tasks.refetch()}>
                    重试
                  </Button>
                }
              />
            ) : (
            <Table
              showSearch={false}
              columns={[
                { key: 'title', label: '任务' },
                { key: 'status', label: '执行状态' },
                { key: 'dueAt', label: '截止时间' },
                { key: 'priority', label: '优先级' },
              ]}
              rows={records.map((task) => ({
                id: String(task.id),
                cells: {
                  title: (
                    <div>
                      <strong>{task.title}</strong>
                      <p className="cwgsyw-type-body-sm">{task.templateName}</p>
                    </div>
                  ),
                  status: (
                    <div className="cwgsyw-inline-controls">
                      <StatusBadge
                        label={EXECUTION_LABELS[task.executionStatus] ?? task.executionStatus}
                        status={task.executionStatus === 'completed' ? 'success' : task.overdue ? 'danger' : task.executionStatus === 'changes_requested' ? 'warning' : 'neutral'}
                      />
                      {task.approvalStatus ? <StatusBadge label={`审批：${task.approvalStatus}`} status="neutral" /> : null}
                    </div>
                  ),
                  dueAt: task.dueAt ? new Date(task.dueAt).toLocaleString('zh-CN') : '-',
                  priority: (
                    <StatusBadge
                      label={task.priority}
                      status={task.priority === 'critical' ? 'danger' : task.priority === 'high' ? 'warning' : 'neutral'}
                    />
                  ),
                },
              }))}
              state={tasks.isLoading ? 'loading' : records.length === 0 ? 'empty' : 'data'}
              empty={<EmptyState title="暂无待执行任务" description="任务计划生成或他人指派后会显示在这里。" showAction={false} />}
              onRowClick={(id) => router.push(`/tasks/${id}`)}
            />
            )}
            <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={setPage} />
          </>
        }
      />
      <OneOffTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
