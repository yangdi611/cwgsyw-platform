'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CopyPlus, FileLock2, Pencil, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DetailHeader, ErrorState, LoadingState, PageShell } from '@/components/shared'
import { Button, Card, StatusBadge } from '@/components/design-system'
import { createTaskTemplateDraft, getTaskTemplate } from '@/lib/task-template-api'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'

export function TaskTemplateDetail({ templateId }: { templateId: number }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const template = useQuery({
    queryKey: ['task-template', templateId],
    queryFn: () => getTaskTemplate(templateId),
    enabled: Number.isFinite(templateId),
  })
  const createDraft = useMutation({
    mutationFn: () => createTaskTemplateDraft(templateId),
    onSuccess: (version) => {
      toast.success(`草稿 v${version.version} 已创建`)
      queryClient.invalidateQueries({ queryKey: ['task-template', templateId] })
      router.push(`/tasks/templates/${templateId}/versions/${version.id}`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '创建草稿版本失败')),
  })

  if (template.isLoading) return <LoadingState />
  if (template.isError || !template.data) return <ErrorState title="模板加载失败" onRetry={() => template.refetch()} />

  const draft = template.data.versions.find((version) => version.status === 'draft')
  return (
    <PageShell width="wide" density="comfortable">
      <DetailHeader
        backHref="/tasks/templates"
        eyebrow={`任务模板 · ${template.data.code}`}
        title={template.data.name}
        subtitle={template.data.description || '暂无描述'}
        actions={
          <div className="flex gap-2">
            {draft ? (
              <Link href={`/tasks/templates/${templateId}/versions/${draft.id}`}>
                <Button variant="primary"><Pencil className="h-4 w-4" />继续设计 v{draft.version}</Button>
              </Link>
            ) : hasPermission('task_template', 'update') && !template.data.builtin ? (
              <Button variant="primary" onClick={() => createDraft.mutate()} disabled={createDraft.isPending}>
                <CopyPlus className="h-4 w-4" />创建下一草稿版本
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-v2-muted">当前状态</p><div className="mt-2"><StatusBadge status={template.data.status === 'published' ? 'ok' : template.data.status === 'draft' ? 'warn' : 'neutral'}>{template.data.status}</StatusBadge></div></Card>
        <Card className="p-4"><p className="text-xs text-v2-muted">版本数量</p><p className="mt-2 text-2xl font-semibold text-v2-fg">{template.data.versions.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-v2-muted">模板范围</p><p className="mt-2 font-semibold text-v2-fg">{template.data.scopeType}</p></Card>
        <Card className="p-4"><p className="text-xs text-v2-muted">模板来源</p><p className="mt-2 font-semibold text-v2-fg">{template.data.builtin ? '系统内置' : '租户自定义'}</p></Card>
      </div>

      {template.data.builtin && (
        <Card className="flex items-start gap-3 border border-v2-primary-border bg-v2-primary-soft p-4 text-v2-primary">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">内置模板保持只读</p><p className="mt-1 text-sm opacity-80">计划可直接引用此模板；需要定制时应复制为新的租户模板。</p></div>
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-4"><h2 className="font-semibold text-v2-fg">版本历史</h2><p className="mt-1 text-sm text-v2-muted">发布版本不可修改，历史任务始终绑定当时的具体版本。</p></div>
        <div className="space-y-3">
          {template.data.versions.map((version) => (
            <Link
              key={version.id}
              href={`/tasks/templates/${templateId}/versions/${version.id}`}
              className="flex items-center justify-between rounded-v2-lg border border-v2-border p-4 transition hover:bg-v2-surface-hover"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-v2-surface-hover font-v2-mono text-sm font-semibold text-v2-fg">v{version.version}</span>
                <div><p className="font-medium text-v2-fg">{version.name}</p><p className="text-xs text-v2-muted">更新于 {new Date(version.updatedAt).toLocaleString('zh-CN')}</p></div>
              </div>
              <div className="flex items-center gap-2">
                {version.status !== 'draft' && <FileLock2 className="h-4 w-4 text-v2-muted" />}
                <StatusBadge status={version.status === 'published' ? 'ok' : version.status === 'draft' ? 'warn' : 'neutral'}>{version.status}</StatusBadge>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </PageShell>
  )
}
