'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { Textarea } from '@/components/v2/Textarea'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { PageHeader, EmptyState } from '@/components/shared'
import { toast } from 'sonner'
import Link from 'next/link'
import { Check, X, ClipboardList } from 'lucide-react'

interface TaskVO {
  taskId: string
  processInstanceId: string
  taskName: string
  businessType: string
  businessId: number
  businessKey: string
  createTime: string
  assignee: string | null
}

const businessTypeLabels: Record<string, string> = {
  daily_report: '日报审批',
  change_doc: '变更文档审批',
  device: '设备权限申请',
}

type ChipTone = 'default' | 'primary' | 'success' | 'warning' | 'danger'

function Chip({ children, tone = 'default' }: { children: React.ReactNode; tone?: ChipTone }) {
  const styles: Record<ChipTone, string> = {
    default: 'border-v2-border bg-v2-surface-soft text-v2-fg',
    primary: 'border-v2-primary-border bg-v2-primary-soft text-v2-primary',
    success: 'border-v2-success-border bg-v2-success-soft text-v2-success',
    warning: 'border-v2-warning-border bg-v2-warning-soft text-v2-warning',
    danger: 'border-v2-danger-border bg-v2-danger-soft text-v2-danger',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  )
}

interface ApprovalState {
  taskId: string
  approved: boolean
  comment: string
}

export default function WorkflowTasksPage() {
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [approvalStates, setApprovalStates] = useState<Record<string, ApprovalState>>({})

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workflow-tasks'],
    queryFn: () => api.get('/workflow/tasks/group').then((r) => r.data.data as TaskVO[]),
  })

  const tasks = data ?? []

  const getApprovalState = (taskId: string): ApprovalState =>
    approvalStates[taskId] || { taskId, approved: false, comment: '' }

  const updateApprovalState = (taskId: string, update: Partial<ApprovalState>) => {
    setApprovalStates((prev) => ({ ...prev, [taskId]: { ...getApprovalState(taskId), ...update } }))
  }

  const handleApprove = async (taskId: string, approved: boolean) => {
    const state = getApprovalState(taskId)
    try {
      await api.post('/workflow/approve', {
        taskId: taskId,
        approved,
        comment: state.comment || undefined,
      })
      toast.success(approved ? '已通过' : '已拒绝')
      setExpandedTask(null)
      refetch()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '操作失败')
    }
  }

  const renderBusinessLink = (task: TaskVO) => {
    if (task.businessType === 'daily_report' && task.businessId) {
      return (
        <Link
          href={`/daily/${task.businessId}`}
          className="text-sm font-semibold text-v2-primary hover:text-v2-primary-hover"
        >
          查看日报
        </Link>
      )
    }
    if (task.businessKey) return <span className="text-xs text-v2-muted">{task.businessKey}</span>
    return null
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="流程中心"
        title="待审批任务"
        subtitle="集中处理日报、变更文档、设备权限等审批任务，支持填写意见后通过或拒绝。"
      />

      {isLoading ? null : tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="h-5 w-5 text-v2-muted" />}
            title="暂无待审批任务"
            description="所有分配给你的审批任务均已处理完毕。"
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const state = getApprovalState(task.taskId)
            const isExpanded = expandedTask === task.taskId
            return (
              <Card key={task.taskId} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-v2-fg">{task.taskName}</span>
                      <Chip tone="primary">
                        {(businessTypeLabels[task.businessType] ?? task.businessType) || '审批'}
                      </Chip>
                      {task.assignee && <Chip tone="success">已认领</Chip>}
                    </div>
                    <p className="mt-1 text-sm text-v2-muted">
                      {new Date(task.createTime).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {renderBusinessLink(task)}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setExpandedTask(isExpanded ? null : task.taskId)}
                    >
                      {isExpanded ? '收起' : '审批'}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-4 border-t border-v2-border pt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-v2-fg">审批意见（可选）</label>
                      <Textarea
                        rows={2}
                        value={state.comment}
                        onChange={(e) => updateApprovalState(task.taskId, { comment: e.target.value })}
                        placeholder="填写审批意见…"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={() => handleApprove(task.taskId, true)}>
                        <Check className="h-4 w-4" />
                        通过
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleApprove(task.taskId, false)}>
                        <X className="h-4 w-4" />
                        拒绝
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
