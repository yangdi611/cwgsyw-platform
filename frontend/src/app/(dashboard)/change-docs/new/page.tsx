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

export default function NewChangeDocPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateVO | null>(null)
  const [changeNo, setChangeNo] = useState('')
  const [fieldsData, setFieldsData] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!hasPermission('change_doc', 'create')) router.replace('/change-docs')
  }, [hasPermission, router])

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
