'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { deleteTaskTemplate, listTaskTemplates, type TaskTemplateStatus, type TaskTemplateSummary } from '@/lib/task-template-api'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Chip,
  DataManagementPage,
  EmptyState,
  ErrorState,
  FilterBar,
  NeutralAlertDialog,
  PageHeader,
  SearchInput,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

const STATUS_LABELS: Record<TaskTemplateStatus, string> = {
  draft: '草稿',
  published: '已发布',
  deprecated: '已废弃',
  archived: '已归档',
}

const STATUS_TONES: Record<TaskTemplateStatus, 'success' | 'warning' | 'neutral'> = {
  draft: 'warning',
  published: 'success',
  deprecated: 'neutral',
  archived: 'neutral',
}

const FILTERS: Array<'all' | TaskTemplateStatus> = ['all', 'draft', 'published', 'deprecated', 'archived']

export function TaskTemplateList() {
  const router = useRouter()
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
  const records = templates.data?.records ?? []

  return (
    <>
      <DataManagementPage
        embedded
        header={
          <PageHeader
            eyebrow="统一任务平台"
            title="任务模板"
            subtitle="设计任务说明、动态表单、统计语义和默认策略；发布后的版本保持不可变。"
            breadcrumb={
              <Breadcrumb
                items={[
                  { href: '/', label: '工作台' },
                  { href: '/tasks', label: '我的任务' },
                  { label: '任务模板' },
                ]}
              />
            }
            actions={
              hasPermission('task_template', 'create') ? (
                <Button type="button" variant="primary" onClick={() => router.push('/tasks/templates/new')}>
                  新建模板
                </Button>
              ) : null
            }
          />
        }
        filter={
          <FilterBar
            search={
              <SearchInput
                value={keyword}
                placeholder="搜索模板名称或编码"
                onChange={(event) => setKeyword(event.target.value)}
              />
            }
            filterItems={
              <div className="cwgsyw-inline-controls">
                {FILTERS.map((item) => (
                  <Chip
                    key={item}
                    label={item === 'all' ? '全部' : STATUS_LABELS[item]}
                    selected={status === item}
                    onClick={() => setStatus(item)}
                  />
                ))}
              </div>
            }
          />
        }
        content={
          templates.isError ? (
            <ErrorState
              title="模板加载失败"
              description="无法读取任务模板，请重试。"
              retry={<Button type="button" variant="secondary" onClick={() => void templates.refetch()}>重试</Button>}
            />
          ) : (
            <Table
              showSearch={false}
              columns={[
                { key: 'name', label: '模板' },
                { key: 'status', label: '状态' },
                { key: 'scope', label: '范围' },
                { key: 'updatedAt', label: '更新时间' },
                { key: 'actions', label: '操作' },
              ]}
              rows={records.map((template) => ({
                id: String(template.id),
                cells: {
                  name: (
                    <div>
                      <strong>{template.name}</strong>
                      <p className="cwgsyw-type-label-xs">{template.code}</p>
                      <p className="cwgsyw-type-body-sm">{template.description || '暂无描述'}</p>
                    </div>
                  ),
                  status: (
                    <div className="cwgsyw-inline-controls">
                      <StatusBadge label={STATUS_LABELS[template.status]} status={STATUS_TONES[template.status]} />
                      {template.builtin ? <StatusBadge label="系统内置" status="neutral" /> : null}
                      {template.category ? <Chip label={template.category} /> : <Chip label="未分类" />}
                    </div>
                  ),
                  scope: template.scopeType,
                  updatedAt: new Date(template.updatedAt).toLocaleString('zh-CN'),
                  actions: canDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeleteTarget(template)
                      }}
                    >
                      删除
                    </Button>
                  ) : null,
                },
              }))}
              state={templates.isLoading ? 'loading' : records.length === 0 ? 'empty' : 'data'}
              empty={<EmptyState title="暂无任务模板" description="创建一个高度定制的任务模板，或直接使用系统内置模板。" showAction={false} />}
              onRowClick={(id) => router.push(`/tasks/templates/${id}`)}
            />
          )
        }
      />
      <NeutralAlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null)
        }}
        title="确认删除模板"
        description={`确定要删除模板「${deleteTarget?.name ?? ''}」吗？若该模板已被任何任务或任务计划使用，系统会拒绝删除以保护历史数据。`}
        intent="destructive"
        confirmLabel={deleteMutation.isPending ? '删除中…' : '确认删除'}
        cancelLabel="取消"
        onConfirm={() => {
          if (deleteTarget && !deleteMutation.isPending) deleteMutation.mutate(deleteTarget.id)
        }}
      />
    </>
  )
}
