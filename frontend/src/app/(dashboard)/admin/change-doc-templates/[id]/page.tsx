'use client'

import { useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { TableConfigEditor } from '@/components/change-doc/TableConfigEditor'
import type { TableFieldConfig } from '@/components/change-doc/tableFieldTypes'
import '@/design-system/figma-neutral/index.css'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Field,
  FormSettingsPage,
  IconButton,
  Input,
  LoadingState,
  NeutralTooltip,
  PageHeader,
  Select,
  Textarea,
} from '@/design-system/figma-neutral/components'

interface FieldConfigVO {
  id: number
  fieldKey: string
  label: string
  fieldType: string
  sortOrder: number
  required: boolean
  inForm: boolean
  placeholder: string
  config?: TableFieldConfig | Record<string, unknown>
}

const DEFAULT_TABLE_CONFIG: TableFieldConfig = {
  tableMode: 'fixedDocxTable',
  allowAddRow: true,
  allowDeleteRow: true,
  allowEditColumn: false,
  rowKey: 'rowId',
  columns: [],
}

type DocType = 'application' | 'plan' | 'general'

interface TemplateVO {
  id: number
  name: string
  description: string
  hasDocx: boolean
  docType: DocType
  fields: FieldConfigVO[]
}

const DOC_TYPE_LABEL: Record<DocType, string> = {
  application: '申请单',
  plan: '方案',
  general: '通用',
}

const FIELD_TYPES = [
  { value: 'text', label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'date', label: '日期' },
  { value: 'datetime', label: '日期时间' },
  { value: 'number', label: '数字' },
  { value: 'enum', label: '枚举' },
  { value: 'readonly', label: '只读（导出用）' },
  { value: 'ci_selector', label: 'CI 选择器' },
  { value: 'table', label: '表格' },
]

const VALUE_FIELD_TYPES = new Set(['text', 'textarea', 'number', 'date', 'datetime', 'enum'])

function TemplateSection({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="cwgsyw-change-doc-template-fields__section">
      <header className="cwgsyw-change-doc-template-fields__head">
        <h2>{title}</h2>
        {action}
      </header>
      <div className="cwgsyw-change-doc-template-fields__body">{children}</div>
    </section>
  )
}

