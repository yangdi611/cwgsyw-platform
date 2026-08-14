'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from '@/design-system/figma-neutral/toast'
import { createTaskTemplateDraft, getTaskTemplate } from '@/lib/task-template-api'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import '@/design-system/figma-neutral/index.css'
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  DetailDrawerPage,
  ErrorState,
  LoadingState,
  MetricCard,
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

  if (template.isLoading) return <LoadingState label="正在加载模板…" />
  if (template.isError || !template.data) {
    return (
      <ErrorState
        title="模板加载失败"
        description="无法读取任务模板，请重试。"
        retry={<Button type="button" variant="secondary" onClick={() => void template.refetch()}>重试</Button>}
      />
    )
  }

  const data = template.data
  const draft = data.versions.find((version) => version.status === 'draft')
  const status = TEMPLATE_STATUS[data.status] ?? { label: data.status, tone: 'neutral' as const }

  return (
    <DetailDrawerPage
      embedded
      header={
        <PageHeader
          eyebrow={`统一任务平台 · ${data.code}`}
          title={data.name}
          subtitle={data.description || '暂无描述'}
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/tasks', label: '我的任务' },
                { href: '/tasks/templates', label: '任务模板' },
                { label: data.name },
              ]}
            />
          }
          status={<StatusBadge label={status.label} status={status.tone} />}
          actions={
            draft ? (
              <Button type="button" variant="primary" onClick={() => router.push(`/tasks/templates/${templateId}/versions/${draft.id}`)}>
                继续设计 v{draft.version}
              </Button>
            ) : hasPermission('task_template', 'update') && !data.builtin ? (
              <Button type="button" variant="primary" disabled={createDraft.isPending} onClick={() => createDraft.mutate()}>
                {createDraft.isPending ? '创建中' : '创建下一草稿版本'}
              </Button>
            ) : null
          }
        />
      }
      content={
        <div className="cwgsyw-form">
          {data.builtin ? (
            <Alert
              tone="info"
              title="内置模板保持只读"
              description="计划可直接引用此模板；需要定制时应复制为新的租户模板。"
              showDismiss={false}
            />
          ) : null}
          <Card title="版本历史" description="发布版本不可修改，历史任务始终绑定当时的具体版本。">
            <div className="cwgsyw-stack-list">
              {data.versions.length === 0 ? (
                <p className="cwgsyw-stack-list__empty">暂无版本</p>
              ) : data.versions.map((version) => {
                const versionStatus = TEMPLATE_STATUS[version.status] ?? { label: version.status, tone: 'neutral' as const }
                return (
                  <Button
                    key={version.id}
                    type="button"
                    variant="ghost"
                    className="cwgsyw-stack-list__item"
                    onClick={() => router.push(`/tasks/templates/${templateId}/versions/${version.id}`)}
                  >
                    <div>
                      <strong>v{version.version} · {version.name}</strong>
                      <p className="cwgsyw-type-label-xs">更新于 {new Date(version.updatedAt).toLocaleString('zh-CN')}</p>
                    </div>
                    <StatusBadge label={versionStatus.label} status={versionStatus.tone} />
                  </Button>
                )
              })}
            </div>
          </Card>
        </div>
      }
      drawer={
        <div className="cwgsyw-form">
          <MetricCard label="版本数量" value={String(data.versions.length)} />
          <MetricCard label="模板范围" value={data.scopeType} />
          <MetricCard label="模板来源" value={data.builtin ? '系统内置' : '租户自定义'} />
        </div>
      }
    />
  )
}
