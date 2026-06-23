'use client'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card, CardContent } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Textarea } from '@/components/v2/Textarea'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { Sparkles, ArrowLeft, FileText } from 'lucide-react'

type DocType = 'application' | 'plan' | 'general'

interface TemplateVO {
  id: number
  name: string
  description: string
  has_docx: boolean
  active: boolean
  doc_type: DocType
}

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

interface CiSnapshot {
  id: number
  name: string
  model_name: string
  model_id: string
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

export default function NewChangeDocPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()

  const [step, setStep] = useState<1 | 2>(1)
  const [appTemplate, setAppTemplate] = useState<TemplateVO | null>(null)
  const [planTemplate, setPlanTemplate] = useState<TemplateVO | null>(null)
  const [changeNo, setChangeNo] = useState('')
  const [title, setTitle] = useState('')
  const [fieldsData, setFieldsData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [ciSelectorOpen, setCiSelectorOpen] = useState<string | null>(null)
  const [ciSearch, setCiSearch] = useState('')
  const [ciTopoInstanceId, setCiTopoInstanceId] = useState<number | null>(null)
  const [selectedCis, setSelectedCis] = useState<Record<string, CiSnapshot[]>>({})

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('change_doc', 'create')) router.replace('/change-docs')
  }, [isHydrated, hasPermission, router])

  const { data: templates = [], isLoading: templatesLoading } = useQuery<TemplateVO[]>({
    queryKey: ['change-doc-templates-active'],
    queryFn: () => api.get('/admin/change-doc-templates').then((r) => r.data.data),
    enabled: hasPermission('change_doc', 'create'),
  })

  const activeTemplates = templates.filter((t) => t.active)
  const appTemplates = activeTemplates.filter((t) => t.doc_type === 'application' || t.doc_type === 'general')
  const planTemplates = activeTemplates.filter((t) => t.doc_type === 'plan' || t.doc_type === 'general')

  // 拉两个模板的字段配置
  const { data: appDetail } = useQuery<{ fields: FieldConfigVO[] }>({
    queryKey: ['change-doc-template-detail', appTemplate?.id],
    queryFn: () => api.get(`/admin/change-doc-templates/${appTemplate!.id}`).then((r) => r.data.data),
    enabled: !!appTemplate,
  })

  const { data: planDetail } = useQuery<{ fields: FieldConfigVO[] }>({
    queryKey: ['change-doc-template-detail', planTemplate?.id],
    queryFn: () => api.get(`/admin/change-doc-templates/${planTemplate!.id}`).then((r) => r.data.data),
    enabled: !!planTemplate,
  })

  const appFields: FieldConfigVO[] = useMemo(
    () => (appDetail?.fields ?? []).filter((f) => f.in_form).sort((a, b) => a.sort_order - b.sort_order),
    [appDetail],
  )
  const planFields: FieldConfigVO[] = useMemo(
    () => (planDetail?.fields ?? []).filter((f) => f.in_form).sort((a, b) => a.sort_order - b.sort_order),
    [planDetail],
  )

  const allRequiredFieldKeys = useMemo(() => {
    const keys: { fieldKey: string; label: string }[] = []
    appFields.forEach((f) => f.required && keys.push({ fieldKey: f.field_key, label: f.label }))
    planFields.forEach((f) => f.required && keys.push({ fieldKey: f.field_key, label: f.label }))
    return keys
  }, [appFields, planFields])

  const { data: ciSearchResult } = useQuery<{
    records: { id: number; name: string; model_id: string; model_name: string }[]
  }>({
    queryKey: ['ci-selector-search', ciSearch],
    queryFn: () =>
      api.get('/cmdb/instances/search', { params: { keyword: ciSearch, size: 10 } }).then((r) => r.data.data),
    enabled: !!ciSelectorOpen && ciSearch.length >= 1,
  })

  const { data: ciTopoResult } = useQuery<{
    nodes: { id: number; name: string; model_id: string | null; model_name: string | null; is_root: boolean }[]
  }>({
    queryKey: ['ci-selector-topo', ciTopoInstanceId],
    queryFn: () =>
      api.get(`/cmdb/topology/${ciTopoInstanceId}`, { params: { depth: 2 } }).then((r) => r.data.data),
    enabled: !!ciTopoInstanceId,
  })

  const toggleCiSelection = (fieldKey: string, ci: CiSnapshot) => {
    setSelectedCis((prev) => {
      const current = prev[fieldKey] ?? []
      const exists = current.some((c) => c.id === ci.id)
      const next = exists ? current.filter((c) => c.id !== ci.id) : [...current, ci]
      setFieldsData((fd) => ({ ...fd, [fieldKey]: JSON.stringify(next) }))
      return { ...prev, [fieldKey]: next }
    })
  }

  const handleProceed = () => {
    if (!appTemplate && !planTemplate) {
      toast.error('请至少选择一个模板')
      return
    }
    setFieldsData({})
    setStep(2)
  }

  // 提交策略：
  // - 两个模板都选 → 创建后立刻 submit → 后端走 pending（双模板齐全）
  // - 只选 application → 创建后立刻 submit → 后端走 plan_pending（待补填方案）
  // - 只选 plan → 创建后立刻 submit → 后端走 pending（仅方案场景）
  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('请填写变更标题')
      return
    }
    for (const f of allRequiredFieldKeys) {
      if (!fieldsData[f.fieldKey]?.trim()) {
        toast.error(`"${f.label}" 不能为空`)
        return
      }
    }
    setSubmitting(true)
    try {
      const createRes = await api.post('/change-docs', {
        application_template_id: appTemplate?.id ?? null,
        plan_template_id: planTemplate?.id ?? null,
        title: title.trim(),
        change_no: changeNo.trim() || undefined,
        fields_data: fieldsData,
      })
      const newId = createRes.data.data.id as number
      // 立刻 submit
      await api.post(`/change-docs/${newId}/submit`)
      toast.success(
        appTemplate && !planTemplate
          ? '已提交申请单，请稍后补填方案'
          : '变更文档已提交审批',
      )
      router.push(`/change-docs/${newId}`)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (f: FieldConfigVO) => {
    const value = fieldsData[f.field_key] ?? ''
    const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFieldsData((prev) => ({ ...prev, [f.field_key]: e.target.value }))

    if (f.field_type === 'ci_selector') {
      const selected = selectedCis[f.field_key] ?? []
      return (
        <div key={f.field_key} className="space-y-1.5">
          <Label>
            {f.label}
            {f.required && <span className="ml-1 text-v2-danger">*</span>}
          </Label>
          {selected.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selected.map((ci) => (
                <div
                  key={ci.id}
                  className="inline-flex items-center gap-1 rounded-md bg-v2-primary-soft px-2 py-1 text-xs text-v2-primary"
                >
                  <span className="font-medium">{ci.name}</span>
                  <span className="text-v2-muted">·</span>
                  <span className="text-v2-muted">{ci.model_name}</span>
                  <button
                    type="button"
                    onClick={() => toggleCiSelection(f.field_key, ci)}
                    className="ml-1 hover:text-v2-danger"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              setCiSelectorOpen(f.field_key)
              setCiSearch('')
              setCiTopoInstanceId(null)
            }}
            className="w-full rounded-md border border-dashed border-v2-border bg-v2-surface px-3 py-2 text-left text-sm text-v2-muted transition-colors hover:bg-v2-surface-hover"
          >
            + 添加受影响的 CI
          </button>
        </div>
      )
    }

    return (
      <div key={f.field_key} className="space-y-1.5">
        <Label>
          {f.label}
          {f.required && <span className="ml-1 text-v2-danger">*</span>}
        </Label>
        {f.field_type === 'textarea' ? (
          <div className="relative">
            <Textarea
              value={value}
              onChange={onChange}
              placeholder={f.placeholder ?? undefined}
              rows={3}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-1.5 right-1.5 h-6 w-6 cursor-not-allowed p-0 opacity-50"
              disabled
              tabIndex={-1}
              title="保存草稿后可使用 AI 生成"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : f.field_type === 'date' ? (
          <Input type="date" value={value} onChange={onChange} />
        ) : f.field_type === 'datetime' ? (
          <Input type="datetime-local" value={value} onChange={onChange} />
        ) : (
          <Input value={value} onChange={onChange} placeholder={f.placeholder ?? undefined} />
        )}
      </div>
    )
  }

  // ─── step 1: 模板选择 ────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-v2-fg">新建变更文档</h1>
          <p className="mt-1 text-sm text-v2-muted">
            为变更选择申请单和方案模板（至少选一个）。可在提交后再补填方案。
          </p>
        </div>

        {templatesLoading ? (
          <p className="text-sm text-v2-muted">加载中…</p>
        ) : (
          <>
            {/* 申请单模板 */}
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-v2-fg">变更申请单模板（可选）</h2>
                  {appTemplate && (
                    <Button variant="ghost" size="sm" onClick={() => setAppTemplate(null)}>
                      清除
                    </Button>
                  )}
                </div>
                {appTemplates.length === 0 ? (
                  <p className="text-sm text-v2-muted">暂无申请单类型模板</p>
                ) : (
                  <div className="grid gap-2">
                    {appTemplates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAppTemplate(t)}
                        className={
                          'flex items-center justify-between rounded-v2-md border px-3 py-2 text-left transition-colors ' +
                          (appTemplate?.id === t.id
                            ? 'border-v2-primary bg-v2-primary-soft'
                            : 'border-v2-border bg-v2-surface hover:border-v2-primary-border hover:bg-v2-surface-hover')
                        }
                      >
                        <div className="flex flex-1 items-center gap-2">
                          <FileText className="h-4 w-4 text-v2-muted" />
                          <span className="font-semibold text-v2-fg">{t.name}</span>
                          <StatusBadge status={DOC_TYPE_TONE[t.doc_type]}>
                            {DOC_TYPE_LABEL[t.doc_type]}
                          </StatusBadge>
                          {!t.has_docx && (
                            <span className="text-xs text-v2-muted">纯文字</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 方案模板 */}
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-v2-fg">变更方案模板（可选）</h2>
                  {planTemplate && (
                    <Button variant="ghost" size="sm" onClick={() => setPlanTemplate(null)}>
                      清除
                    </Button>
                  )}
                </div>
                {planTemplates.length === 0 ? (
                  <p className="text-sm text-v2-muted">暂无方案类型模板</p>
                ) : (
                  <div className="grid gap-2">
                    {planTemplates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPlanTemplate(t)}
                        className={
                          'flex items-center justify-between rounded-v2-md border px-3 py-2 text-left transition-colors ' +
                          (planTemplate?.id === t.id
                            ? 'border-v2-primary bg-v2-primary-soft'
                            : 'border-v2-border bg-v2-surface hover:border-v2-primary-border hover:bg-v2-surface-hover')
                        }
                      >
                        <div className="flex flex-1 items-center gap-2">
                          <FileText className="h-4 w-4 text-v2-muted" />
                          <span className="font-semibold text-v2-fg">{t.name}</span>
                          <StatusBadge status={DOC_TYPE_TONE[t.doc_type]}>
                            {DOC_TYPE_LABEL[t.doc_type]}
                          </StatusBadge>
                          {!t.has_docx && (
                            <span className="text-xs text-v2-muted">纯文字</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <div className="flex gap-2">
          <Button variant="primary" onClick={handleProceed} disabled={!appTemplate && !planTemplate}>
            下一步：填写内容
          </Button>
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            取消
          </Button>
        </div>
      </div>
    )
  }

  // ─── step 2: 填表 ────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
          <ArrowLeft className="h-4 w-4" />
          重新选择模板
        </Button>
        <h1 className="flex-1 text-xl font-bold text-v2-fg">新建变更文档</h1>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1.5">
            <Label>
              变更标题<span className="ml-1 text-v2-danger">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：核心交易系统数据库版本升级"
            />
          </div>
          <div className="space-y-1.5">
            <Label>变更编号（可选，留空自动生成）</Label>
            <Input
              value={changeNo}
              onChange={(e) => setChangeNo(e.target.value)}
              placeholder="CHG-YYYYMMDD-NNN"
            />
          </div>
        </CardContent>
      </Card>

      {/* 申请单 Card */}
      {appTemplate && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 border-b border-v2-border pb-2">
              <h2 className="text-base font-bold text-v2-fg">变更申请单</h2>
              <StatusBadge status={DOC_TYPE_TONE.application}>
                {DOC_TYPE_LABEL.application}
              </StatusBadge>
              <span className="text-sm text-v2-muted">{appTemplate.name}</span>
            </div>
            {appFields.length === 0 && !appDetail ? (
              <p className="text-sm text-v2-muted">加载字段中…</p>
            ) : appFields.length === 0 ? (
              <p className="text-sm text-v2-muted">该模板尚未配置表单字段</p>
            ) : (
              appFields.map(renderField)
            )}
          </CardContent>
        </Card>
      )}

      {/* 方案 Card */}
      {planTemplate && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2 border-b border-v2-border pb-2">
              <h2 className="text-base font-bold text-v2-fg">变更方案</h2>
              <StatusBadge status={DOC_TYPE_TONE.plan}>{DOC_TYPE_LABEL.plan}</StatusBadge>
              <span className="text-sm text-v2-muted">{planTemplate.name}</span>
            </div>
            {planFields.length === 0 && !planDetail ? (
              <p className="text-sm text-v2-muted">加载字段中…</p>
            ) : planFields.length === 0 ? (
              <p className="text-sm text-v2-muted">该模板尚未配置表单字段</p>
            ) : (
              planFields.map(renderField)
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
          {submitting
            ? '提交中…'
            : appTemplate && !planTemplate
              ? '提交申请单（稍后补填方案）'
              : '提交审批'}
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>
          取消
        </Button>
      </div>

      {/* CI 选择器 modal */}
      {ciSelectorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setCiSelectorOpen(null)}
        >
          <div
            className="w-full max-w-2xl rounded-v2-md border border-v2-border bg-v2-surface p-4 shadow-v2-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-v2-fg">添加受影响的 CI</h2>
              <Button variant="ghost" size="sm" onClick={() => setCiSelectorOpen(null)}>
                关闭
              </Button>
            </div>
            <Input
              autoFocus
              placeholder="搜索 CI 名称…"
              value={ciSearch}
              onChange={(e) => setCiSearch(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-72 overflow-y-auto">
              {(ciSearchResult?.records ?? []).map((ci) => {
                const selected =
                  (selectedCis[ciSelectorOpen] ?? []).some((c) => c.id === ci.id)
                return (
                  <button
                    key={ci.id}
                    type="button"
                    onClick={() =>
                      toggleCiSelection(ciSelectorOpen, {
                        id: ci.id,
                        name: ci.name,
                        model_name: ci.model_name,
                        model_id: ci.model_id,
                      })
                    }
                    className={
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ' +
                      (selected
                        ? 'bg-v2-primary-soft text-v2-primary'
                        : 'hover:bg-v2-surface-hover')
                    }
                  >
                    <span className="font-medium">{ci.name}</span>
                    <span className="text-xs text-v2-muted">{ci.model_name}</span>
                  </button>
                )
              })}
              {ciSearchResult?.records?.length === 0 && (
                <p className="py-4 text-center text-sm text-v2-muted">未匹配到 CI</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
