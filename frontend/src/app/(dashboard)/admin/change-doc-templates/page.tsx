'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { PageHeader, EmptyState } from '@/components/shared'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Upload, Settings, FileText } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

type DocType = 'application' | 'plan' | 'general'

interface TemplateVO {
  id: number
  name: string
  description: string
  version: number
  active: boolean
  has_docx: boolean
  doc_type: DocType
  fields: { id: number; field_key: string; label: string }[]
  created_at: string
}

const DOC_TYPE_LABEL: Record<DocType, string> = {
  application: '申请单',
  plan: '方案',
  general: '通用',
}

const DOC_TYPE_TONE: Record<DocType, 'ok' | 'warn' | 'neutral'> = {
  application: 'ok',
  plan: 'warn',
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
    queryFn: () => api.get('/admin/change-doc-templates').then((r) => r.data.data),
    enabled: hasPermission('change_doc_template', 'read'),
  })

  const filteredTemplates = filter === 'all'
    ? templates
    : templates.filter((t) => t.doc_type === filter)

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(
        `/admin/change-doc-templates?name=${encodeURIComponent(newName)}` +
        `&description=${encodeURIComponent(newDesc ?? '')}` +
        `&docType=${newDocType}`,
      ),
    onSuccess: (res) => {
      toast.success('模板已创建')
      queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] })
      setCreating(false)
      setNewName('')
      setNewDesc('')
      setNewDocType('general')
      router.push(`/admin/change-doc-templates/${res.data.data.id}`)
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
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post(`/admin/change-doc-templates/${templateId}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await api.post(`/admin/change-doc-templates/${templateId}/parse-bookmarks`)
      toast.success('模板文件已上传，书签已解析')
      queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '上传失败')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="变更文档"
        title="模板管理"
        subtitle="管理 Word 模板文件与字段配置，作为新建变更文档的基础。每个模板按类型（申请单 / 方案 / 通用）使用。"
        actions={
          hasPermission('change_doc_template', 'write') ? (
            <Button variant="primary" onClick={() => setCreating((v) => !v)}>
              <Plus className="h-4 w-4" />
              新建模板
            </Button>
          ) : undefined
        }
      />

      {/* 类型筛选 */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'application', 'plan', 'general'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={
              'inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-v2-md border transition-colors ' +
              (filter === k
                ? 'border-v2-primary bg-v2-primary-soft text-v2-primary'
                : 'border-v2-border bg-v2-surface text-v2-muted hover:bg-v2-surface-hover')
            }
          >
            {k === 'all' ? `全部 (${templates.length})` :
              `${DOC_TYPE_LABEL[k]} (${templates.filter((t) => t.doc_type === k).length})`}
          </button>
        ))}
      </div>

      {creating && (
        <Card className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">模板名称 *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例：网络变更申请单"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">描述</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="适用场景说明"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">类型 *</Label>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value as DocType)}
                className="h-9 w-full rounded-v2-md border border-v2-border bg-v2-surface px-3 text-sm text-v2-fg focus:border-v2-primary focus:outline-none"
              >
                <option value="general">通用</option>
                <option value="application">申请单</option>
                <option value="plan">方案</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={!newName || createMutation.isPending}
            >
              创建
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              取消
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? null : filteredTemplates.length === 0 && !creating ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-5 w-5 text-v2-muted" />}
            title={filter === 'all' ? '暂无模板' : `暂无${DOC_TYPE_LABEL[filter as DocType]}模板`}
            description="点击右上角新建模板，或上传 Word 文件开始配置字段。"
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTemplates.map((tpl) => (
            <Card key={tpl.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-v2-fg">{tpl.name}</span>
                    <StatusBadge status={DOC_TYPE_TONE[tpl.doc_type ?? 'general']}>
                      {DOC_TYPE_LABEL[tpl.doc_type ?? 'general']}
                    </StatusBadge>
                    <StatusBadge status={tpl.active ? 'ok' : 'neutral'}>
                      {tpl.active ? '启用中' : '已禁用'}
                    </StatusBadge>
                    {tpl.has_docx && (
                      <span className="inline-flex items-center rounded-md border border-v2-success-border bg-v2-success-soft px-2 py-0.5 text-xs font-medium text-v2-success">
                        已上传 .docx
                      </span>
                    )}
                    <span className="text-xs text-v2-muted">
                      v{tpl.version} · {tpl.fields?.length ?? 0} 个字段
                    </span>
                  </div>
                  {tpl.description && (
                    <p className="mt-1 text-sm text-v2-muted">{tpl.description}</p>
                  )}
                </div>

                {hasPermission('change_doc_template', 'write') && (
                  <div className="flex shrink-0 gap-2">
                    <input
                      type="file"
                      accept=".docx"
                      className="hidden"
                      ref={(el) => {
                        if (el) fileInputRefs.current.set(tpl.id, el)
                        else fileInputRefs.current.delete(tpl.id)
                      }}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleUpload(tpl.id, e.target.files[0])
                          // 同一个文件再次上传需要 reset
                          e.target.value = ''
                        }
                      }}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => fileInputRefs.current.get(tpl.id)?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      上传 .docx
                    </Button>
                    <Link
                      href={`/admin/change-doc-templates/${tpl.id}`}
                      className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-v2-md border border-v2-border bg-v2-surface text-v2-fg shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
                    >
                      <Settings className="h-4 w-4" />
                      配置字段
                    </Link>
                    <Button
                      variant={tpl.active ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => toggleMutation.mutate({ id: tpl.id, active: !tpl.active })}
                      disabled={toggleMutation.isPending}
                    >
                      {tpl.active ? '禁用' : '启用'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
