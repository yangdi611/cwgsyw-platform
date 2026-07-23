'use client'

import { useParams } from 'next/navigation'
import { TaskDetail } from '@/components/task-runtime/TaskDetail'

export default function TaskDetailPage() {
  const params = useParams<{ taskId: string }>()
  return <TaskDetail taskId={Number(params.taskId)} />
}
