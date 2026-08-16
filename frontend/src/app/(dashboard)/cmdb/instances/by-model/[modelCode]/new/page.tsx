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
  Breadcrumb,
  Button,
  Card,
  Checkbox,
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

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_instance', 'create')) router.replace(`/cmdb/instances/by-model/${modelCode}`)
  }, [isHydrated, hasPermission, router, modelCode])

  const { data: model, isLoading } = useQuery<CiModelWithAttributes>({
    queryKey: ['cmdb-model', modelCode],
    queryFn: async () => {
      try {
        const r = await api.get(`/cmdb/models/${modelCode}`)
        return r.data.data
      } catch {
        return undefined
      }
    },
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
  const attrsByGroup = (model?.attributes ?? []).reduce((acc, attr) => {
    const groupId = attr.groupId || 'default'
    if (!acc[groupId]) acc[groupId] = []
    acc[groupId].push(attr)
    return acc
  }, {} as Record<string, CiAttributeResponse[]>)

  if (isLoading) return <LoadingState label="加载模型" />

  return (
    <FormSettingsPage className="cwgsyw-cmdb-page"
      header={
        <div className="cwgsyw-cmdb-instance-page">
        <PageHeader
            showEyebrow={false}
          title={`新建 ${model?.name ?? modelCode} 实例`}
          subtitle="填写名称和属性"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/cmdb', label: 'CMDB' },
                { href: `/cmdb/instances/by-model/${modelCode}`, label: model?.name ?? modelCode },
                { label: '新建实例' },
              ]}
            />
          }
        />
        </div>
      }
      form={
        <div className="cwgsyw-form">
          <Field label="实例名称" htmlFor="instance-name" required>
            <Input size="sm" id="instance-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="请输入实例名称" />
          </Field>
          {groups
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((group) => {
              const groupAttrs = (attrsByGroup[group.groupId] ?? []).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              if (groupAttrs.length === 0) return null
              return (
                <Card key={group.groupId} title={group.name}>
                  <div className="cwgsyw-form">
                    {groupAttrs.map((attr) => (
                      <Field
                        key={attr.fieldKey}
                        label={attr.unit ? `${attr.name} (${attr.unit})` : attr.name}
                        htmlFor={attr.fieldKey}
                        required={attr.isRequired}
                      >
                        {renderField(attr, String(attrs[attr.fieldKey] ?? ''), (value) => set(attr.fieldKey, value))}
                      </Field>
                    ))}
                  </div>
                </Card>
              )
            })}
          <div className="cwgsyw-inline-controls">
            <Button type="button" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? '创建中…' : '创建实例'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push(`/cmdb/instances/by-model/${modelCode}`)}>
              取消
            </Button>
          </div>
        </div>
      }
    />
  )
}

function renderField(attr: CiAttributeResponse, value: string, onChange: (value: string) => void) {
  const { fieldType, option, placeholder } = attr
  const ph = placeholder ?? ''
  if (fieldType === 'longchar') {
    return <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={ph} rows={3} />
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
      <div className="cwgsyw-inline-controls">
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
