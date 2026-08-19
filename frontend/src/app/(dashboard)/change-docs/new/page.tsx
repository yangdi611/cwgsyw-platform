'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import type { TableRow } from '@/components/change-doc/tableFieldTypes'
import { FieldList } from '@/components/change-doc/FieldList'
import { TemplateSelector } from './components/TemplateSelector'
import { CiSelectorModal } from './components/CiSelectorModal'
import type { CiSnapshot, TemplateVO } from './components/types'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Card,
  Field,
  FormSettingsPage,
  Input,
  PageHeader,
} from '@/design-system/figma-neutral/components'

interface ChangeDocCreateResponse {
  id: number
}

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
    queryFn: () => api.get('/admin/change-doc-templates').then((response) => response.data.data),
  })

  const selectedAppTemplate = useMemo(
    () => templates.find((item) => item.id === selectedAppTemplateId),
    [templates, selectedAppTemplateId],
  )
  const selectedPlanTemplate = useMemo(
    () => templates.find((item) => item.id === selectedPlanTemplateId),
    [templates, selectedPlanTemplateId],
  )

  const appFields = useMemo(() => {
    if (!selectedAppTemplate) return []
    return selectedAppTemplate.fields.filter((field) => field.inForm).sort((left, right) => left.sortOrder - right.sortOrder)
  }, [selectedAppTemplate])

  const planFields = useMemo(() => {
    if (!selectedPlanTemplate) return []
    return selectedPlanTemplate.fields.filter((field) => field.inForm).sort((left, right) => left.sortOrder - right.sortOrder)
  }, [selectedPlanTemplate])

  const allRequiredFieldKeys = useMemo(() => {
    const keys: string[] = []
    appFields.forEach((field) => field.required && keys.push(field.fieldKey))
    planFields.forEach((field) => field.required && keys.push(field.fieldKey))
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

  const setField = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFieldsData((current) => ({ ...current, [key]: event.target.value }))

  const setTableField = (key: string) => (rows: TableRow[]) =>
    setFieldsData((current) => ({ ...current, [key]: rows }))

  const toggleCiSelection = (ci: CiSnapshot) => {
    setSelectedCis((current) =>
      current.some((item) => item.instanceId === ci.instanceId)
        ? current.filter((item) => item.instanceId !== ci.instanceId)
        : [...current, ci],
    )
  }

  const handleAiGenerate = async (fieldKey: string) => {
    setAiLoadingField(fieldKey)
    try {
      const response = await api.post('/change-docs/ai-generate-new', { fieldKey, fieldsData })
      setFieldsData((current) => ({ ...current, [fieldKey]: response.data.data as string }))
      toast.success('AI 内容已生成，请审阅后提交')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'AI 生成失败')
    } finally {
      setAiLoadingField(null)
    }
  }

  const handleSubmit = async () => {
    const missingKeys = allRequiredFieldKeys.filter((key) => {
      const value = fieldsData[key]
      return value === undefined || value === null || value === ''
    })
    if (missingKeys.length > 0) {
      toast.error('请填写所有必填字段')
      return
    }

    setSubmitting(true)
    try {
      const response = await api.post('/change-docs', {
        title: title.trim() || undefined,
        applicationTemplateId: selectedAppTemplateId,
        planTemplateId: selectedPlanTemplateId,
        fieldsData,
        ciSnapshots: selectedCis,
      })
      const created = response.data.data as ChangeDocCreateResponse
      if (!Number.isSafeInteger(created?.id) || created.id <= 0) {
        throw new Error('创建响应缺少有效文档 ID')
      }
      toast.success('变更文档已创建')
      router.push(`/change-docs/${created.id}`)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? (error instanceof Error ? error.message : '创建失败'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <FormSettingsPage
        embedded
        className="cwgsyw-change-doc-create"
        header={
          <PageHeader
            title="新建变更文档"
            subtitle={step === 1 ? '选择申请单或方案模板，建立变更文档结构。' : '填写变更内容，并按需关联受影响的 CI。'}
            actions={
              <div className="cwgsyw-change-doc-create__header-actions">
                <Button type="button" variant="secondary" size="sm" onClick={() => (step === 1 ? router.back() : setStep(1))}>
                  {step === 1 ? '返回列表' : '上一步'}
                </Button>
              </div>
            }
          />
        }
        form={
          <div className="cwgsyw-form">
            <ol className="cwgsyw-change-doc-create__steps" aria-label="新建变更文档进度">
              <li className={step === 1 ? 'is-active' : 'is-complete'} aria-current={step === 1 ? 'step' : undefined}>
                <span>1</span>
                选择模板
              </li>
              <li className={step === 2 ? 'is-active' : ''} aria-current={step === 2 ? 'step' : undefined}>
                <span>2</span>
                填写内容
              </li>
            </ol>
            {step === 1 ? (
              <>
                <TemplateSelector
                  templates={templates}
                  selectedAppTemplateId={selectedAppTemplateId}
                  selectedPlanTemplateId={selectedPlanTemplateId}
                  onSelectAppTemplate={setSelectedAppTemplateId}
                  onSelectPlanTemplate={setSelectedPlanTemplateId}
                />
                <div className="cwgsyw-designer__actions cwgsyw-change-doc-create__actions">
                  <Button type="button" onClick={handleProceed}>下一步：填写内容</Button>
                </div>
              </>
            ) : (
              <>
                <div className="cwgsyw-change-doc-create__content-step">
                  <Card title="变更标题">
                    <Field htmlFor="change-title" label="变更标题">
                      <Input
                        value={title}
                        placeholder="例如：核心交易系统数据库版本升级"
                        onChange={(event) => setTitle(event.target.value)}
                      />
                    </Field>
                  </Card>
                  {selectedAppTemplate ? (
                    <Card title="申请单">
                      {appFields.length === 0 ? (
                        <p>该模板未配置表单字段</p>
                      ) : (
                        <FieldList
                          fields={appFields}
                          editable
                          fieldsData={fieldsData}
                          aiLoadingField={aiLoadingField}
                          onFieldChange={setField}
                          onTableFieldChange={setTableField}
                          onAiGenerate={handleAiGenerate}
                        />
                      )}
                    </Card>
                  ) : null}
                  {selectedPlanTemplate ? (
                    <Card title="方案">
                      {planFields.length === 0 ? (
                        <p>该模板未配置表单字段</p>
                      ) : (
                        <FieldList
                          fields={planFields}
                          editable
                          fieldsData={fieldsData}
                          aiLoadingField={aiLoadingField}
                          onFieldChange={setField}
                          onTableFieldChange={setTableField}
                          onAiGenerate={handleAiGenerate}
                        />
                      )}
                    </Card>
                  ) : null}
                  <Card
                    title="关联 CI（可选）"
                    headerAction={
                      <Button type="button" variant="secondary" size="sm" onClick={() => setCiSelectorOpen(true)}>
                        选择 CI
                      </Button>
                    }
                  >
                    <div className="cwgsyw-change-doc-create__ci">
                      {selectedCis.length === 0 ? (
                        <p>暂未关联 CI</p>
                      ) : (
                        <div className="cwgsyw-form">
                          {selectedCis.map((ci) => (
                            <div key={ci.instanceId} className="cwgsyw-designer__actions">
                              <span>
                                {ci.instanceName} {ci.modelName}
                              </span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => toggleCiSelection(ci)}>
                                移除
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
                <div className="cwgsyw-designer__actions cwgsyw-change-doc-create__actions">
                  <Button type="button" variant="secondary" onClick={() => setStep(1)}>上一步</Button>
                  <Button type="button" disabled={submitting} onClick={() => void handleSubmit()}>
                    {submitting ? '创建中…' : '创建变更文档'}
                  </Button>
                </div>
              </>
            )}
          </div>
        }
      />
      <CiSelectorModal
        open={ciSelectorOpen}
        selectedCis={selectedCis}
        onClose={() => setCiSelectorOpen(false)}
        onToggle={toggleCiSelection}
      />
    </>
  )
}
