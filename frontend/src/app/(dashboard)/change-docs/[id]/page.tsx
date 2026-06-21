'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/v2/Card'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Textarea } from '@/components/v2/Textarea'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { ArrowLeft, Download, Sparkles, Save, Send, Check, X } from 'lucide-react'
import { CiLinkSelector, type CiLinkItem } from '@/components/cmdb/CiLinkSelector'

interface FieldConfigVO {
  id: number
  field_key: string
  label: string
  field_type: string
  required: boolean
  in_form: boolean
  placeholder: string | null
  sort_order: number
}

interface ChangeDocVO {
  id: number
  changeNo: string
  status: string
  templateId: number
  templateName: string
  applicantId: number
  applicantName: string
  applyTime: string
  approvedAt: string | null
  approverId: number | null
  approverName: string | null
  approverComment: string | null
  createdAt: string
  updatedAt: string
  fieldsData: Record<string, string>
  fieldConfig: FieldConfigVO[]
}

interface LinkedCiInstanceVO {
  id: number
  name: string
  modelName: string
  impactLevel?: string
}

type StatusVariant = 'ok' | 'warn' | 'danger' | 'neutral'

function statusMeta(s: string): { variant: StatusVariant; label: string } {
  if (s === 'draft') return { variant: 'neutral', label: '草稿' }
  if (s === 'pending') return { variant: 'warn', label: '待审批' }
  if (s === 'approved') return { variant: 'ok', label: '已通过' }
  if (s === 'rejected') return { variant: 'danger', label: '已拒绝' }
  return { variant: 'neutral', label: s || '未知' }
}

