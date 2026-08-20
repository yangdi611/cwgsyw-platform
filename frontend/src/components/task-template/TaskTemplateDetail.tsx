'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from '@/design-system/figma-neutral/toast'
import { createTaskTemplateDraft, getTaskTemplate } from '@/lib/task-template-api'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import { TaskEmpty, TaskPanel, TASK_LAYOUT_TEMPLATE_ICON, TASK_LAYOUT_TEMPLATE_NODE } from '@/components/task-runtime/TaskEmpty'
import {
  Alert,
  Button,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

const TEMPLATE_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  draft: { label: '草稿', tone: 'warning' },
  published: { label: '已发布', tone: 'success' },
  deprecated: { label: '已废弃', tone: 'neutral' },
  archived: { label: '已归档', tone: 'neutral' },
}

export function TaskTemplateDetail({ templateId }: { templateId: number }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const template = useQuery({
    queryKey: ['task-template', templateId],
    queryFn: () => getTaskTemplate(templateId),
    enabled: Number.isFinite(templateId),
  })
  useBreadcrumbLabel(template.data?.name)
  const createDraft = useMutation({
    mutationFn: () => createTaskTemplateDraft(templateId),
    onSuccess: (version) => {
      toast.success(`草稿 v${version.version} 已创建`)
      queryClient.invalidateQueries({ queryKey: ['task-template', templateId] })
      router.push(`/tasks/templates/${templateId}/versions/${version.id}`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '创建草稿版本失败')),
  })

  if (template.isLoading) {
    return (
      <div className="cwgsyw-tasks-page">
        <PageHeader showEyebrow={false} showBreadcrumb={false} showSubtitle={false} title="模板详情" />
        <LoadingState label="正在加载模板…" />
      </div>
    )
  }
  if (template.isError || !template.data) {
    return (
      <div className="cwgsyw-tasks-page">
        <PageHeader showEyebrow={false} showBreadcrumb={false} showSubtitle={false} title="模板详情" />
        <ErrorState
          title="模板加载失败"
          description="无法读取任务模板，请重试。"
          retry={<Button type="button" size="sm" variant="secondary" onClick={() => void template.refetch()}>重试</Button>}
        />
      </div>
    )
  }

  const data = template.data
  const draft = data.versions.find((version) => version.status === 'draft')
  const status = TEMPLATE_STATUS[data.status] ?? { label: data.status, tone: 'neutral' as const }

  return (
    <div className="cwgsyw-tasks-page">
      <PageHeader
        showEyebrow={false}
        showBreadcrumb={false}
        showSubtitle={false}
        title={data.name}
        status={<StatusBadge label={status.label} status={status.tone} />}
        actions={
          draft ? (
            <Button type="button" size="sm" variant="primary" onClick={() => router.push(`/tasks/templates/${templateId}/versions/${draft.id}`)}>
              继续设计 v{draft.version}
            </Button>
          ) : hasPermission('task_template', 'update') && !data.builtin ? (
            <Button type="button" size="sm" variant="primary" disabled={createDraft.isPending} onClick={() => createDraft.mutate()}>
              {createDraft.isPending ? '创建中' : '创建下一草稿版本'}
            </Button>
          ) : null
        }
      />
      {data.builtin ? (
        <Alert
          tone="info"
          title="内置模板保持只读"
          description="计划可直接引用此模板；需要定制时应复制为新的租户模板。"
          showDismiss={false}
        />
      ) : null}
      <TaskPanel title="版本历史">
        {data.versions.length === 0 ? (
          <TaskEmpty iconSrc={TASK_LAYOUT_TEMPLATE_ICON} figmaNode={TASK_LAYOUT_TEMPLATE_NODE} title="暂无版本" description="发布版本不可修改，历史任务始终绑定当时的具体版本。" />
        ) : (
          <div className="cwgsyw-tasks-pick-list">
            {data.versions.map((version) => {
              const versionStatus = TEMPLATE_STATUS[version.status] ?? { label: version.status, tone: 'neutral' as const }
              return (
                <Button
                  key={version.id}
                  type="button"
                  variant="ghost"
                  className="cwgsyw-tasks-pick"
                  onClick={() => router.push(`/tasks/templates/${templateId}/versions/${version.id}`)}
                >
                  <span className="cwgsyw-tasks-cell-title">v{version.version} · {version.name}</span>
                  <span className="cwgsyw-tasks-cell-meta">更新于 {new Date(version.updatedAt).toLocaleString('zh-CN')}</span>
                  <StatusBadge label={versionStatus.label} status={versionStatus.tone} />
                </Button>
              )
            })}
          </div>
        )}
      </TaskPanel>
      <TaskPanel title="模板信息">
        <dl className="cwgsyw-tasks-meta">
          <div><dt>版本数量</dt><dd>{data.versions.length}</dd></div>
          <div><dt>模板范围</dt><dd>{data.scopeType}</dd></div>
          <div><dt>模板来源</dt><dd>{data.builtin ? '系统内置' : '租户自定义'}</dd></div>
        </dl>
      </TaskPanel>
    </div>
  )
}
