import { TaskTemplateDetail } from '@/components/task-template/TaskTemplateDetail'
import '@/design-system/figma-neutral/index.css'

export default async function TaskTemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>
}) {
  const { templateId } = await params
  return <TaskTemplateDetail templateId={Number(templateId)} />
}
