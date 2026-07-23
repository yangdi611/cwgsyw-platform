import { TaskTemplateDesigner } from '@/components/task-template/TaskTemplateDesigner'

export default async function TaskTemplateVersionPage({
  params,
}: {
  params: Promise<{ templateId: string; versionId: string }>
}) {
  const { templateId, versionId } = await params
  return <TaskTemplateDesigner templateId={Number(templateId)} versionId={Number(versionId)} />
}
