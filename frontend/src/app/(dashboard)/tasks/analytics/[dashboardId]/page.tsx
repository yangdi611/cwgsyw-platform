import { TaskAnalyticsDashboard } from '@/components/task-analytics/TaskAnalyticsDashboard'
import '@/design-system/figma-neutral/index.css'

export default async function TaskAnalyticsDashboardPage({ params }: { params: Promise<{ dashboardId: string }> }) {
  const { dashboardId } = await params
  return <TaskAnalyticsDashboard dashboardId={Number(dashboardId)} />
}
