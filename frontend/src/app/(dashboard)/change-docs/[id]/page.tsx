'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import { CiLinkSelector, type CiLinkItem } from '@/components/cmdb/CiLinkSelector'
import type { TableRow } from '@/components/change-doc/tableFieldTypes'
import { FieldList } from '@/components/change-doc/FieldList'
import { DocActionBar } from './components/DocActionBar'
import { PlanTemplatePicker } from './components/PlanTemplatePicker'
import { DOC_TYPE_LABEL, DOC_TYPE_TONE, statusMeta } from './components/types'
import type { ChangeDocVO, LinkedCiInstanceVO, TemplateVO } from './components/types'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Card,
  EmptyState,
  Field,
  FormSettingsPage,
  Input,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

const STATUS_TONE = {
  ok: 'success',
  warn: 'warning',
  danger: 'danger',
  neutral: 'neutral',
} as const

const DOC_TONE = {
  ok: 'success',
  warn: 'warning',
  neutral: 'neutral',
} as const

export default function ChangeDocDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: doc, isLoading } = useQuery<ChangeDocVO>({
    queryKey: ['change-doc', id],
    queryFn: () => api.get(`/change-docs/${id}`).then((response) => response.data.data),
    enabled: hasPermission('change_doc', 'read'),
  })

  useBreadcrumbLabel(doc?.title)

  const [fieldsData, setFieldsData] = useState<Record<string, unknown>>({})
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
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
      setTitleTouched(false)
    }
  }, [doc])

  const displayedTitle = titleTouched ? title : (doc?.title ?? title)
  const displayedFieldsData = { ...(doc?.fieldsData ?? {}), ...fieldsData }

  const isDraft = doc?.status === 'draft'
  const isPlanPending = doc?.status === 'plan_pending'
  const isPending = doc?.status === 'pending'
  const isApproved = doc?.status === 'approved'
  const isRejected = doc?.status === 'rejected'
  const canReedit = isApproved || isRejected
  const appEditable = isDraft || canReedit
  const planEditable = isDraft || isPlanPending || canReedit

  const setField =
    (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFieldsData((current) => ({ ...current, [key]: event.target.value }))

  const setTableField = (key: string) => (rows: TableRow[]) =>
    setFieldsData((current) => ({ ...current, [key]: rows }))

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/change-docs/${id}`, { title: displayedTitle.trim() || undefined, fieldsData: displayedFieldsData }),
    onSuccess: () => {
      toast.success('已保存')
      queryClient.invalidateQueries({ queryKey: ['change-doc', id] })
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
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
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
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
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
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
    mutationFn: (planTemplateId: number) => api.put(`/change-docs/${id}`, { planTemplateId }),
    onSuccess: () => {
      toast.success('方案模板已设置')
      setPlanTemplatePickerOpen(false)
      queryClient.invalidateQueries({ queryKey: ['change-doc', id] })
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '设置失败')
    },
  })

  const { data: allTemplates = [] } = useQuery<TemplateVO[]>({
    queryKey: ['change-doc-templates-active-for-detail'],
    queryFn: () => api.get('/admin/change-doc-templates').then((response) => response.data.data),
    enabled: planTemplatePickerOpen,
  })

  const planTemplateCandidates = useMemo(
    () => allTemplates.filter((item) => item.active && (item.docType === 'plan' || item.docType === 'general')),
    [allTemplates],
  )

  const { data: ciLinksData } = useQuery<LinkedCiInstanceVO[]>({
    queryKey: ['change-doc-ci-links', id],
    queryFn: () => api.get(`/change-docs/${id}/ci-links`).then((response) => response.data.data),
    enabled: hasPermission('change_doc', 'read'),
  })

  const [linkedCiItems, setLinkedCiItems] = useState<Array<CiLinkItem>>([])

  useEffect(() => {
    // Query data initializes the selector's editable list after each server refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLinkedCiItems(
      (ciLinksData ?? []).map((item) => ({
        instanceId: item.id,
        instanceName: item.name,
        modelName: item.modelName,
        impactLevel: item.impactLevel,
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
      const added = newItems.find((item) => !prev.some((current) => current.instanceId === item.instanceId))
      if (added) addLinkMutation.mutate({ instanceId: added.instanceId, impactLevel: added.impactLevel })
    } else if (newItems.length < prev.length) {
      const removed = prev.find((item) => !newItems.some((current) => current.instanceId === item.instanceId))
      if (removed) removeLinkMutation.mutate(removed.instanceId)
    } else {
      const changed = newItems.find((item) => {
        const previous = prev.find((current) => current.instanceId === item.instanceId)
        return previous && previous.impactLevel !== item.impactLevel
      })
      if (changed) updateImpactMutation.mutate({ instanceId: changed.instanceId, impactLevel: changed.impactLevel })
    }
  }

  const handleAiGenerate = async (fieldKey: string) => {
    setAiLoadingField(fieldKey)
    try {
      const response = await api.post(`/change-docs/${id}/ai-generate`, { fieldKey })
      setFieldsData((current) => ({ ...current, [fieldKey]: response.data.data as string }))
      toast.success('AI 内容已生成，请审阅后保存')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'AI 生成失败')
    } finally {
      setAiLoadingField(null)
    }
  }

  const handleExport = async (which: 'application' | 'plan', format: 'pdf' | 'docx') => {
    setExporting(true)
    try {
      const response = await api.get(`/change-docs/${id}/export?format=${format}&which=${which}`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${doc?.changeNo ?? 'change-doc'}_${which === 'application' ? '申请单' : '方案'}.${format}`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const visibleAppFields = useMemo(
    () => (doc?.applicationFieldConfig ?? []).filter((field) => field.inForm).sort((left, right) => left.sortOrder - right.sortOrder),
    [doc],
  )
  const visiblePlanFields = useMemo(
    () => (doc?.planFieldConfig ?? []).filter((field) => field.inForm).sort((left, right) => left.sortOrder - right.sortOrder),
    [doc],
  )

  if (isLoading) return <LoadingState label="正在加载变更文档…" />
  if (!doc) return <EmptyState title="文档不存在" description="该变更文档不存在或已被删除。" />

  const status = statusMeta(doc.status)

  return (
    <>
      <FormSettingsPage
        embedded
        header={
          <PageHeader
            eyebrow="变更文档"
            title={doc.title || doc.changeNo}
            subtitle={doc.changeNo}
            breadcrumb={
              <Breadcrumb
                items={[
                  { href: '/', label: '工作台' },
                  { href: '/change-docs', label: '变更文档' },
                  { label: doc.title || doc.changeNo },
                ]}
              />
            }
            status={<StatusBadge label={status.label} status={STATUS_TONE[status.variant]} />}
          />
        }
        form={
          <div className="cwgsyw-form">
            <Card title="基本信息">
              <div className="cwgsyw-form">
                {(isDraft || canReedit || isPlanPending) && hasPermission('change_doc', 'update') ? (
                  <Field htmlFor="change-title" label="变更标题" required>
                    <Input
                      value={displayedTitle}
                      placeholder="例如：核心交易系统数据库版本升级"
                      onChange={(event) => {
                        setTitle(event.target.value)
                        setTitleTouched(true)
                      }}
                    />
                  </Field>
                ) : (
                  <Field htmlFor="change-title-readonly" label="变更标题">
                    <p>{doc.title || '—'}</p>
                  </Field>
                )}
                <dl className="cwgsyw-permission-grid">
                  <div>
                    <dt>申请人</dt>
                    <dd>{doc.applicantName}</dd>
                  </div>
                  <div>
                    <dt>申请时间</dt>
                    <dd>{doc.applyTime}</dd>
                  </div>
                </dl>
                <div className="cwgsyw-designer__actions">
                  <span>模板：</span>
                  {doc.applicationTemplateId ? (
                    <>
                      <StatusBadge label={DOC_TYPE_LABEL.application} status={DOC_TONE[DOC_TYPE_TONE.application]} />
                      <span>{doc.applicationTemplateName}</span>
                    </>
                  ) : null}
                  {doc.planTemplateId ? (
                    <>
                      <StatusBadge label={DOC_TYPE_LABEL.plan} status={DOC_TONE[DOC_TYPE_TONE.plan]} />
                      <span>{doc.planTemplateName}</span>
                    </>
                  ) : isPlanPending && hasPermission('change_doc', 'update') ? (
                    <Button type="button" variant="secondary" size="sm" onClick={() => setPlanTemplatePickerOpen(true)}>
                      选择方案模板
                    </Button>
                  ) : (
                    <span>未选择方案模板</span>
                  )}
                </div>
              </div>
            </Card>

            {doc.applicationTemplateId ? (
              <Card
                title="变更申请单"
                headerAction={<StatusBadge label={DOC_TYPE_LABEL.application} status={DOC_TONE[DOC_TYPE_TONE.application]} />}
              >
                {visibleAppFields.length === 0 ? (
                  <p>该模板未配置表单字段</p>
                ) : (
                  <FieldList
                    fields={visibleAppFields}
                    editable={appEditable}
                    fieldsData={displayedFieldsData}
                    aiLoadingField={aiLoadingField}
                    onFieldChange={setField}
                    onTableFieldChange={setTableField}
                    onAiGenerate={handleAiGenerate}
                  />
                )}
              </Card>
            ) : null}

            {doc.planTemplateId ? (
              <Card
                title="变更方案"
                headerAction={<StatusBadge label={DOC_TYPE_LABEL.plan} status={DOC_TONE[DOC_TYPE_TONE.plan]} />}
              >
                {visiblePlanFields.length === 0 ? (
                  <p>该模板未配置表单字段</p>
                ) : (
                  <FieldList
                    fields={visiblePlanFields}
                    editable={planEditable}
                    fieldsData={displayedFieldsData}
                    aiLoadingField={aiLoadingField}
                    onFieldChange={setField}
                    onTableFieldChange={setTableField}
                    onAiGenerate={handleAiGenerate}
                  />
                )}
              </Card>
            ) : null}

            <Card title="关联 CI 实例">
              <CiLinkSelector
                value={linkedCiItems}
                onChange={handleCiLinksChange}
                disabled={!hasPermission('change_doc', 'update')}
              />
            </Card>

            {(doc.status === 'approved' || doc.status === 'rejected') ? (
              <Card title="审批结果">
                <dl className="cwgsyw-permission-grid">
                  <div>
                    <dt>审批人</dt>
                    <dd>{doc.approverName}</dd>
                  </div>
                  <div>
                    <dt>审批时间</dt>
                    <dd>{doc.approvedAt}</dd>
                  </div>
                </dl>
                {doc.approverComment ? <p>意见：{doc.approverComment}</p> : null}
              </Card>
            ) : null}

            <Card title="操作">
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
            </Card>
          </div>
        }
      />
      <PlanTemplatePicker
        open={planTemplatePickerOpen}
        templates={planTemplateCandidates}
        isPending={setPlanTemplateMutation.isPending}
        onClose={() => setPlanTemplatePickerOpen(false)}
        onSelect={(templateId) => setPlanTemplateMutation.mutate(templateId)}
      />
    </>
  )
}