export default function ChangeDocDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: doc, isLoading } = useQuery<ChangeDocVO>({
    queryKey: ['change-doc', id],
    queryFn: () => api.get(`/change-docs/${id}`).then((r) => r.data.data),
    enabled: hasPermission('change_doc', 'read'),
  })

  const [fieldsData, setFieldsData] = useState<Record<string, string>>({})
  const [approveComment, setApproveComment] = useState('')
  const [exporting, setExporting] = useState(false)
  const [aiLoadingField, setAiLoadingField] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('change_doc', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  useEffect(() => {
    if (doc) setFieldsData(doc.fieldsData ?? {})
  }, [doc])

  const isDraft = doc?.status === 'draft'
  const isPending = doc?.status === 'pending'

  const setField =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFieldsData((f) => ({ ...f, [key]: e.target.value }))

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/change-docs/${id}`, { fieldsData }),
    onSuccess: () => {
      toast.success('已保存')
      queryClient.invalidateQueries({ queryKey: ['change-doc', id] })
    },
    onError: () => toast.error('保存失败'),
  })

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/change-docs/${id}/submit`),
    onSuccess: () => {
      toast.success('已提交审批')
      queryClient.invalidateQueries({ queryKey: ['change-doc', id] })
      queryClient.invalidateQueries({ queryKey: ['change-docs'] })
    },
    onError: () => toast.error('提交失败'),
  })

  const approveMutation = useMutation({
    mutationFn: (approved: boolean) =>
      api.post(`/change-docs/${id}/approve`, { approved, comment: approveComment }),
    onSuccess: (_data, approved) => {
      toast.success(approved ? '已审批通过' : '已拒绝')
      queryClient.invalidateQueries({ queryKey: ['change-doc', id] })
      queryClient.invalidateQueries({ queryKey: ['change-docs'] })
    },
    onError: () => toast.error('操作失败'),
  })

  const { data: ciLinksData } = useQuery<LinkedCiInstanceVO[]>({
    queryKey: ['change-doc-ci-links', id],
    queryFn: () => api.get(`/change-docs/${id}/ci-links`).then((r) => r.data.data),
    enabled: hasPermission('change_doc', 'read'),
  })

  const [linkedCiItems, setLinkedCiItems] = useState<Array<CiLinkItem>>([])

  useEffect(() => {
    setLinkedCiItems(
      (ciLinksData ?? []).map((c) => ({
        instanceId: c.id,
        instanceName: c.name,
        modelName: c.modelName,
        impactLevel: c.impactLevel,
      })),
    )
  }, [ciLinksData])

  const addLinkMutation = useMutation({
    mutationFn: (vars: { instanceId: number; impactLevel?: string }) =>
      api.post(`/change-docs/${id}/ci-links`, {
        links: [{ instanceId: vars.instanceId, impactLevel: vars.impactLevel }],
      }),
    onSuccess: () => {
      toast.success('已关联 CI 实例')
      queryClient.invalidateQueries({ queryKey: ['change-doc-ci-links', id] })
    },
    onError: () => toast.error('关联失败'),
  })

  const removeLinkMutation = useMutation({
    mutationFn: (instanceId: number) => api.delete(`/change-docs/${id}/ci-links/${instanceId}`),
    onSuccess: () => {
      toast.success('已取消关联')
      queryClient.invalidateQueries({ queryKey: ['change-doc-ci-links', id] })
    },
    onError: () => toast.error('取消关联失败'),
  })

  const updateImpactMutation = useMutation({
    mutationFn: async (vars: { instanceId: number; impactLevel?: string }) => {
      await api.delete(`/change-docs/${id}/ci-links/${vars.instanceId}`)
      await api.post(`/change-docs/${id}/ci-links`, {
        links: [{ instanceId: vars.instanceId, impactLevel: vars.impactLevel }],
      })
    },
    onSuccess: () => {
      toast.success('已更新影响等级')
      queryClient.invalidateQueries({ queryKey: ['change-doc-ci-links', id] })
    },
    onError: () => toast.error('更新影响等级失败'),
  })

  const handleCiLinksChange = (newItems: Array<CiLinkItem>) => {
    const prev = linkedCiItems
    if (newItems.length > prev.length) {
      const added = newItems.find((n) => !prev.some((p) => p.instanceId === n.instanceId))
      if (added) addLinkMutation.mutate({ instanceId: added.instanceId, impactLevel: added.impactLevel })
    } else if (newItems.length < prev.length) {
      const removed = prev.find((p) => !newItems.some((n) => n.instanceId === p.instanceId))
      if (removed) removeLinkMutation.mutate(removed.instanceId)
    } else {
      const changed = newItems.find((n) => {
        const p = prev.find((pp) => pp.instanceId === n.instanceId)
        return p && p.impactLevel !== n.impactLevel
      })
      if (changed)
        updateImpactMutation.mutate({ instanceId: changed.instanceId, impactLevel: changed.impactLevel })
    }
  }

  const handleAiGenerate = async (fieldKey: string) => {
    setAiLoadingField(fieldKey)
    try {
      const res = await api.post(`/change-docs/${id}/ai-generate`, { fieldKey })
      const generated = res.data.data as string
      setFieldsData((f) => ({ ...f, [fieldKey]: generated }))
      toast.success('AI 内容已生成，请审阅后保存')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'AI 生成失败')
    } finally {
      setAiLoadingField(null)
    }
  }

  const handleExport = async (format: 'pdf' | 'docx') => {
    setExporting(true)
    try {
      const res = await api.get(`/change-docs/${id}/export/${format}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc?.changeNo ?? 'change-doc'}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const visibleFields = (doc?.fieldConfig ?? [])
    .filter((f) => f.in_form)
    .sort((a, b) => a.sort_order - b.sort_order)

  if (isLoading) return <p className="text-sm text-v2-muted">加载中…</p>
  if (!doc) return <p className="text-sm text-v2-muted">文档不存在</p>

  const st = statusMeta(doc.status)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Title bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <div>
            <h1 className="font-v2-mono text-xl font-bold text-v2-fg">{doc.changeNo}</h1>
            <p className="text-sm text-v2-muted">{doc.templateName}</p>
          </div>
        </div>
        <StatusBadge status={st.variant}>{st.label}</StatusBadge>
      </div>

      {/* Meta info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-v2-muted">申请人：</span>
              <span className="text-v2-fg">{doc.applicantName}</span>
            </div>
            <div>
              <span className="text-v2-muted">申请时间：</span>
              <span className="text-v2-fg">{doc.applyTime}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic fields */}
      {visibleFields.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">变更内容</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {visibleFields.map((field) => {
              const value = fieldsData[field.field_key] ?? ''
              const isTextarea = field.field_type === 'textarea'
              return (
                <div key={field.field_key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>
                      {field.label}
                      {field.required && <span className="ml-1 text-v2-danger">*</span>}
                    </Label>
                    {isDraft && isTextarea && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleAiGenerate(field.field_key)}
                        disabled={aiLoadingField === field.field_key}
                      >
                        <Sparkles className="h-3 w-3" />
                        {aiLoadingField === field.field_key ? 'AI 生成中…' : 'AI 生成'}
                      </Button>
                    )}
                  </div>
                  {isDraft ? (
                    isTextarea ? (
                      <Textarea
                        value={value}
                        onChange={setField(field.field_key)}
                        placeholder={field.placeholder ?? undefined}
                        rows={4}
                      />
                    ) : field.field_type === 'date' ? (
                      <Input type="date" value={value} onChange={setField(field.field_key)} />
                    ) : field.field_type === 'datetime' ? (
                      <Input type="datetime-local" value={value} onChange={setField(field.field_key)} />
                    ) : (
                      <Input
                        value={value}
                        onChange={setField(field.field_key)}
                        placeholder={field.placeholder ?? undefined}
                      />
                    )
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-v2-fg">{value || '—'}</p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-v2-muted">此文档无字段配置（旧数据或模板未配置字段）</p>
          </CardContent>
        </Card>
      )}

      {/* Linked CI instances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">关联 CI 实例</CardTitle>
        </CardHeader>
        <CardContent>
          <CiLinkSelector
            value={linkedCiItems}
            onChange={handleCiLinksChange}
            disabled={!hasPermission('change_doc', 'update')}
          />
        </CardContent>
      </Card>

      {/* Approval result */}
      {(doc.status === 'approved' || doc.status === 'rejected') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">审批结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-v2-muted">审批人：</span>
                <span className="text-v2-fg">{doc.approverName}</span>
              </div>
              <div>
                <span className="text-v2-muted">审批时间：</span>
                <span className="text-v2-fg">{doc.approvedAt}</span>
              </div>
            </div>
            {doc.approverComment && (
              <p className="mt-2 text-sm">
                <span className="text-v2-muted">意见：</span>
                <span className="text-v2-fg">{doc.approverComment}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action bar */}
      <Card>
        <CardContent className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              {hasPermission('change_doc', 'update') && (
                <Button
                  variant="primary"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                  保存
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
              >
                <Send className="h-4 w-4" />
                提交审批
              </Button>
            </>
          )}
          {isPending && hasPermission('change_doc', 'approve') && (
            <>
              <Input
                placeholder="审批意见（可选）"
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                className="max-w-xs flex-1"
              />
              <Button
                variant="primary"
                onClick={() => approveMutation.mutate(true)}
                disabled={approveMutation.isPending}
              >
                <Check className="h-4 w-4" />
                审批通过
              </Button>
              <Button
                variant="danger"
                onClick={() => approveMutation.mutate(false)}
                disabled={approveMutation.isPending}
              >
                <X className="h-4 w-4" />
                拒绝
              </Button>
            </>
          )}
          {doc.status === 'approved' && (
            <>
              <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')} disabled={exporting}>
                <Download className="h-4 w-4" />
                导出 PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleExport('docx')} disabled={exporting}>
                <Download className="h-4 w-4" />
                导出 Word
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
