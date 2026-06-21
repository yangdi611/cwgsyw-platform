'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card, CardContent } from '@/components/v2/Card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { Sparkles, ArrowLeft, ChevronRight } from 'lucide-react'

interface TemplateVO {
  id: number
  name: string
  has_docx: boolean
  is_active: boolean
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

export default function NewChangeDocPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateVO | null>(null)
  const [changeNo, setChangeNo] = useState('')
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

  const activeTemplates = templates.filter((t) => t.is_active)

  const { data: templateDetail } = useQuery<{ fields: FieldConfigVO[] }>({
    queryKey: ['change-doc-template-detail', selectedTemplate?.id],
    queryFn: () =>
      api.get(`/admin/change-doc-templates/${selectedTemplate!.id}`).then((r) => r.data.data),
    enabled: !!selectedTemplate,
  })

  const fields: FieldConfigVO[] = (templateDetail?.fields ?? []).filter((f) => f.in_form)

  const { data: ciSearchResult } = useQuery<{
    records: { id: number; name: string; model_id: string; model_name: string }[]
  }>({
    queryKey: ['ci-selector-search', ciSearch],
    queryFn: () =>
      api
        .get('/cmdb/instances/search', { params: { keyword: ciSearch, size: 10 } })
        .then((r) => r.data.data),
    enabled: !!ciSelectorOpen && ciSearch.length >= 1,
  })

  const { data: ciTopoResult } = useQuery<{
    nodes: {
      id: number
      name: string
      model_id: string | null
      model_name: string | null
      is_root: boolean
    }[]
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

  const handleSelectTemplate = (t: TemplateVO) => {
    setSelectedTemplate(t)
    setFieldsData({})
    setStep(2)
  }

  const handleSubmit = async () => {
    for (const f of fields) {
      if (f.required && !fieldsData[f.field_key]?.trim()) {
        toast.error(`"${f.label}" 不能为空`)
        return
      }
    }
    setSubmitting(true)
    try {
      const res = await api.post('/change-docs', {
        templateId: selectedTemplate!.id,
        changeNo: changeNo.trim() || undefined,
        fieldsData,
      })
      toast.success('变更文档已创建')
      router.push(`/change-docs/${res.data.data.id}`)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '创建失败')
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
                  className="flex items-center gap-1.5 rounded-md border border-v2-border bg-v2-surface-soft px-2 py-1 text-xs"
                >
                  <span className="font-medium text-v2-fg">{ci.name}</span>
                  <span className="text-v2-muted">({ci.model_name})</span>
                  <button
                    onClick={() => toggleCiSelection(f.field_key, ci)}
                    className="ml-1 text-v2-muted hover:text-v2-danger"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {ciSelectorOpen === f.field_key ? (
            <div className="space-y-2 rounded-v2-md border border-v2-border bg-v2-surface-soft p-3">
              <input
                autoFocus
                className="w-full rounded-md border border-v2-border bg-v2-surface px-3 py-1.5 text-sm"
                placeholder="搜索 CI 名称…"
                value={ciSearch}
                onChange={(e) => {
                  setCiSearch(e.target.value)
                  setCiTopoInstanceId(null)
                }}
              />

              {ciSearch.length >= 1 && (
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {(ciSearchResult?.records ?? []).map((ci) => (
                    <button
                      key={ci.id}
                      onClick={() => {
                        toggleCiSelection(f.field_key, {
                          id: ci.id,
                          name: ci.name,
                          model_id: ci.model_id,
                          model_name: ci.model_name,
                        })
                        setCiTopoInstanceId(ci.id)
                        setCiSearch('')
                      }}
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-v2-surface-hover"
                    >
                      <span className="text-v2-fg">{ci.name}</span>
                      <span className="text-xs text-v2-muted">{ci.model_name}</span>
                    </button>
                  ))}
                  {ciSearchResult !== undefined && (ciSearchResult?.records ?? []).length === 0 && (
                    <p className="px-2 py-1 text-xs text-v2-muted">无匹配结果</p>
                  )}
                </div>
              )}

              {ciTopoResult && ciTopoResult.nodes.filter((n) => !n.is_root).length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-v2-muted">关联 CI 建议（2层内）：</p>
                  <div className="max-h-32 space-y-1 overflow-y-auto">
                    {ciTopoResult.nodes
                      .filter((n) => !n.is_root)
                      .map((n) => {
                        const isSelected = selected.some((c) => c.id === n.id)
                        return (
                          <label
                            key={n.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-v2-surface-hover"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                toggleCiSelection(f.field_key, {
                                  id: n.id,
                                  name: n.name,
                                  model_id: n.model_id ?? '',
                                  model_name: n.model_name ?? n.model_id ?? '',
                                })
                              }
                            />
                            <span className="text-v2-fg">{n.name}</span>
                            <span className="text-xs text-v2-muted">{n.model_name}</span>
                          </label>
                        )
                      })}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setCiSelectorOpen(null)
                  setCiSearch('')
                  setCiTopoInstanceId(null)
                }}
                className="text-xs text-v2-muted hover:text-v2-fg"
              >
                收起
              </button>
            </div>
          ) : (
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
          )}
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

  if (step === 1) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-v2-fg">新建变更文档</h1>
          <p className="mt-1 text-sm text-v2-muted">请选择变更文档模板</p>
        </div>
        {templatesLoading ? (
          <p className="text-sm text-v2-muted">加载中…</p>
        ) : activeTemplates.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-v2-muted">暂无可用模板，请联系管理员创建模板</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {activeTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t)}
                className="flex items-center justify-between rounded-v2-md border border-v2-border bg-v2-surface px-4 py-3 text-left transition-colors hover:border-v2-primary-border hover:bg-v2-surface-hover"
              >
                <div>
                  <p className="font-semibold text-v2-fg">{t.name}</p>
                  <p className="mt-0.5 text-xs text-v2-muted">
                    {t.has_docx ? '支持 Word 模板导出' : '纯文字模板'}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-sm font-semibold text-v2-primary">
                  选择 <ChevronRight className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        )}
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          取消
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
          <ArrowLeft className="h-4 w-4" />
          重新选择模板
        </Button>
        <h1 className="flex-1 text-xl font-bold text-v2-fg">新建变更文档</h1>
        <span className="text-sm text-v2-muted">{selectedTemplate?.name}</span>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1.5">
            <Label>变更编号（可选，留空自动生成）</Label>
            <Input
              value={changeNo}
              onChange={(e) => setChangeNo(e.target.value)}
              placeholder="CHG-YYYYMMDD-NNN"
            />
          </div>

          {fields.length === 0 && !templateDetail ? (
            <p className="text-sm text-v2-muted">加载字段中…</p>
          ) : (
            fields.map(renderField)
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '创建中…' : '创建变更'}
            </Button>
            <Button variant="secondary" onClick={() => router.back()}>
              取消
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
