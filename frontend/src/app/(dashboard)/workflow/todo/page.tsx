'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Textarea } from '@/components/v2/Textarea'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { PageHeader, EmptyState } from '@/components/shared'
import { toast } from 'sonner'
import Link from 'next/link'
import { Check, X, ClipboardList, User2, ExternalLink } from 'lucide-react'

interface TaskSummary {
  taskId: string
  processInstanceId: string
  taskName: string
  assignee: string | null
  createTime: string
  businessKey: string
  businessType: string
  businessId: string
  businessTitle: string | null
  businessSummary: string | null
  businessUrl: string | null
  submitterName: string | null
  canApprove: boolean
  recognized: boolean
}

const businessTypeLabels: Record<string, string> = {
  daily_report: '日报审批',
  wiki_page: 'Wiki 审批',
  change_doc: '变更文档审批',
  device_access: '设备权限申请',
}

type Scope = 'my' | 'group'

export default function WorkflowTodoPage() {
  const [scope, setScope] = useState<Scope>('my')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, string>>({})
  const [acting, setActing] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workflow-center-tasks', scope],
    queryFn: () =>
      api.get(`/workflow/center/tasks/${scope}`).then((r) => r.data.data as TaskSummary[]),
  })

  const tasks = data ?? []

  const handleApprove = async (task: TaskSummary, approved: boolean) => {
    setActing(task.taskId)
    try {
      await api.post('/workflow/center/tasks/complete', {
        taskId: task.taskId,
        approved,
        comment: comments[task.taskId]?.trim() || undefined,
      })
      toast.success(approved ? '已通过' : '已拒绝')
      setExpanded(null)
      refetch()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '操作失败')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="流程中心"
        title="待办中心"
        subtitle="集中处理各业务模块的审批任务，附带业务摘要与提交人信息。"
      />

      <div className="flex gap-2">
        <Button variant={scope === 'my' ? 'primary' : 'secondary'} size="sm" onClick={() => setScope('my')}>
          我的待办
        </Button>
        <Button variant={scope === 'group' ? 'primary' : 'secondary'} size="sm" onClick={() => setScope('group')}>
          组待办
        </Button>
      </div>

      {isLoading ? null : tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="h-5 w-5 text-v2-muted" />}
            title="暂无待办任务"
            description="当前范围内没有需要处理的审批任务。"
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isExpanded = expanded === task.taskId
            const label = businessTypeLabels[task.businessType] ?? task.businessType
            return (
              <Card key={task.taskId} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-v2-fg">
                        {task.businessTitle || task.taskName}
                      </span>
                      <StatusBadge status={task.recognized ? 'neutral' : 'warn'}>
                        {task.recognized ? label : task.businessKey || '未识别'}
                      </StatusBadge>
                      {task.assignee && <StatusBadge status="ok">已认领</StatusBadge>}
                    </div>
                    {task.businessSummary && (
                      <p className="truncate text-sm text-v2-muted">{task.businessSummary}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-v2-subtle">
                      <span>{new Date(task.createTime).toLocaleString('zh-CN')}</span>
                      {task.submitterName && (
                        <span className="inline-flex items-center gap-1">
                          <User2 className="h-3 w-3" />
                          {task.submitterName}
                        </span>
                      )}
                      {task.businessUrl && (
                        <Link
                          href={task.businessUrl}
                          className="inline-flex items-center gap-1 text-v2-primary hover:text-v2-primary-hover"
                        >
                          <ExternalLink className="h-3 w-3" />
                          查看详情
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!task.canApprove}
                      title={task.canApprove ? undefined : '您没有该业务的审批权限'}
                      onClick={() => setExpanded(isExpanded ? null : task.taskId)}
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
                        value={comments[task.taskId] ?? ''}
                        onChange={(e) =>
                          setComments((prev) => ({ ...prev, [task.taskId]: e.target.value }))
                        }
                        placeholder="填写审批意见…"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={acting === task.taskId}
                        onClick={() => handleApprove(task, true)}
                      >
                        <Check className="h-4 w-4" />
                        通过
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={acting === task.taskId}
                        onClick={() => handleApprove(task, false)}
                      >
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
