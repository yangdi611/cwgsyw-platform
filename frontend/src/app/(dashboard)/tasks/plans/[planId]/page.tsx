'use client'

import { useParams } from 'next/navigation'
import { TaskPlanEditor } from '@/components/task-plan/TaskPlanEditor'
import '@/design-system/figma-neutral/index.css'

export default function TaskPlanDetailPage() {
  const params = useParams<{ planId: string }>()
  return <TaskPlanEditor planId={Number(params.planId)} />
}
