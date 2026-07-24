'use client'

import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader, EmptyState, LoadingState, ErrorState } from '@/components/shared'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { getApiErrorMessage } from '@/lib/api-error'
import { deleteTaskTemplate, listTaskTemplates, type TaskTemplateStatus, type TaskTemplateSummary } from '@/lib/task-template-api'
import { usePermission } from '@/hooks/usePermission'

const STATUS_LABELS: Record<TaskTemplateStatus, string> = {
  draft: '草稿',
  published: '已发布',
  deprecated: '已废弃',
  archived: '已归档',
}

const STATUS_TONES: Record<TaskTemplateStatus, 'ok' | 'warn' | 'neutral'> = {
  draft: 'warn',
  published: 'ok',
  deprecated: 'neutral',
  archived: 'neutral',
}

export function TaskTemplateList() {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'all' | TaskTemplateStatus>('all')
  const [deleteTarget, setDeleteTarget] = useState<TaskTemplateSummary | null>(null)
  const templates = useQuery({
    queryKey: ['task-templates', { keyword, status }],
    queryFn: () => listTaskTemplates({ keyword: keyword || undefined, status: status === 'all' ? undefined : status, size: 100 }),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteTaskTemplate,
    onSuccess: async () => {
      toast.success('模板已删除')
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['task-templates'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '删除模板失败')),
  })
  const canDelete = hasPermission('task_template', 'delete')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="统一任务平台"
        title="任务模板"
        subtitle="设计任务说明、动态表单、统计语义和默认策略；发布后的版本保持不可变。"
        actions={hasPermission('task_template', 'create') ? (
          <Link href="/tasks/templates/new">
            <Button variant="primary"><Plus className="h-4 w-4" />新建模板</Button>
          </Link>
        ) : undefined}
      />

      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-v2-muted" />
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} className="pl-9" placeholder="搜索模板名称或编码" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'published', 'deprecated', 'archived'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`h-8 rounded-v2-md border px-3 text-xs font-semibold transition-colors ${
                status === item
                  ? 'border-v2-primary bg-v2-primary-soft text-v2-primary'
                  : 'border-v2-border bg-v2-surface text-v2-muted hover:bg-v2-surface-hover'
              }`}
            >
              {item === 'all' ? '全部' : STATUS_LABELS[item]}
            </button>
          ))}
        </div>
      </Card>

      {templates.isLoading ? (
        <LoadingState />
      ) : templates.isError ? (
        <ErrorState title="模板加载失败" onRetry={() => templates.refetch()} />
      ) : templates.data?.records.length === 0 ? (
        <Card><EmptyState icon={<FileText className="h-5 w-5" />} title="暂无任务模板" description="创建一个高度定制的任务模板，或直接使用系统内置模板。" /></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {templates.data?.records.map((template) => (
            <div key={template.id}>
              <Link href={`/tasks/templates/${template.id}`} className="block">
              <Card className="h-full p-4 transition hover:-translate-y-0.5 hover:shadow-v2-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold text-v2-fg">{template.name}</h2>
                      <StatusBadge status={STATUS_TONES[template.status]}>{STATUS_LABELS[template.status]}</StatusBadge>
                      {template.builtin && <StatusBadge status="neutral">系统内置</StatusBadge>}
                    </div>
                    <p className="mt-1 font-v2-mono text-xs text-v2-muted">{template.code}</p>
                  </div>
                  <span className="rounded-v2-md bg-v2-surface-hover px-2 py-1 text-xs text-v2-muted">{template.category || '未分类'}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-v2-muted">{template.description || '暂无描述'}</p>
                <div className="mt-4 flex items-center gap-3 border-t border-v2-border pt-3 text-xs text-v2-muted">
                  <span>范围：{template.scopeType}</span>
                  <span className="ml-auto whitespace-nowrap">{new Date(template.updatedAt).toLocaleString('zh-CN')}</span>
                  {canDelete && !template.builtin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title={`删除模板 ${template.name}`}
                      className="h-7 w-7 shrink-0 px-0 text-v2-danger hover:text-v2-danger"
                      onClick={(event) => { event.preventDefault(); setDeleteTarget(template) }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
              </Link>
            </div>
          ))}
        </div>
      )}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除模板</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除模板「{deleteTarget?.name}」吗？若该模板已被任何任务或任务计划使用，系统会拒绝删除以保护历史数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deleteTarget || deleteMutation.isPending}
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
            >
              {deleteMutation.isPending ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
