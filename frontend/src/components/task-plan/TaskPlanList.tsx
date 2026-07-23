'use client'

import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Pause, Play, Plus, Search, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/shared'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { usePermission } from '@/hooks/usePermission'
import { changeTaskPlanStatus, listTaskPlans, type TaskPlanStatus } from '@/lib/task-plan-api'

const STATUS_LABELS: Record<TaskPlanStatus, string> = {
  draft: '草稿',
  active: '运行中',
  paused: '已暂停',
  finished: '已结束',
  archived: '已归档',
}

const STATUS_TONES: Record<TaskPlanStatus, 'ok' | 'warn' | 'danger' | 'neutral'> = {
  draft: 'warn', active: 'ok', paused: 'warn', finished: 'neutral', archived: 'neutral',
}

const SCHEDULE_LABELS: Record<string, string> = {
  once: '一次性', daily: '每日', weekly: '每周', monthly: '每月', quarterly: '每季度',
  semiannual: '每半年', yearly: '每年', cron: '高级 Cron', holiday_relative: '节假日相对',
}

export function TaskPlanList() {
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="统一任务平台"
        title="任务计划"
        subtitle="将已发布模板配置为一次性或周期任务，并统一分配执行人、CI 范围、提醒与审批。"
        actions={hasPermission('task_plan', 'create') ? <Link href="/tasks/plans/new"><Button variant="primary"><Plus className="h-4 w-4" />新建计划</Button></Link> : undefined}
      />
      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-v2-muted" /><Input className="pl-9" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索计划名称或描述" /></div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'active', 'paused', 'finished', 'archived'] as const).map((item) => <button key={item} type="button" onClick={() => setStatus(item)} className={`h-8 rounded-v2-md border px-3 text-xs font-semibold ${status === item ? 'border-v2-primary bg-v2-primary-soft text-v2-primary' : 'border-v2-border text-v2-muted hover:bg-v2-surface-hover'}`}>{item === 'all' ? '全部' : STATUS_LABELS[item]}</button>)}
        </div>
      </Card>

      {plans.isLoading ? <LoadingState /> : plans.isError ? <ErrorState title="计划加载失败" onRetry={() => plans.refetch()} /> : plans.data?.records.length === 0 ? (
        <Card><EmptyState icon={<CalendarClock className="h-5 w-5" />} title="暂无任务计划" description="从一次性任务、日报或巡检计划开始。" /></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {plans.data?.records.map((plan) => (
            <Card key={plan.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={`/tasks/plans/${plan.id}`} className="truncate font-semibold text-v2-fg hover:text-v2-primary">{plan.name}</Link><StatusBadge status={STATUS_TONES[plan.status]}>{STATUS_LABELS[plan.status]}</StatusBadge></div><p className="mt-1 text-sm text-v2-muted">{plan.templateName || `模板版本 #${plan.templateVersionId}`}</p></div>
                <StatusBadge status="neutral">{SCHEDULE_LABELS[plan.scheduleType] || plan.scheduleType}</StatusBadge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-v2-muted">{plan.description || '暂无描述'}</p>
              <div className="mt-4 grid gap-2 border-t border-v2-border pt-3 text-xs text-v2-muted sm:grid-cols-2">
                <span>生成方式：{plan.generationMode}</span><span>下次扫描：{plan.nextGenerateAt ? new Date(plan.nextGenerateAt).toLocaleString('zh-CN') : '-'}</span>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Link href={`/tasks/plans/${plan.id}`}><Button size="sm" variant="ghost"><Settings2 className="h-4 w-4" />配置</Button></Link>
                {hasPermission('task_plan', 'activate') && ['draft', 'paused'].includes(plan.status) && <Button size="sm" variant="primary" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ planId: plan.id, action: 'activate' })}><Play className="h-4 w-4" />激活</Button>}
                {hasPermission('task_plan', 'activate') && plan.status === 'active' && <Button size="sm" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ planId: plan.id, action: 'pause' })}><Pause className="h-4 w-4" />暂停</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
