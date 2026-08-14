'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Chip,
  DataManagementPage,
  EmptyState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Select,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

type DocType = 'application' | 'plan' | 'general'

interface TemplateVO {
  id: number
  name: string
  description: string
  version: number
  active: boolean
  hasDocx: boolean
  docType: DocType
  fields: { id: number; fieldKey: string; label: string }[]
  createdAt: string
}

const DOC_TYPE_LABEL: Record<DocType, string> = {
  application: '申请单',
  plan: '方案',
  general: '通用',
}

const DOC_TYPE_TONE: Record<DocType, 'success' | 'warning' | 'neutral'> = {
  application: 'success',
  plan: 'warning',
  general: 'neutral',
}

export default function ChangeDocTemplatesPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newDocType, setNewDocType] = useState<DocType>('general')
  const [filter, setFilter] = useState<'all' | DocType>('all')
  const fileInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('change_doc_template', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: templates = [], isLoading } = useQuery<TemplateVO[]>({
    queryKey: ['change-doc-templates'],
    queryFn: () => api.get('/admin/change-doc-templates').then((response) => response.data.data),
    enabled: isHydrated && hasPermission('change_doc_template', 'read'),
  })

  const filteredTemplates = filter === 'all' ? templates : templates.filter((item) => item.docType === filter)

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(
        `/admin/change-doc-templates?name=${encodeURIComponent(newName)}` +
          `&description=${encodeURIComponent(newDesc ?? '')}` +
          `&docType=${newDocType}`,
      ),
    onSuccess: (response) => {
      toast.success('模板已创建')
      queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] })
      setCreating(false)
      setNewName('')
      setNewDesc('')
      setNewDocType('general')
      router.push(`/admin/change-doc-templates/${response.data.data.id}`)
    },
    onError: () => toast.error('创建失败'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api.put(`/admin/change-doc-templates/${id}/active?active=${active}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] }),
    onError: () => toast.error('操作失败'),
  })

  const handleUpload = async (templateId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    try {
      await api.post(`/admin/change-doc-templates/${templateId}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await api.post(`/admin/change-doc-templates/${templateId}/parse-bookmarks`)
      toast.success('模板文件已上传，书签已解析')
      queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '上传失败')
    }
  }

  return (
    <DataManagementPage
      embedded
      header={
        <PageHeader
          eyebrow="变更文档"
          title="模板管理"
          subtitle="管理 Word 模板文件与字段配置，作为新建变更文档的基础。每个模板按类型（申请单 / 方案 / 通用）使用。"
          breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: '模板管理' }]} />}
          actions={
            hasPermission('change_doc_template', 'write') ? (
              <Button type="button" size="sm" onClick={() => setCreating((value) => !value)}>
                新建模板
              </Button>
            ) : undefined
          }
        />
      }
      filter={
        <div className="cwgsyw-designer__actions">
          {(['all', 'application', 'plan', 'general'] as const).map((key) => (
            <Chip
              key={key}
              label={
                key === 'all'
                  ? `全部 (${templates.length})`
                  : `${DOC_TYPE_LABEL[key]} (${templates.filter((item) => item.docType === key).length})`
              }
              selected={filter === key}
              onClick={() => setFilter(key)}
            />
          ))}
        </div>
      }
      content={
        <>
          {creating ? (
            <Card title="新建模板" padding="md">
              <div className="cwgsyw-form">
                <Field htmlFor="template-name" label="模板名称" required>
                  <Input value={newName} placeholder="例：网络变更申请单" onChange={(event) => setNewName(event.target.value)} />
                </Field>
                <Field htmlFor="template-desc" label="描述">
                  <Input value={newDesc} placeholder="适用场景说明" onChange={(event) => setNewDesc(event.target.value)} />
                </Field>
                <Field htmlFor="template-type" label="类型" required>
                  <Select
                    value={newDocType}
                    options={[
                      { value: 'general', label: '通用' },
                      { value: 'application', label: '申请单' },
                      { value: 'plan', label: '方案' },
                    ]}
                    onChange={(value) => setNewDocType(value as DocType)}
                  />
                </Field>
                <div className="cwgsyw-designer__actions">
                  <Button type="button" size="sm" onClick={() => createMutation.mutate()} disabled={!newName || createMutation.isPending}>
                    创建
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
                    取消
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}
          {isLoading ? (
            <LoadingState label="正在加载模板…" />
          ) : filteredTemplates.length === 0 && !creating ? (
            <EmptyState
              title={filter === 'all' ? '暂无模板' : `暂无${DOC_TYPE_LABEL[filter as DocType]}模板`}
              description="点击右上角新建模板，或上传 Word 文件开始配置字段。"
            />
          ) : (
            <div className="cwgsyw-form">
              {filteredTemplates.map((template) => (
                <Card key={template.id} showHeader={false} padding="md">
                  <div className="cwgsyw-form">
                    <div className="cwgsyw-designer__actions">
                      <strong>{template.name}</strong>
                      <StatusBadge label={DOC_TYPE_LABEL[template.docType ?? 'general']} status={DOC_TYPE_TONE[template.docType ?? 'general']} />
                      <StatusBadge label={template.active ? '启用中' : '已禁用'} status={template.active ? 'success' : 'neutral'} />
                      {template.hasDocx ? <Badge label="已上传 .docx" tone="success" /> : null}
                      <span>
                        v{template.version} · {template.fields?.length ?? 0} 个字段
                      </span>
                    </div>
                    {template.description ? <p>{template.description}</p> : null}
                    {hasPermission('change_doc_template', 'write') ? (
                      <div className="cwgsyw-designer__actions">
                        <input
                          type="file"
                          accept=".docx"
                          hidden
                          ref={(element) => {
                            if (element) fileInputRefs.current.set(template.id, element)
                            else fileInputRefs.current.delete(template.id)
                          }}
                          onChange={(event) => {
                            if (event.target.files?.[0]) {
                              void handleUpload(template.id, event.target.files[0])
                              event.target.value = ''
                            }
                          }}
                        />
                        <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRefs.current.get(template.id)?.click()}>
                          上传 .docx
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/admin/change-doc-templates/${template.id}`)}>
                          配置字段
                        </Button>
                        <Button
                          type="button"
                          variant={template.active ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => toggleMutation.mutate({ id: template.id, active: !template.active })}
                          disabled={toggleMutation.isPending}
                        >
                          {template.active ? '禁用' : '启用'}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      }
    />
  )
}
