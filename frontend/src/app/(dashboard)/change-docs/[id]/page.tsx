'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
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
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import { ArrowLeft, Download, Sparkles, Save, Send, Check, X, FileText, FilePlus2 } from 'lucide-react'
import { CiLinkSelector, type CiLinkItem } from '@/components/cmdb/CiLinkSelector'

type DocType = 'application' | 'plan' | 'general'

interface FieldConfigVO {
  id: number
  fieldKey: string
  label: string
  fieldType: string
  required: boolean
  inForm: boolean
  placeholder: string | null
  sortOrder: number
}

interface ChangeDocVO {
  id: number
  changeNo: string
  title: string
  status: string
  applicationTemplateId: number | null
  applicationTemplateName: string | null
  planTemplateId: number | null
  planTemplateName: string | null
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
  applicationFieldConfig: FieldConfigVO[] | null
  planFieldConfig: FieldConfigVO[] | null
}

interface TemplateVO {
  id: number
  name: string
  docType: DocType
  active: boolean
  hasDocx: boolean
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
  if (s === 'plan_pending') return { variant: 'warn', label: '待补填方案' }
  if (s === 'approved') return { variant: 'ok', label: '已通过' }
  if (s === 'rejected') return { variant: 'danger', label: '已拒绝' }
  return { variant: 'neutral', label: s || '未知' }
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

  useBreadcrumbLabel(doc?.title)

