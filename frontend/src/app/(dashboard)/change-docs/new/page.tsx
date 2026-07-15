'use client'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card, CardContent } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { Sparkles, ArrowLeft } from 'lucide-react'
import type { TableRow, FieldConfigVO } from '@/components/change-doc/tableFieldTypes'
import { FieldList } from '@/components/change-doc/FieldList'
import { TemplateSelector } from './components/TemplateSelector'
import { CiSelectorModal } from './components/CiSelectorModal'
import type { TemplateVO, CiSnapshot } from './components/types'

export default function NewChangeDocPage() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()

  const [step, setStep] = useState<1 | 2>(1)
  const [selectedAppTemplateId, setSelectedAppTemplateId] = useState<number | null>(null)
  const [selectedPlanTemplateId, setSelectedPlanTemplateId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [fieldsData, setFieldsData] = useState<Record<string, unknown>>({})
  const [selectedCis, setSelectedCis] = useState<CiSnapshot[]>([])
  const [ciSelectorOpen, setCiSelectorOpen] = useState(false)
  const [aiLoadingField, setAiLoadingField] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('change_doc', 'create')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: templates = [] } = useQuery<TemplateVO[]>({
    queryKey: ['change-doc-templates-active'],
    queryFn: () => api.get('/admin/change-doc-templates').then((r) => r.data.data),
  })

  const selectedAppTemplate = useMemo(
    () => templates.find((t) => t.id === selectedAppTemplateId),
    [templates, selectedAppTemplateId],
  )
  const selectedPlanTemplate = useMemo(
    () => templates.find((t) => t.id === selectedPlanTemplateId),
    [templates, selectedPlanTemplateId],
  )

  const appFields = useMemo(() => {
    if (!selectedAppTemplate) return []
    return ((selectedAppTemplate as { fieldConfig?: FieldConfigVO[] }).fieldConfig ?? [])
      .filter((f) => f.inForm)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [selectedAppTemplate])

  const planFields = useMemo(() => {
    if (!selectedPlanTemplate) return []
    return ((selectedPlanTemplate as { fieldConfig?: FieldConfigVO[] }).fieldConfig ?? [])
      .filter((f) => f.inForm)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [selectedPlanTemplate])

  const allRequiredFieldKeys = useMemo(() => {
    const keys: string[] = []
    appFields.forEach((f) => f.required && keys.push(f.fieldKey))
    planFields.forEach((f) => f.required && keys.push(f.fieldKey))
    return keys
  }, [appFields, planFields])

  const handleProceed = () => {
    if (!selectedAppTemplateId && !selectedPlanTemplateId) {
      toast.error('请至少选择一个模板')
      return
    }
    const defaults = [...appFields, ...planFields].reduce<Record<string, unknown>>((result, field) => {
      const config = field.config as { defaultValue?: unknown } | undefined
      if (config?.defaultValue !== undefined) result[field.fieldKey] = config.defaultValue
      return result
    }, {})
    setFieldsData((current) => ({ ...defaults, ...current }))
    setStep(2)
  }

  const setField = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFieldsData((f) => ({ ...f, [key]: e.target.value }))

  const setTableField = (key: string) => (rows: TableRow[]) =>
    setFieldsData((f) => ({ ...f, [key]: rows }))

  const toggleCiSelection = (ci: CiSnapshot) => {
    setSelectedCis((prev) =>
      prev.some((s) => s.instanceId === ci.instanceId)
        ? prev.filter((s) => s.instanceId !== ci.instanceId)
        : [...prev, ci],
    )
  }

  const handleAiGenerate = async (fieldKey: string) => {
    setAiLoadingField(fieldKey)
    try {
      const res = await api.post('/change-docs/ai-generate-new', { fieldKey, fieldsData })
      setFieldsData((f) => ({ ...f, [fieldKey]: res.data.data as string }))
      toast.success('AI 内容已生成，请审阅后提交')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'AI 生成失败')
    } finally {
      setAiLoadingField(null)
    }
  }

  const handleSubmit = async () => {
    const missingKeys = allRequiredFieldKeys.filter((k) => {
      const v = fieldsData[k]
      return v === undefined || v === null || v === ''
    })
    if (missingKeys.length > 0) {
      toast.error('请填写所有必填字段')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/change-docs', {
        title: title.trim() || undefined,
        applicationTemplateId: selectedAppTemplateId,
        planTemplateId: selectedPlanTemplateId,
        fieldsData,
        ciSnapshots: selectedCis,
      })
      const docId = res.data.data as number
      toast.success('变更文档已创建')
      router.push(`/change-docs/${docId}`)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (step === 1 ? router.back() : setStep(1))}
          className="inline-flex h-9 items-center gap-1.5 rounded-v2-md px-3 text-sm font-semibold text-v2-muted transition-colors hover:bg-v2-surface-hover hover:text-v2-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 1 ? '返回' : '上一步'}
        </button>
        <div>
          <h1 className="text-xl font-bold text-v2-fg">新建变更文档</h1>
          <p className="mt-0.5 text-xs text-v2-muted">
            {step === 1 ? '第 1 步：选择模板' : '第 2 步：填写内容'}
          </p>
        </div>
      </div>

      {/* Step 1: Template Selection */}
      {step === 1 && (
        <>
          <TemplateSelector
            templates={templates}
            selectedAppTemplateId={selectedAppTemplateId}
            selectedPlanTemplateId={selectedPlanTemplateId}
            onSelectAppTemplate={setSelectedAppTemplateId}
            onSelectPlanTemplate={setSelectedPlanTemplateId}
          />
          <div className="flex justify-end">
            <Button variant="primary" onClick={handleProceed}>
              下一步：填写内容
            </Button>
          </div>
        </>
      )}

      {/* Step 2: Fill Content */}
      {step === 2 && (
        <>
          {/* Title */}
          <Card>
            <CardContent className="space-y-3 p-6">
              <div className="space-y-1.5">
                <Label>变更标题</Label>
                <Input
                  placeholder="例如：核心交易系统数据库版本升级"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Application Fields */}
          {selectedAppTemplate && (
            <Card>
              <CardContent className="space-y-4 p-6">
                <h3 className="text-sm font-bold text-v2-fg">申请单</h3>
                {appFields.length === 0 ? (
                  <p className="text-sm text-v2-muted">该模板未配置表单字段</p>
                ) : (
                  <FieldList
                    fields={appFields}
                    editable={true}
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

          {/* Plan Fields */}
          {selectedPlanTemplate && (
            <Card>
              <CardContent className="space-y-4 p-6">
                <h3 className="text-sm font-bold text-v2-fg">方案</h3>
                {planFields.length === 0 ? (
                  <p className="text-sm text-v2-muted">该模板未配置表单字段</p>
                ) : (
                  <FieldList
                    fields={planFields}
                    editable={true}
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

          {/* CI Selection */}
          <Card>
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-v2-fg">关联 CI（可选）</h3>
                <Button variant="secondary" size="sm" onClick={() => setCiSelectorOpen(true)}>
                  选择 CI
                </Button>
              </div>
              {selectedCis.length === 0 ? (
                <p className="text-sm text-v2-muted">暂未关联 CI</p>
              ) : (
                <div className="space-y-2">
                  {selectedCis.map((ci) => (
                    <div
                      key={ci.instanceId}
                      className="flex items-center justify-between rounded-v2-md border border-v2-border bg-v2-surface px-3 py-2"
                    >
                      <div>
                        <span className="font-medium text-v2-fg">{ci.instanceName}</span>
                        <span className="ml-2 text-xs text-v2-muted">{ci.modelName}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleCiSelection(ci)}
                      >
                        移除
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              上一步
            </Button>
            <Button variant="primary" disabled={submitting} onClick={handleSubmit}>
              <Sparkles className="h-4 w-4" />
              {submitting ? '创建中…' : '创建变更文档'}
            </Button>
          </div>
        </>
      )}

      {/* CI Selector Modal */}
      <CiSelectorModal
        open={ciSelectorOpen}
        selectedCis={selectedCis}
        onClose={() => setCiSelectorOpen(false)}
        onToggle={toggleCiSelection}
      />
    </div>
  )
}
