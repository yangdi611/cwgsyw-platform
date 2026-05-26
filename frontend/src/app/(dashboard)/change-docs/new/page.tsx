'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { Sparkles } from 'lucide-react'

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

interface CiSnapshot { id: number; name: string; model_name: string; model_id: string }

export default function NewChangeDocPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateVO | null>(null)
  const [changeNo, setChangeNo] = useState('')
  const [fieldsData, setFieldsData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // ci_selector state
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
    queryFn: () => api.get('/admin/change-doc-templates').then(r => r.data.data),
    enabled: hasPermission('change_doc', 'create'),
  })

  const activeTemplates = templates.filter(t => t.is_active)

  const formFields = selectedTemplate
    ? ([] as FieldConfigVO[]) // will be fetched after selecting template
    : []

  // Fetch template fields when a template is selected — we reuse the template list endpoint
  // but the actual fields come from the detail endpoint
  const { data: templateDetail } = useQuery<{ fields: FieldConfigVO[] }>({
    queryKey: ['change-doc-template-detail', selectedTemplate?.id],
    queryFn: () => api.get(`/admin/change-doc-templates/${selectedTemplate!.id}`).then(r => r.data.data),
    enabled: !!selectedTemplate,
  })

  const fields: FieldConfigVO[] = (templateDetail?.fields ?? formFields).filter(f => f.in_form)

  const { data: ciSearchResult } = useQuery<{ records: { id: number; name: string; model_id: string; model_name: string }[] }>({
    queryKey: ['ci-selector-search', ciSearch],
    queryFn: () => api.get('/cmdb/instances/search', {
      params: { keyword: ciSearch, size: 10 }
    }).then(r => r.data.data),
    enabled: !!ciSelectorOpen && ciSearch.length >= 1,
  })

  const { data: ciTopoResult } = useQuery<{ nodes: { id: number; name: string; model_id: string | null; model_name: string | null; is_root: boolean }[] }>({
    queryKey: ['ci-selector-topo', ciTopoInstanceId],
    queryFn: () => api.get(`/cmdb/topology/${ciTopoInstanceId}`, { params: { depth: 2 } }).then(r => r.data.data),
    enabled: !!ciTopoInstanceId,
  })

  const toggleCiSelection = (fieldKey: string, ci: CiSnapshot) => {
    setSelectedCis(prev => {
      const current = prev[fieldKey] ?? []
      const exists = current.some(c => c.id === ci.id)
      const next = exists ? current.filter(c => c.id !== ci.id) : [...current, ci]
      setFieldsData(fd => ({ ...fd, [fieldKey]: JSON.stringify(next) }))
      return { ...prev, [fieldKey]: next }
    })
  }

  const handleSelectTemplate = (t: TemplateVO) => {
    setSelectedTemplate(t)
    setFieldsData({})
    setStep(2)
  }

  const handleSubmit = async () => {
    // Validate required fields
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
      setFieldsData(prev => ({ ...prev, [f.field_key]: e.target.value }))

    if (f.field_type === 'ci_selector') {
      const selected = selectedCis[f.field_key] ?? []
      return (
        <div key={f.field_key} className="space-y-1.5">
          <Label>{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</Label>

          {/* Selected CI cards */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selected.map(ci => (
                <div key={ci.id} className="flex items-center gap-1.5 border rounded-md px-2 py-1 text-xs bg-muted/30">
                  <span className="font-medium">{ci.name}</span>
                  <span className="text-muted-foreground">({ci.model_name})</span>
                  <button
                    onClick={() => toggleCiSelection(f.field_key, ci)}
                    className="text-muted-foreground hover:text-destructive ml-1"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {ciSelectorOpen === f.field_key ? (
            <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
              <input
                autoFocus
                className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                placeholder="搜索 CI 名称..."
                value={ciSearch}
                onChange={e => { setCiSearch(e.target.value); setCiTopoInstanceId(null) }}
              />

              {/* Search results */}
              {ciSearch.length >= 1 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(ciSearchResult?.records ?? []).map(ci => (
                    <button
                      key={ci.id}
                      onClick={() => {
                        toggleCiSelection(f.field_key, { id: ci.id, name: ci.name, model_id: ci.model_id, model_name: ci.model_name })
                        setCiTopoInstanceId(ci.id)
                        setCiSearch('')
                      }}
                      className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded text-sm hover:bg-muted/50"
                    >
                      <span>{ci.name}</span>
                      <span className="text-xs text-muted-foreground">{ci.model_name}</span>
                    </button>
                  ))}
                  {ciSearchResult !== undefined && (ciSearchResult?.records ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-1">无匹配结果</p>
                  )}
                </div>
              )}

              {/* Topology suggestions */}
              {ciTopoResult && ciTopoResult.nodes.filter(n => !n.is_root).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">关联 CI 建议（2层内）：</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {ciTopoResult.nodes.filter(n => !n.is_root).map(n => {
                      const isSelected = selected.some(c => c.id === n.id)
                      return (
                        <label key={n.id} className="flex items-center gap-2 px-2 py-1 rounded text-sm hover:bg-muted/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCiSelection(f.field_key, {
                              id: n.id,
                              name: n.name,
                              model_id: n.model_id ?? '',
                              model_name: n.model_name ?? n.model_id ?? ''
                            })}
                          />
                          <span>{n.name}</span>
                          <span className="text-xs text-muted-foreground">{n.model_name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={() => { setCiSelectorOpen(null); setCiSearch(''); setCiTopoInstanceId(null) }}
                className="text-xs text-muted-foreground hover:text-foreground"
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
              className="w-full border rounded-md px-3 py-2 text-sm text-left text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              + 添加受影响的 CI
            </button>
          )}
        </div>
      )
    }

    return (
      <div key={f.field_key} className="space-y-1.5">
        <Label>{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</Label>
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
                    size="icon"
                    className="absolute top-1.5 right-1.5 h-6 w-6 opacity-50 cursor-not-allowed"
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
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">新建变更文档</h1>
        <p className="text-sm text-muted-foreground mb-6">请选择变更文档模板</p>
        {templatesLoading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : activeTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无可用模板，请联系管理员创建模板</p>
        ) : (
          <div className="grid gap-3">
            {activeTemplates.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t)}
                className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-muted/50 hover:border-primary transition-colors text-left"
              >
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.has_docx ? '支持 Word 模板导出' : '纯文字模板'}</p>
                </div>
                <span className="text-sm text-muted-foreground">选择 →</span>
              </button>
            ))}
          </div>
        )}
        <Button variant="ghost" className="mt-4" onClick={() => router.back()}>取消</Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => setStep(1)}>← 重新选择模板</Button>
        <h1 className="text-xl font-bold flex-1">新建变更文档</h1>
        <span className="text-sm text-muted-foreground">{selectedTemplate?.name}</span>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>变更编号（可选，留空自动生成）</Label>
          <Input
            value={changeNo}
            onChange={e => setChangeNo(e.target.value)}
            placeholder="CHG-YYYYMMDD-NNN"
          />
        </div>

        {fields.length === 0 && !templateDetail ? (
          <p className="text-sm text-muted-foreground">加载字段中...</p>
        ) : (
          fields.map(renderField)
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '创建中...' : '创建变更'}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>取消</Button>
        </div>
      </div>
    </div>
  )
}
