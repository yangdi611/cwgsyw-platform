'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, StatusBadge } from '@/components/design-system'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import { FileText, FilePlus2 } from 'lucide-react'
import { CiLinkSelector, type CiLinkItem } from '@/components/cmdb/CiLinkSelector'
import type { TableRow } from '@/components/change-doc/tableFieldTypes'
import { FieldList } from '@/components/change-doc/FieldList'
import { DocActionBar } from './components/DocActionBar'
import { PlanTemplatePicker } from './components/PlanTemplatePicker'
import { statusMeta, DOC_TYPE_LABEL, DOC_TYPE_TONE } from './components/types'
import type { ChangeDocVO, LinkedCiInstanceVO, TemplateVO } from './components/types'
import { DetailHeader, FormShell } from '@/components/shared'

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

  const [fieldsData, setFieldsData] = useState<Record<string, unknown>>({})
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
      // Query data is the source for this editable document form.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFieldsData(doc.fieldsData ?? {})
      setTitle(doc.title ?? '')
    }
  }, [doc])

  const isDraft = doc?.status === 'draft'
  const isPlanPending = doc?.status === 'plan_pending'
  const isPending = doc?.status === 'pending'
  const isApproved = doc?.status === 'approved'
  const isRejected = doc?.status === 'rejected'
  const canReedit = isApproved || isRejected
  const appEditable = isDraft || canReedit
  const planEditable = isDraft || isPlanPending || canReedit

  const setField =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFieldsData((f) => ({ ...f, [key]: e.target.value }))

  const setTableField = (key: string) => (rows: TableRow[]) =>
    setFieldsData((f) => ({ ...f, [key]: rows }))

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/change-docs/${id}`, { title: title.trim() || undefined, fieldsData }),
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
      api.put(`/change-docs/${id}`, { planTemplateId }),
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
    // Query data initializes the selector's editable list after each server refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      setFieldsData((f) => ({ ...f, [fieldKey]: res.data.data as string }))
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
      const res = await api.get(`/change-docs/${id}/export?format=${format}&which=${which}`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc?.changeNo ?? 'change-doc'}_${which === 'application' ? '申请单' : '方案'}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const visibleAppFields = useMemo(
    () => (doc?.applicationFieldConfig ?? []).filter((f) => f.inForm).sort((a, b) => a.sortOrder - b.sortOrder),
    [doc],
  )
  const visiblePlanFields = useMemo(
    () => (doc?.planFieldConfig ?? []).filter((f) => f.inForm).sort((a, b) => a.sortOrder - b.sortOrder),
    [doc],
  )

  if (isLoading) return <p className="text-sm text-v2-muted">加载中…</p>
  if (!doc) return <p className="text-sm text-v2-muted">文档不存在</p>

  const st = statusMeta(doc.status)

  return (
    <FormShell width="wide">
      <DetailHeader
        onBack={() => router.back()}
        title={doc.title || doc.changeNo}
        status={<StatusBadge status={st.variant}>{st.label}</StatusBadge>}
        meta={<span className="font-v2-mono">{doc.changeNo}</span>}
      />

      {/* Meta info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>
              变更标题
              {(isDraft || canReedit || isPlanPending) && <span className="ml-1 text-v2-danger">*</span>}
            </Label>
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
          <div className="grid grid-cols-1 gap-3 border-t border-v2-border pt-3 text-sm sm:grid-cols-2 sm:gap-4">
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

      {/* 申请单 */}
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
              <FieldList
                fields={visibleAppFields}
                editable={appEditable}
                fieldsData={fieldsData}
                aiLoadingField={aiLoadingField}
                onFieldChange={setField}
                onTableFieldChange={setTableField}
                onAiGenerate={handleAiGenerate}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* 方案 */}
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
              <FieldList
                fields={visiblePlanFields}
                editable={planEditable}
                fieldsData={fieldsData}
                aiLoadingField={aiLoadingField}
                onFieldChange={setField}
                onTableFieldChange={setTableField}
                onAiGenerate={handleAiGenerate}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* 关联 CI 实例 */}
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

      {/* 审批结果 */}
      {(doc.status === 'approved' || doc.status === 'rejected') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">审批结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
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

      {/* 操作栏 */}
      <Card>
        <CardContent>
          <DocActionBar
            doc={doc}
            isDraft={isDraft}
            isPlanPending={isPlanPending}
            isPending={isPending}
            canReedit={canReedit}
            isApproved={isApproved}
            hasPermission={hasPermission}
            saveMutation={saveMutation}
            submitMutation={submitMutation}
            submitPlanMutation={submitPlanMutation}
            approveMutation={approveMutation}
            approveComment={approveComment}
            onApproveCommentChange={setApproveComment}
            exporting={exporting}
            onExport={handleExport}
          />
        </CardContent>
      </Card>

      {/* 方案模板选择弹层 */}
      <PlanTemplatePicker
        open={planTemplatePickerOpen}
        templates={planTemplateCandidates}
        isPending={setPlanTemplateMutation.isPending}
        onClose={() => setPlanTemplatePickerOpen(false)}
        onSelect={(id) => setPlanTemplateMutation.mutate(id)}
      />
    </FormShell>
  )
}
