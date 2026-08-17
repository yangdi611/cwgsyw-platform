'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { getApiErrorMessage } from '@/lib/api-error'
import type { CiAttributeResponse, CiModelWithAttributes, CmdbFieldsData } from '@/types/cmdb-model'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Checkbox,
  ErrorState,
  Field,
  FormSettingsPage,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from '@/design-system/figma-neutral/components'

export default function NewInstancePage() {
  const { modelCode } = useParams<{ modelCode: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [attrs, setAttrs] = useState<CmdbFieldsData>({})
  const [name, setName] = useState('')
  const [showValidation, setShowValidation] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'create')) router.replace(`/cmdb/instances/by-model/${modelCode}`)
  }, [isHydrated, hasPermission, router, modelCode])

  const { data: model, isLoading, isError, refetch } = useQuery<CiModelWithAttributes>({
    queryKey: ['cmdb-model', modelCode],
    queryFn: () => api.get(`/cmdb/models/${modelCode}`).then((r) => r.data.data),
    enabled: typeof window !== 'undefined',
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/cmdb/instances', { modelId: modelCode, name, fieldsData: attrs }),
    onSuccess: (res) => {
      toast.success('实例已创建')
      router.push(`/cmdb/instances/by-model/${modelCode}/${res.data.data.id}`)
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '创建失败')),
  })

  const set = (key: string, val: string) => setAttrs((current) => ({ ...current, [key]: val }))
  const groups = model?.attributeGroups ?? []
  const modelAttributes = model?.attributes ?? []
  const attrsByGroup = modelAttributes.reduce((acc, attr) => {
    const groupId = attr.groupId || 'default'
    if (!acc[groupId]) acc[groupId] = []
    acc[groupId].push(attr)
    return acc
  }, {} as Record<string, CiAttributeResponse[]>)
  const missingRequiredKeys = new Set(
    modelAttributes
      .filter((attr) => attr.isRequired && isMissingValue(attr.fieldType, attrs[attr.fieldKey]))
      .map((attr) => attr.fieldKey),
  )

  const handleSubmit = () => {
    const firstMissingId = !name.trim() ? 'instance-name' : modelAttributes.find((attr) => missingRequiredKeys.has(attr.fieldKey))?.fieldKey
    if (firstMissingId) {
      setShowValidation(true)
      requestAnimationFrame(() => document.getElementById(firstMissingId)?.focus())
      return
    }
    createMutation.mutate()
  }

  if (isLoading) return <LoadingState label="加载模型" />

  return (
    <FormSettingsPage className="cwgsyw-cmdb-page cwgsyw-cmdb-instance-create"
      header={
        <div className="cwgsyw-cmdb-instance-page">
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title={`新建 ${model?.name ?? modelCode} 实例`}
            subtitle="填写名称和属性"
          />
        </div>
      }
      form={
        isError ? (
          <ErrorState
            title="模型加载失败"
            description="无法读取当前模型的字段配置，请稍后重试。"
            retry={<Button type="button" size="sm" variant="secondary" onClick={() => refetch()}>重试</Button>}
          />
        ) : (
          <form
          className="cwgsyw-cmdb-instance-create__form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <section className="cwgsyw-cmdb-instance-create__section" aria-labelledby="instance-create-core-title">
            <h2 id="instance-create-core-title" className="cwgsyw-cmdb-instance-create__section-title">实例信息</h2>
            <div className="cwgsyw-cmdb-instance-create__section-body">
              <div className="cwgsyw-cmdb-instance-create__field-grid">
                <div className="cwgsyw-cmdb-instance-create__field cwgsyw-cmdb-instance-create__field--wide">
                  <Field
                    label="实例名称"
                    htmlFor="instance-name"
                    required
                    state={showValidation && !name.trim() ? 'error' : 'default'}
                    errorText={showValidation && !name.trim() ? '请输入实例名称' : undefined}
                  >
                    <Input size="sm" id="instance-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入实例名称" />
                  </Field>
                </div>
              </div>
            </div>
          </section>
          {groups
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((group) => {
              const groupAttrs = (attrsByGroup[group.groupId] ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              if (groupAttrs.length === 0) return null
              return (
                <section key={group.groupId} className="cwgsyw-cmdb-instance-create__section" aria-labelledby={`instance-create-group-${group.groupId}`}>
                  <h2 id={`instance-create-group-${group.groupId}`} className="cwgsyw-cmdb-instance-create__section-title">{group.name}</h2>
                  <div className="cwgsyw-cmdb-instance-create__section-body">
                    <div className="cwgsyw-cmdb-instance-create__field-grid">
                      {groupAttrs.map((attr) => {
                        const showRequiredError = showValidation && missingRequiredKeys.has(attr.fieldKey)
                        return (
                          <div
                            key={attr.fieldKey}
                            className={`cwgsyw-cmdb-instance-create__field${attr.fieldType === 'longchar' ? ' cwgsyw-cmdb-instance-create__field--wide' : ''}`}
                          >
                            <Field
                              label={attr.unit ? `${attr.name} (${attr.unit})` : attr.name}
                              htmlFor={attr.fieldKey}
                              required={attr.isRequired}
                              state={showRequiredError ? 'error' : 'default'}
                              errorText={showRequiredError ? `请填写${attr.name}` : undefined}
                            >
                              {renderField(attr, String(attrs[attr.fieldKey] ?? ''), (value) => set(attr.fieldKey, value))}
                            </Field>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </section>
              )
            })}
          <div className="cwgsyw-inline-controls cwgsyw-cmdb-instance-create__actions">
            <Button type="submit" size="sm" loading={createMutation.isPending} disabled={createMutation.isPending}>
              {createMutation.isPending ? '创建中…' : '创建实例'}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/instances/by-model/${modelCode}`)}>
              取消
            </Button>
          </div>
          </form>
        )
      }
    />
  )
}

function renderField(attr: CiAttributeResponse, value: string, onChange: (value: string) => void) {
  const { fieldType, option, placeholder } = attr
  const ph = placeholder ?? ''
  if (fieldType === 'longchar') {
    return <Textarea size="sm" value={value} onChange={(event) => onChange(event.target.value)} placeholder={ph} rows={3} />
  }
  if (fieldType === 'enum' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    return (
      <Select size="sm" overlay
        value={value}
        placeholder="请选择"
        options={opts.map((item) => ({ value: item.id, label: item.name }))}
        onChange={onChange}
      />
    )
  }
  if (fieldType === 'enummulti' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    const selected: string[] = (() => {
      try {
        return JSON.parse(value || '[]')
      } catch {
        return []
      }
    })()
    return (
      <div className="cwgsyw-cmdb-instance-create__multi-options">
        {opts.map((item) => (
          <Checkbox
            key={item.id}
            label={item.name}
            checked={selected.includes(item.id)}
            onChange={() => {
              const next = selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id]
              onChange(JSON.stringify(next))
            }}
          />
        ))}
      </div>
    )
  }
  if (fieldType === 'bool') {
    return (
      <Select size="sm" overlay
        value={value}
        placeholder="请选择"
        options={[
          { value: 'true', label: '是' },
          { value: 'false', label: '否' },
        ]}
        onChange={onChange}
      />
    )
  }
  if (fieldType === 'date') return <Input size="sm" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
  if (fieldType === 'int' || fieldType === 'float') {
    return <Input size="sm" type="number" value={value} onChange={(event) => onChange(event.target.value)} placeholder={ph} />
  }
  return <Input size="sm" value={value} onChange={(event) => onChange(event.target.value)} placeholder={ph} />
}

function isMissingValue(fieldType: string, value: CmdbFieldsData[string]) {
  if (value === null || value === undefined || value === '') return true
  if (fieldType !== 'enummulti') return false
  try {
    const selected = typeof value === 'string' ? JSON.parse(value) : value
    return !Array.isArray(selected) || selected.length === 0
  } catch {
    return true
  }
}
