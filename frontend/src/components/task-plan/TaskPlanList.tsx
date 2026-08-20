'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from '@/design-system/figma-neutral/toast'
import { usePermission } from '@/hooks/usePermission'
import { changeTaskPlanStatus, listTaskPlans, type TaskPlanStatus } from '@/lib/task-plan-api'
import {
  TaskEmpty,
  TASK_CALENDAR_CLOCK_ICON,
  TASK_CALENDAR_CLOCK_NODE,
} from '@/components/task-runtime/TaskEmpty'
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import {
  Button,
  DataManagementPage,
  ErrorState,
  IconButton,
  NeutralTooltip,
  PageHeader,
  SearchInput,
  StatusBadge,
  Table,
  Tabs,
} from '@/design-system/figma-neutral/components'

const STATUS_LABELS: Record<TaskPlanStatus, string> = {
  draft: '草稿',
  active: '运行中',
  paused: '已暂停',
  finished: '已结束',
  archived: '已归档',
}

const STATUS_TONES: Record<TaskPlanStatus, 'success' | 'warning' | 'neutral'> = {
  draft: 'warning',
  active: 'success',
  paused: 'warning',
  finished: 'neutral',
  archived: 'neutral',
}

const SCHEDULE_LABELS: Record<string, string> = {
  once: '一次性',
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  quarterly: '每季度',
  semiannual: '每半年',
  yearly: '每年',
  cron: '自定义周期',
  holiday_relative: '节假日相对',
}

const FILTERS: Array<'all' | TaskPlanStatus> = ['all', 'draft', 'active', 'paused', 'finished', 'archived']

export function TaskPlanList() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'all' | TaskPlanStatus>('all')
  const plans = useQuery({
    queryKey: ['task-plans', keyword, status],
    queryFn: () => listTaskPlans({ keyword: keyword || undefined, status: status === 'all' ? undefined : status, size: 100 }),
  })
  const statusMutation = useMutation({
    mutationFn: ({ planId, action }: { planId: number; action: 'activate' | 'pause' }) => changeTaskPlanStatus(planId, action),
    onSuccess: async (_, variables) => {
      toast.success(variables.action === 'activate' ? '计划已激活' : '计划已暂停')
      await queryClient.invalidateQueries({ queryKey: ['task-plans'] })
    },
    onError: () => toast.error('计划状态更新失败'),
  })
  const records = plans.data?.records ?? []

  return (
    <DataManagementPage
      embedded
      className="cwgsyw-tasks-page"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title="任务计划"
          subtitle="将已发布模板配置为一次性或周期任务，并统一分配执行人、CI 范围、提醒与审批。"
          actions={
            hasPermission('task_plan', 'create') ? (
              <Button type="button" size="sm" variant="primary" onClick={() => router.push('/tasks/plans/new')}>
                新建计划
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
            placeholder="搜索计划名称..."
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Tabs
            style="cmdb"
            size="sm"
            value={status}
            onChange={(id) => setStatus(id as 'all' | TaskPlanStatus)}
            items={FILTERS.map((item) => ({
              id: item,
              label: item === 'all' ? '全部' : STATUS_LABELS[item],
              panel: null,
            }))}
          />
        </div>
      }
      content={
        plans.isError ? (
          <ErrorState
            title="计划加载失败"
            description="无法读取任务计划，请重试。"
            retry={<Button type="button" size="sm" variant="secondary" onClick={() => void plans.refetch()}>重试</Button>}
          />
        ) : (
          <div className="cwgsyw-cmdb-table cwgsyw-tasks-plans-table">
          <Table
            showSearch={false}
            density="compact"
            columns={[
              { key: 'name', label: '计划' },
              { key: 'template', label: '模板' },
              { key: 'status', label: '状态' },
              { key: 'schedule', label: '周期' },
              { key: 'next', label: '下次扫描' },
              { key: 'actions', label: '', align: 'right' },
            ]}
            rows={records.map((plan) => ({
              id: String(plan.id),
              cells: {
                name: <p className="cwgsyw-tasks-cell-title">{plan.name}</p>,
                template: plan.templateName || `模板版本 #${plan.templateVersionId}`,
                status: <StatusBadge label={STATUS_LABELS[plan.status]} status={STATUS_TONES[plan.status]} />,
                schedule: SCHEDULE_LABELS[plan.scheduleType] || plan.scheduleType,
                next: plan.nextGenerateAt ? new Date(plan.nextGenerateAt).toLocaleString('zh-CN') : '-',
                actions: hasPermission('task_plan', 'activate') && ['draft', 'paused', 'active'].includes(plan.status) ? (
                  <NeutralTooltip content={plan.status === 'active' ? '暂停' : '激活'} className="cwgsyw-tooltip--pill" followCursor>
                    <IconButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="cwgsyw-tasks-icon-action"
                      disabled={statusMutation.isPending}
                      aria-label={`${plan.status === 'active' ? '暂停' : '激活'}计划 ${plan.name}`}
                      icon={
                        <span
                          aria-hidden="true"
                          className={`cwgsyw-tasks-figma-icon ${plan.status === 'active' ? 'cwgsyw-tasks-figma-icon--pause' : 'cwgsyw-tasks-figma-icon--play'}`}
                        />
                      }
                      onClick={(event) => {
                        event.stopPropagation()
                        statusMutation.mutate({ planId: plan.id, action: plan.status === 'active' ? 'pause' : 'activate' })
                      }}
                    />
                  </NeutralTooltip>
                ) : null,
              },
            }))}
            state={plans.isLoading ? 'loading' : records.length === 0 ? 'empty' : 'data'}
            empty={
              <TaskEmpty
                iconSrc={TASK_CALENDAR_CLOCK_ICON}
                figmaNode={TASK_CALENDAR_CLOCK_NODE}
                title="暂无任务计划"
                description="从一次性任务、日报或巡检计划开始。"
              />
            }
            onRowClick={(id) => router.push(`/tasks/plans/${id}`)}
          />
          </div>
        )
      }
    />
  )
}
