'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApprovalActions } from '@/components/daily/ApprovalActions'
import Link from 'next/link'

interface TaskVO {
  task_id: string
  task_name: string
  business_type: string
  business_id: number
  create_time: string
}

export default function WorkflowTasksPage() {
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['workflow-tasks'],
    queryFn: () => api.get('/workflow/tasks/group').then(r => r.data.data as TaskVO[]),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">待审批任务</h1>
      {isLoading ? <p className="text-muted-foreground">加载中...</p> : (
        <div className="space-y-3">
          {(data ?? []).map(task => (
            <div key={task.task_id} className="p-4 border rounded-lg bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{task.task_name}</span>
                    <Badge variant="outline">
                      {task.business_type === 'daily_report' ? '日报审批' : task.business_type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(task.create_time).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {task.business_type === 'daily_report' && task.business_id && (
                    <Link href={`/daily/${task.business_id}`}
                      className="text-sm text-primary hover:underline px-2 py-1">
                      查看日报
                    </Link>
                  )}
                  <Button variant="outline" size="sm"
                    onClick={() => setExpandedTask(
                      expandedTask === task.task_id ? null : task.task_id
                    )}>
                    {expandedTask === task.task_id ? '收起' : '审批'}
                  </Button>
                </div>
              </div>
              {expandedTask === task.task_id && (
                <ApprovalActions
                  taskId={task.task_id}
                  onDone={() => setExpandedTask(null)}
                />
              )}
            </div>
          ))}
          {(data ?? []).length === 0 && (
            <p className="text-muted-foreground text-center py-12">暂无待审批任务</p>
          )}
        </div>
      )}
    </div>
  )
}