export default function TemplateFieldsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [fields, setFields] = useState<FieldConfigVO[]>([])
  const [dirty, setDirty] = useState(false)
  const [meta, setMeta] = useState<{ name: string; description: string; docType: DocType }>({
    name: '',
    description: '',
    docType: 'general',
  })
  const [metaDirty, setMetaDirty] = useState(false)

  const { data: tpl, isLoading } = useQuery<TemplateVO>({
    queryKey: ['change-doc-template', id],
    queryFn: () => api.get(`/admin/change-doc-templates/${id}`).then((response) => response.data.data),
  })

  const displayedFields = dirty ? fields : (tpl?.fields ?? fields)
  const displayedMeta = metaDirty
    ? meta
    : {
        name: tpl?.name ?? meta.name,
        description: tpl?.description ?? meta.description,
        docType: tpl?.docType ?? meta.docType,
      }

  const currentFields = () => (dirty ? fields : (tpl?.fields ?? []))

  const saveMetaMutation = useMutation({
    mutationFn: () =>
      api.put(`/admin/change-doc-templates/${id}`, {
        name: displayedMeta.name,
        description: displayedMeta.description,
        docType: displayedMeta.docType,
      }),
    onSuccess: () => {
      toast.success('基本信息已保存')
      setMetaDirty(false)
      queryClient.invalidateQueries({ queryKey: ['change-doc-template', id] })
      queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] })
    },
    onError: () => toast.error('保存失败'),
  })

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/admin/change-doc-templates/${id}/fields`, { fields: displayedFields }),
    onSuccess: () => {
      toast.success('字段配置已保存')
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: ['change-doc-template', id] })
      queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] })
    },
    onError: () => toast.error('保存失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (fieldId: number) => api.delete(`/admin/change-doc-templates/${id}/fields/${fieldId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-doc-template', id] })
      setDirty(false)
    },
    onError: () => toast.error('删除失败'),
  })

  const update = (idx: number, key: keyof FieldConfigVO, val: unknown) => {
    setDirty(true)
    setFields(currentFields().map((field, index) => {
      if (index !== idx) return field
      const next = { ...field, [key]: val }
      if (key === 'fieldType' && val === 'table' && !next.config) {
        next.config = { ...DEFAULT_TABLE_CONFIG }
      }
      return next
    }))
  }

  const updateTableConfig = (idx: number, config: TableFieldConfig) => {
    setDirty(true)
    setFields(currentFields().map((field, index) => (index === idx ? { ...field, config } : field)))
  }

  const updateFieldConfig = (idx: number, patch: Record<string, unknown>) => {
    setDirty(true)
    setFields(currentFields().map((field, index) =>
      index === idx ? { ...field, config: { ...(field.config ?? {}), ...patch } } : field,
    ))
  }

  const addField = () => {
    setDirty(true)
    const base = currentFields()
    const maxOrder = base.reduce((max, field) => Math.max(max, field.sortOrder ?? 0), 0)
    setFields([
      ...base,
      {
        id: 0,
        fieldKey: '',
        label: '新字段',
        fieldType: 'textarea',
        sortOrder: maxOrder + 10,
        required: false,
        inForm: true,
        placeholder: '',
      },
    ])
  }

  const removeField = (idx: number, fieldId: number) => {
    if (fieldId > 0) deleteMutation.mutate(fieldId)
    setFields(currentFields().filter((_, index) => index !== idx))
    setDirty(true)
  }

  if (isLoading) return <LoadingState label="正在加载模板字段…" />

  return (
    <FormSettingsPage
      embedded
      className="cwgsyw-change-doc-template-fields"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title={tpl?.name ?? '模板字段'}
          subtitle="Word 模板中的 {{field_key}} 与此处 field_key 对应"
          status={tpl?.hasDocx ? <Badge size="sm" label="已上传 .docx" tone="success" /> : undefined}
          actions={
            <div className="cwgsyw-change-doc-template-fields__header-actions">
              <Button type="button" variant="secondary" size="sm" onClick={() => router.push('/admin/change-doc-templates')}>
                返回列表
              </Button>
            </div>
          }
        />
      }
      form={
        <div className="cwgsyw-form cwgsyw-change-doc-template-fields__form">
          {!tpl?.hasDocx ? (
            <Alert
              tone="warning"
              title="尚未上传 Word 模板"
              description="可先配置字段，上传后点「解析书签」自动识别占位符。"
              showDismiss={false}
            />
          ) : null}

          <TemplateSection
            title="基本信息"
            action={
              metaDirty ? (
                <Button type="button" size="sm" onClick={() => saveMetaMutation.mutate()} disabled={saveMetaMutation.isPending || !displayedMeta.name}>
                  {saveMetaMutation.isPending ? '保存中…' : '保存基本信息'}
                </Button>
              ) : null
            }
          >
            <div className="cwgsyw-change-doc-template-fields__grid">
              <Field htmlFor="template-name" label="名称">
                <Input
                  id="template-name"
                  size="sm"
                  value={displayedMeta.name}
                  onChange={(event) => {
                    setMeta((current) => ({ ...current, name: event.target.value }))
                    setMetaDirty(true)
                  }}
                />
              </Field>
              <Field htmlFor="template-desc" label="描述">
                <Input
                  id="template-desc"
                  size="sm"
                  value={displayedMeta.description}
                  onChange={(event) => {
                    setMeta((current) => ({ ...current, description: event.target.value }))
                    setMetaDirty(true)
                  }}
                />
              </Field>
              <Field htmlFor="template-type" label="类型">
                <Select
                  size="sm"
                  overlay
                  value={displayedMeta.docType}
                  aria-label="模板类型"
                  options={[
                    { value: 'general', label: DOC_TYPE_LABEL.general },
                    { value: 'application', label: DOC_TYPE_LABEL.application },
                    { value: 'plan', label: DOC_TYPE_LABEL.plan },
                  ]}
                  onChange={(value) => {
                    setMeta((current) => ({ ...current, docType: value as DocType }))
                    setMetaDirty(true)
                  }}
                />
              </Field>
            </div>
          </TemplateSection>

          {displayedFields.map((field, idx) => (
            <TemplateSection
              key={field.id || `new-${idx}`}
              title={field.label || '新字段'}
              action={
                <NeutralTooltip content="删除" className="cwgsyw-tooltip--pill" followCursor>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    aria-label={`删除字段 ${field.label || field.fieldKey || '新字段'}`}
                    onClick={() => removeField(idx, field.id)}
                  />
                </NeutralTooltip>
              }
            >
              <div className="cwgsyw-change-doc-template-fields__grid">
                <Field htmlFor={`field-key-${idx}`} label="书签 Key">
                  <Input
                    id={`field-key-${idx}`}
                    size="sm"
                    value={field.fieldKey}
                    placeholder="例：change_desc"
                    onChange={(event) => update(idx, 'fieldKey', event.target.value)}
                  />
                </Field>
                {VALUE_FIELD_TYPES.has(field.fieldType) ? (
                  <Field htmlFor={`field-default-${idx}`} label="默认值">
                    <Input
                      id={`field-default-${idx}`}
                      size="sm"
                      value={String((field.config as { defaultValue?: unknown } | undefined)?.defaultValue ?? '')}
                      onChange={(event) => updateFieldConfig(idx, { defaultValue: event.target.value })}
                    />
                  </Field>
                ) : null}
                {field.fieldType === 'enum' ? (
                  <Field htmlFor={`field-enum-${idx}`} label="枚举选项（每行：值|显示名称）">
                    <Textarea
                      id={`field-enum-${idx}`}
                      size="sm"
                      value={((field.config as { options?: { value: string; label: string }[] } | undefined)?.options ?? [])
                        .map((option) => `${option.value}|${option.label}`)
                        .join('\n')}
                      onChange={(event) =>
                        updateFieldConfig(idx, {
                          options: event.target.value
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line) => {
                              const [value, label] = line.split('|', 2)
                              return { value: value.trim(), label: (label ?? value).trim() }
                            }),
                        })
                      }
                    />
                  </Field>
                ) : null}
                <Field htmlFor={`field-order-${idx}`} label="排序">
                  <Input
                    id={`field-order-${idx}`}
                    size="sm"
                    type="number"
                    value={field.sortOrder ?? 0}
                    onChange={(event) => update(idx, 'sortOrder', Number(event.target.value))}
                  />
                </Field>
                <Field htmlFor={`field-label-${idx}`} label="显示标签">
                  <Input
                    id={`field-label-${idx}`}
                    size="sm"
                    value={field.label}
                    onChange={(event) => update(idx, 'label', event.target.value)}
                  />
                </Field>
                <Field htmlFor={`field-type-${idx}`} label="字段类型">
                  <Select
                    size="sm"
                    overlay
                    value={field.fieldType}
                    aria-label={`字段类型 ${field.label || field.fieldKey || idx + 1}`}
                    options={FIELD_TYPES}
                    onChange={(value) => update(idx, 'fieldType', value || 'textarea')}
                  />
                </Field>
                <Field htmlFor={`field-placeholder-${idx}`} label="提示文字">
                  <Input
                    id={`field-placeholder-${idx}`}
                    size="sm"
                    value={field.placeholder ?? ''}
                    placeholder="输入框提示…"
                    onChange={(event) => update(idx, 'placeholder', event.target.value)}
                  />
                </Field>
                {field.fieldType === 'ci_selector' ? (
                  <div className="cwgsyw-change-doc-template-fields__span">
                    <Alert
                      tone="info"
                      title="CI 选择器用法说明"
                      description="允许填写人搜索并选择受影响的 CI。选中后展示 2 层关联建议，并保存名称快照。"
                      showDismiss={false}
                    />
                  </div>
                ) : null}
                {field.fieldType === 'table' ? (
                  <div className="cwgsyw-change-doc-template-fields__span">
                    <Alert
                      tone="info"
                      title="表格字段用法说明"
                      description={`Word 模板用一行数据行表示，单元格写成 {{${field.fieldKey || 'table_key'}.列key}}，填表时按行复制。`}
                      showDismiss={false}
                    />
                    <TableConfigEditor
                      value={
                        field.config && (field.config as TableFieldConfig).tableMode === 'fixedDocxTable'
                          ? (field.config as TableFieldConfig)
                          : DEFAULT_TABLE_CONFIG
                      }
                      onChange={(next) => updateTableConfig(idx, next)}
                    />
                  </div>
                ) : null}
                <div className="cwgsyw-change-doc-template-fields__checks">
                  <Checkbox
                    label="必填"
                    checked={!!field.required}
                    onChange={(event) => update(idx, 'required', event.target.checked)}
                  />
                  <Checkbox
                    label="表单可见"
                    checked={!!field.inForm}
                    onChange={(event) => update(idx, 'inForm', event.target.checked)}
                  />
                </div>
              </div>
            </TemplateSection>
          ))}

          {displayedFields.length === 0 ? (
            <TemplateSection title="字段配置">
              <p>暂无字段配置。上传 .docx 后点「解析书签」，或手动添加字段。</p>
            </TemplateSection>
          ) : null}

          <div className="cwgsyw-change-doc-template-fields__actions">
            <Button type="button" variant="secondary" size="sm" onClick={addField}>
              添加字段
            </Button>
            <Button type="button" size="sm" onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending}>
              {saveMutation.isPending ? '保存中…' : '保存配置'}
            </Button>
          </div>
        </div>
      }
    />
  )
}
