'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { FileText, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { PageHeader, EmptyState, LoadingState, ErrorState } from '@/components/shared'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { listTaskTemplates, type TaskTemplateStatus } from '@/lib/task-template-api'
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
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'all' | TaskTemplateStatus>('all')
  const templates = useQuery({
    queryKey: ['task-templates', { keyword, status }],
    queryFn: () => listTaskTemplates({ keyword: keyword || undefined, status: status === 'all' ? undefined : status, size: 100 }),
  })

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
            <Link key={template.id} href={`/tasks/templates/${template.id}`} className="block">
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
                <div className="mt-4 flex items-center justify-between border-t border-v2-border pt-3 text-xs text-v2-muted">
                  <span>范围：{template.scopeType}</span>
                  <span>{new Date(template.updatedAt).toLocaleString('zh-CN')}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
