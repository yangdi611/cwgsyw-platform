'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from '@/design-system/figma-neutral/toast'
import { usePermission } from '@/hooks/usePermission'
import { changeTaskPlanStatus, listTaskPlans, type TaskPlanStatus } from '@/lib/task-plan-api'
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
  SearchInput,
  StatusBadge,
  Table,
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
  cron: '高级 Cron',
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
      header={
        <PageHeader
          eyebrow="统一任务平台"
          title="任务计划"
          subtitle="将已发布模板配置为一次性或周期任务，并统一分配执行人、CI 范围、提醒与审批。"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/tasks', label: '我的任务' },
                { label: '任务计划' },
              ]}
            />
          }
          actions={
            hasPermission('task_plan', 'create') ? (
              <Button type="button" variant="primary" onClick={() => router.push('/tasks/plans/new')}>
                新建计划
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
              placeholder="搜索计划名称或描述"
              onChange={(event) => setKeyword(event.target.value)}
            />
          }
          filterItems={
            <div className="cwgsyw-inline-controls">
              {FILTERS.map((item) => (
                <Chip
                  key={item}
                  label={item === 'all' ? '全部' : STATUS_LABELS[item]}
                  selected={status === item}
                  onClick={() => setStatus(item)}
                />
              ))}
            </div>
          }
        />
      }
      content={
        plans.isError ? (
          <ErrorState
            title="计划加载失败"
            description="无法读取任务计划，请重试。"
            retry={<Button type="button" variant="secondary" onClick={() => void plans.refetch()}>重试</Button>}
          />
        ) : (
          <Table
            showSearch={false}
            columns={[
              { key: 'name', label: '计划' },
              { key: 'status', label: '状态' },
              { key: 'schedule', label: '周期' },
              { key: 'next', label: '下次扫描' },
              { key: 'actions', label: '操作' },
            ]}
            rows={records.map((plan) => ({
              id: String(plan.id),
              cells: {
                name: (
                  <div>
                    <strong>{plan.name}</strong>
                    <p className="cwgsyw-type-body-sm">{plan.templateName || `模板版本 #${plan.templateVersionId}`}</p>
                    <p className="cwgsyw-type-label-xs">{plan.description || '暂无描述'}</p>
                  </div>
                ),
                status: <StatusBadge label={STATUS_LABELS[plan.status]} status={STATUS_TONES[plan.status]} />,
                schedule: SCHEDULE_LABELS[plan.scheduleType] || plan.scheduleType,
                next: plan.nextGenerateAt ? new Date(plan.nextGenerateAt).toLocaleString('zh-CN') : '-',
                actions: (
                  <div className="cwgsyw-inline-controls">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation()
                        router.push(`/tasks/plans/${plan.id}`)
                      }}
                    >
                      配置
                    </Button>
                    {hasPermission('task_plan', 'activate') && ['draft', 'paused'].includes(plan.status) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={statusMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation()
                          statusMutation.mutate({ planId: plan.id, action: 'activate' })
                        }}
                      >
                        激活
                      </Button>
                    ) : null}
                    {hasPermission('task_plan', 'activate') && plan.status === 'active' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={statusMutation.isPending}
                        onClick={(event) => {
                          event.stopPropagation()
                          statusMutation.mutate({ planId: plan.id, action: 'pause' })
                        }}
                      >
                        暂停
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            }))}
            state={plans.isLoading ? 'loading' : records.length === 0 ? 'empty' : 'data'}
            empty={<EmptyState title="暂无任务计划" description="从一次性任务、日报或巡检计划开始。" showAction={false} />}
            onRowClick={(id) => router.push(`/tasks/plans/${id}`)}
          />
        )
      }
    />
  )
}