  const [fieldsData, setFieldsData] = useState<Record<string, string>>({})
  const [title, setTitle] = useState('')
  const [approveComment, setApproveComment] = useState('')
  const [exporting, setExporting] = useState(false)
  const [aiLoadingField, setAiLoadingField] = useState<string | null>(null)
  const [planTemplatePickerOpen, setPlanTemplatePickerOpen] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('change_doc', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  useEffect(() => {
    if (doc) {
      setFieldsData(doc.fieldsData ?? {})
      setTitle(doc.title ?? '')
    }
  }, [doc])

  const isDraft = doc?.status === 'draft'
  const isPlanPending = doc?.status === 'plan_pending'
  const isPending = doc?.status === 'pending'
  const isApproved = doc?.status === 'approved'
  const isRejected = doc?.status === 'rejected'
  // approved / rejected → 允许重新编辑（提交后回 draft 重审）
  const canReedit = isApproved || isRejected

  // 在 plan_pending 时只能编辑 plan 字段
  const appEditable = isDraft || canReedit
  const planEditable = isDraft || isPlanPending || canReedit

  const setField =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFieldsData((f) => ({ ...f, [key]: e.target.value }))

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/change-docs/${id}`, {
        title: title.trim() || undefined,
        fieldsData: fieldsData,
      }),
    onSuccess: () => {
      toast.success('已保存')
      queryClient.invalidateQueries({ queryKey: ['change-doc', id] })
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '保存失败')
    },
  })

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/change-docs/${id}/submit`),
    onSuccess: () => {
      toast.success('已提交审批')
      queryClient.invalidateQueries({ queryKey: ['change-doc', id] })
      queryClient.invalidateQueries({ queryKey: ['change-docs'] })
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '提交失败')
    },
  })

  const submitPlanMutation = useMutation({
    mutationFn: () => api.post(`/change-docs/${id}/submit-plan`),
    onSuccess: () => {
      toast.success('方案已提交，进入审批')
      queryClient.invalidateQueries({ queryKey: ['change-doc', id] })
      queryClient.invalidateQueries({ queryKey: ['change-docs'] })
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '提交方案失败')
    },
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

  const setPlanTemplateMutation = useMutation({
    mutationFn: (planTemplateId: number) =>
      api.put(`/change-docs/${id}`, { planTemplateId: planTemplateId }),
    onSuccess: () => {
      toast.success('方案模板已设置')
      setPlanTemplatePickerOpen(false)
      queryClient.invalidateQueries({ queryKey: ['change-doc', id] })
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '设置失败')
    },
  })

  // 拉所有可用的 plan 类模板供补填用
  const { data: allTemplates = [] } = useQuery<TemplateVO[]>({
    queryKey: ['change-doc-templates-active-for-detail'],
    queryFn: () => api.get('/admin/change-doc-templates').then((r) => r.data.data),
    enabled: planTemplatePickerOpen,
  })

  const planTemplateCandidates = useMemo(
    () => allTemplates.filter((t) => t.active && (t.docType === 'plan' || t.docType === 'general')),
    [allTemplates],
  )

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

  const handleExport = async (which: 'application' | 'plan', format: 'pdf' | 'docx') => {
    setExporting(true)
    try {
      const res = await api.get(
        `/change-docs/${id}/export?format=${format}&which=${which}`,
        { responseType: 'blob' },
      )
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      const partLabel = which === 'application' ? '申请单' : '方案'
      a.download = `${doc?.changeNo ?? 'change-doc'}_${partLabel}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const visibleAppFields = useMemo(
    () => (doc?.applicationFieldConfig ?? [])
      .filter((f) => f.inForm)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [doc],
  )
  const visiblePlanFields = useMemo(
    () => (doc?.planFieldConfig ?? [])
      .filter((f) => f.inForm)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [doc],
  )

  if (isLoading) return <p className="text-sm text-v2-muted">加载中…</p>
  if (!doc) return <p className="text-sm text-v2-muted">文档不存在</p>

  const st = statusMeta(doc.status)

  const renderFieldList = (fields: FieldConfigVO[], editable: boolean) =>
    fields.map((field) => {
      const value = fieldsData[field.fieldKey] ?? ''
      const isTextarea = field.fieldType === 'textarea'
      return (
        <div key={field.fieldKey} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>
              {field.label}
              {field.required && <span className="ml-1 text-v2-danger">*</span>}
            </Label>
            {editable && isTextarea && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleAiGenerate(field.fieldKey)}
                disabled={aiLoadingField === field.fieldKey}
              >
                <Sparkles className="h-3 w-3" />
                {aiLoadingField === field.fieldKey ? 'AI 生成中…' : 'AI 生成'}
              </Button>
            )}
          </div>
          {editable ? (
            isTextarea ? (
              <Textarea
                value={value}
                onChange={setField(field.fieldKey)}
                placeholder={field.placeholder ?? undefined}
                rows={4}
              />
            ) : field.fieldType === 'date' ? (
              <Input type="date" value={value} onChange={setField(field.fieldKey)} />
            ) : field.fieldType === 'datetime' ? (
              <Input type="datetime-local" value={value} onChange={setField(field.fieldKey)} />
            ) : (
              <Input
                value={value}
                onChange={setField(field.fieldKey)}
                placeholder={field.placeholder ?? undefined}
              />
            )
          ) : (
            <p className="whitespace-pre-wrap text-sm text-v2-fg">{value || '—'}</p>
          )}
        </div>
      )
    })

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
            <h1 className="text-xl font-bold text-v2-fg">{doc.title || doc.changeNo}</h1>
            <p className="mt-0.5 font-v2-mono text-xs text-v2-muted">{doc.changeNo}</p>
          </div>
        </div>
        <StatusBadge status={st.variant}>{st.label}</StatusBadge>
      </div>

      {/* Meta info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>变更标题{(isDraft || canReedit || isPlanPending) && <span className="ml-1 text-v2-danger">*</span>}</Label>
            {(isDraft || canReedit || isPlanPending) && hasPermission('change_doc', 'update') ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：核心交易系统数据库版本升级"
              />
            ) : (
              <p className="text-sm font-semibold text-v2-fg">{doc.title || '—'}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-v2-border pt-3 text-sm">
            <div>
              <span className="text-v2-muted">申请人：</span>
              <span className="text-v2-fg">{doc.applicantName}</span>
            </div>
            <div>
              <span className="text-v2-muted">申请时间：</span>
              <span className="text-v2-fg">{doc.applyTime}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-v2-border pt-3 text-sm">
            <span className="text-v2-muted">模板：</span>
            {doc.applicationTemplateId ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-v2-border bg-v2-surface-soft px-2 py-1 text-xs">
                <FileText className="h-3 w-3" />
                <StatusBadge status={DOC_TYPE_TONE.application}>{DOC_TYPE_LABEL.application}</StatusBadge>
                {doc.applicationTemplateName}
              </span>
            ) : null}
            {doc.planTemplateId ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-v2-border bg-v2-surface-soft px-2 py-1 text-xs">
                <FileText className="h-3 w-3" />
                <StatusBadge status={DOC_TYPE_TONE.plan}>{DOC_TYPE_LABEL.plan}</StatusBadge>
                {doc.planTemplateName}
              </span>
            ) : isPlanPending && hasPermission('change_doc', 'update') ? (
              <Button variant="secondary" size="sm" onClick={() => setPlanTemplatePickerOpen(true)}>
                <FilePlus2 className="h-3.5 w-3.5" />
                选择方案模板
              </Button>
            ) : (
              <span className="text-xs text-v2-muted">未选择方案模板</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 申请单 Card */}
      {doc.applicationTemplateId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              变更申请单
              <StatusBadge status={DOC_TYPE_TONE.application}>{DOC_TYPE_LABEL.application}</StatusBadge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {visibleAppFields.length === 0 ? (
              <p className="text-sm text-v2-muted">该模板未配置表单字段</p>
            ) : (
              renderFieldList(visibleAppFields, appEditable)
            )}
          </CardContent>
        </Card>
      )}

      {/* 方案 Card */}
      {doc.planTemplateId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              变更方案
              <StatusBadge status={DOC_TYPE_TONE.plan}>{DOC_TYPE_LABEL.plan}</StatusBadge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {visiblePlanFields.length === 0 ? (
              <p className="text-sm text-v2-muted">该模板未配置表单字段</p>
            ) : (
              renderFieldList(visiblePlanFields, planEditable)
            )}
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
          {/* approved / rejected：可修改 → 自动回 draft → 重新提交 */}
          {canReedit && hasPermission('change_doc', 'update') && (
            <>
              <Button
                variant="primary"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4" />
                {isApproved ? '修改并重新审批' : '修改并重新提交'}
              </Button>
              <span className="self-center text-xs text-v2-muted">
                {isApproved
                  ? '保存后将退回草稿状态，需重新提交审批。'
                  : '保存后将退回草稿状态，可重新提交审批。'}
              </span>
            </>
          )}

          {/* draft：保存 + 提交 */}
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
                {doc.applicationTemplateId && !doc.planTemplateId
                  ? '提交申请单（稍后补填方案）'
                  : '提交审批'}
              </Button>
            </>
          )}

          {/* plan_pending：保存方案 + 提交方案 */}
          {isPlanPending && hasPermission('change_doc', 'update') && (
            <>
              <Button
                variant="primary"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4" />
                保存方案
              </Button>
              <Button
                variant="secondary"
                onClick={() => submitPlanMutation.mutate()}
                disabled={submitPlanMutation.isPending || !doc.planTemplateId}
              >
                <Send className="h-4 w-4" />
                提交方案
              </Button>
            </>
          )}

          {/* pending：审批 */}
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

          {/* approved：分别导出申请单 / 方案 */}
          {doc.status === 'approved' && (
            <>
              {doc.applicationTemplateId && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExport('application', 'pdf')}
                    disabled={exporting}
                  >
                    <Download className="h-4 w-4" />
                    导出申请单 PDF
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExport('application', 'docx')}
                    disabled={exporting}
                  >
                    <Download className="h-4 w-4" />
                    导出申请单 Word
                  </Button>
                </>
              )}
              {doc.planTemplateId && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExport('plan', 'pdf')}
                    disabled={exporting}
                  >
                    <Download className="h-4 w-4" />
                    导出方案 PDF
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExport('plan', 'docx')}
                    disabled={exporting}
                  >
                    <Download className="h-4 w-4" />
                    导出方案 Word
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 方案模板选择 modal */}
      {planTemplatePickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setPlanTemplatePickerOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-v2-md border border-v2-border bg-v2-surface p-4 shadow-v2-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-v2-fg">选择方案模板</h2>
              <Button variant="ghost" size="sm" onClick={() => setPlanTemplatePickerOpen(false)}>
                关闭
              </Button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {planTemplateCandidates.length === 0 && (
                <p className="py-4 text-center text-sm text-v2-muted">暂无可用方案模板</p>
              )}
              {planTemplateCandidates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPlanTemplateMutation.mutate(t.id)}
                  disabled={setPlanTemplateMutation.isPending}
                  className="flex w-full items-center gap-2 rounded-v2-md border border-v2-border bg-v2-surface px-3 py-2 text-left text-sm transition-colors hover:border-v2-primary-border hover:bg-v2-surface-hover"
                >
                  <FileText className="h-4 w-4 text-v2-muted" />
                  <span className="font-semibold text-v2-fg">{t.name}</span>
                  <StatusBadge status={DOC_TYPE_TONE[t.docType]}>
                    {DOC_TYPE_LABEL[t.docType]}
                  </StatusBadge>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
