'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Card,
  DataManagementPage,
  EmptyState,
  Field,
  Input,
  LoadingState,
  NeutralDialog,
  PageHeader,
  Select,
  StatusBadge,
  Tabs,
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
      handleCreateOpenChange(false)
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

  const handleCreateOpenChange = (open: boolean) => {
    setCreating(open)
    if (!open) {
      setNewName('')
      setNewDesc('')
      setNewDocType('general')
    }
  }

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

  const canWrite = hasPermission('change_doc_template', 'write')

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-change-doc-templates"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="模板管理"
            subtitle="管理 Word 模板文件与字段配置，作为新建变更文档的基础。"
            actions={
              canWrite ? (
                <Button className="cwgsyw-change-doc-templates__create-trigger" type="button" size="sm" onClick={() => handleCreateOpenChange(true)}>
                  新建模板
                </Button>
              ) : undefined
            }
          />
        }
        toolbar={
          <div className="cwgsyw-change-doc-templates__toolbar">
            <div className="cwgsyw-change-doc-templates__mode" aria-label="模板类型">
              <Tabs
                style="cmdb"
                size="sm"
                value={filter}
                onChange={(id) => setFilter(id as 'all' | DocType)}
                items={[
                  { id: 'all', label: `全部 (${templates.length})`, panel: null },
                  { id: 'application', label: `申请单 (${templates.filter((item) => item.docType === 'application').length})`, panel: null },
                  { id: 'plan', label: `方案 (${templates.filter((item) => item.docType === 'plan').length})`, panel: null },
                  { id: 'general', label: `通用 (${templates.filter((item) => item.docType === 'general').length})`, panel: null },
                ]}
              />
            </div>
          </div>
        }
        content={
          isLoading ? (
            <div className="cwgsyw-change-doc-templates__state">
              <LoadingState label="正在加载模板…" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="cwgsyw-change-doc-templates__state">
              <EmptyState
                title={filter === 'all' ? '暂无模板' : `暂无${DOC_TYPE_LABEL[filter]}模板`}
                description="点击右上角新建模板，或上传 Word 文件开始配置字段。"
              />
            </div>
          ) : (
            <div className="cwgsyw-change-doc-templates__grid">
              {filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  title={template.name}
                  description={template.description || `v${template.version} · ${template.fields?.length ?? 0} 个字段`}
                  padding="sm"
                  headerAction={
                    <StatusBadge
                      size="sm"
                      label={DOC_TYPE_LABEL[template.docType ?? 'general']}
                      status={DOC_TYPE_TONE[template.docType ?? 'general']}
                    />
                  }
                  footer={
                    canWrite ? (
                      <div className="cwgsyw-change-doc-templates__actions">
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
                        <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/admin/change-doc-templates/${template.id}`)}>
                          配置字段
                        </Button>
                        <div className="cwgsyw-change-doc-templates__secondary-actions">
                          <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRefs.current.get(template.id)?.click()}>
                            上传 .docx
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleMutation.mutate({ id: template.id, active: !template.active })}
                            disabled={toggleMutation.isPending}
                          >
                            {template.active ? '禁用' : '启用'}
                          </Button>
                        </div>
                      </div>
                    ) : undefined
                  }
                >
                  <div className="cwgsyw-change-doc-templates__meta">
                    <StatusBadge size="sm" label={template.active ? '启用中' : '已禁用'} status={template.active ? 'success' : 'neutral'} />
                    {template.hasDocx ? <StatusBadge size="sm" label="已上传 .docx" status="success" /> : null}
                    <span>{`v${template.version} · ${template.fields?.length ?? 0} 个字段`}</span>
                  </div>
                </Card>
              ))}
            </div>
          )
        }
      />

      <NeutralDialog
        open={creating}
        onOpenChange={handleCreateOpenChange}
        title="新建模板"
        description="填写名称和类型后创建，再配置 Word 字段。"
        size="sm"
        footer={
          <div className="cwgsyw-inline-controls cwgsyw-change-doc-templates__create-dialog-actions">
            <Button type="button" size="sm" variant="secondary" disabled={createMutation.isPending} onClick={() => handleCreateOpenChange(false)}>
              取消
            </Button>
            <Button type="button" size="sm" onClick={() => createMutation.mutate()} disabled={!newName || createMutation.isPending}>
              {createMutation.isPending ? '创建中…' : '创建'}
            </Button>
          </div>
        }
      >
        <div className="cwgsyw-change-doc-templates__create-dialog-form">
          <Field htmlFor="template-name" label="模板名称" required>
            <Input id="template-name" size="sm" value={newName} placeholder="例：网络变更申请单" onChange={(event) => setNewName(event.target.value)} />
          </Field>
          <Field htmlFor="template-desc" label="描述">
            <Input id="template-desc" size="sm" value={newDesc} placeholder="适用场景说明" onChange={(event) => setNewDesc(event.target.value)} />
          </Field>
          <Field htmlFor="template-type" label="类型" required>
            <Select
              size="sm"
              overlay
              value={newDocType}
              aria-label="模板类型"
              options={[
                { value: 'general', label: '通用' },
                { value: 'application', label: '申请单' },
                { value: 'plan', label: '方案' },
              ]}
              onChange={(value) => setNewDocType(value as DocType)}
            />
          </Field>
        </div>
      </NeutralDialog>
    </>
  )
}
