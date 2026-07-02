'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card, CardContent } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Trash2, Plus, GripVertical } from 'lucide-react'

interface FieldConfigVO {
  id: number
  fieldKey: string
  label: string
  fieldType: string
  sortOrder: number
  required: boolean
  inForm: boolean
  placeholder: string
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
  { value: 'readonly', label: '只读（导出用）' },
  { value: 'ci_selector', label: 'CI 选择器' },
]

export default function TemplateFieldsPage() {
  const { id } = useParams<{ id: string }>()
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
    queryFn: () => api.get(`/admin/change-doc-templates/${id}`).then((r) => r.data.data),
  })

  useEffect(() => {
    if (tpl && !dirty) setFields(tpl.fields ?? [])
  }, [tpl, dirty])

  useEffect(() => {
    if (tpl && !metaDirty) {
      setMeta({
        name: tpl.name ?? '',
        description: tpl.description ?? '',
        docType: tpl.docType ?? 'general',
      })
    }
  }, [tpl, metaDirty])

  const saveMetaMutation = useMutation({
    mutationFn: () =>
      api.put(`/admin/change-doc-templates/${id}`, {
        name: meta.name,
        description: meta.description,
        docType: meta.docType,
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
    mutationFn: () => api.put(`/admin/change-doc-templates/${id}/fields`, { fields }),
    onSuccess: () => {
      toast.success('字段配置已保存')
      setDirty(false)
      queryClient.invalidateQueries({ queryKey: ['change-doc-template', id] })
      queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] })
    },
    onError: () => toast.error('保存失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (fieldId: number) =>
      api.delete(`/admin/change-doc-templates/${id}/fields/${fieldId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-doc-template', id] })
      setDirty(false)
    },
    onError: () => toast.error('删除失败'),
  })

  const update = (idx: number, key: keyof FieldConfigVO, val: unknown) => {
    setDirty(true)
    setFields((f) => f.map((field, i) => (i === idx ? { ...field, [key]: val } : field)))
  }

  const addField = () => {
    setDirty(true)
    const maxOrder = fields.reduce((m, f) => Math.max(m, f.sortOrder ?? 0), 0)
    setFields((f) => [
      ...f,
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
    if (fieldId > 0) {
      deleteMutation.mutate(fieldId)
    }
    setFields((f) => f.filter((_, i) => i !== idx))
    setDirty(true)
  }

  if (isLoading) return <p className="text-v2-muted">加载中…</p>

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/change-doc-templates"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-v2-fg">{tpl?.name}</h1>
          <p className="mt-0.5 text-xs text-v2-muted">
            Word 模板中的{' '}
            <code className="rounded bg-v2-surface-soft px-1 font-v2-mono">{'{{field_key}}'}</code>{' '}
            与此处 field_key 对应
          </p>
        </div>
        {tpl?.hasDocx && (
          <span className="inline-flex items-center rounded-md border border-v2-success-border bg-v2-success-soft px-2 py-1 text-xs font-medium text-v2-success">
            已上传 .docx
          </span>
        )}
      </div>

      {!tpl?.hasDocx && (
        <div className="rounded-v2-md border border-v2-warning-border bg-v2-warning-soft p-3 text-sm text-v2-warning">
          尚未上传 Word 模板文件。可先配置字段，上传后点「解析书签」自动识别占位符。
        </div>
      )}

      {/* 基本信息 */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-v2-fg">基本信息</h2>
            {metaDirty && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => saveMetaMutation.mutate()}
                disabled={saveMetaMutation.isPending || !meta.name}
              >
                {saveMetaMutation.isPending ? '保存中…' : '保存基本信息'}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-v2-muted">名称</label>
              <Input
                value={meta.name}
                onChange={(e) => {
                  setMeta((m) => ({ ...m, name: e.target.value }))
                  setMetaDirty(true)
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-v2-muted">描述</label>
              <Input
                value={meta.description}
                onChange={(e) => {
                  setMeta((m) => ({ ...m, description: e.target.value }))
                  setMetaDirty(true)
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-v2-muted">类型</label>
              <select
                value={meta.docType}
                onChange={(e) => {
                  setMeta((m) => ({ ...m, docType: e.target.value as DocType }))
                  setMetaDirty(true)
                }}
                className="h-9 w-full rounded-v2-md border border-v2-border bg-v2-surface px-3 text-sm text-v2-fg focus:border-v2-primary focus:outline-none"
              >
                <option value="general">{DOC_TYPE_LABEL.general}</option>
                <option value="application">{DOC_TYPE_LABEL.application}</option>
                <option value="plan">{DOC_TYPE_LABEL.plan}</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {fields.map((field, idx) => (
          <Card key={field.id || `new-${idx}`}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <GripVertical className="mt-2.5 h-4 w-4 shrink-0 text-v2-subtle" />
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-v2-muted">书签 Key</label>
                    <Input
                      value={field.fieldKey}
                      className="h-8 font-v2-mono text-xs"
                      placeholder="例：change_desc"
                      onChange={(e) => update(idx, 'fieldKey', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-v2-muted">显示标签</label>
                    <Input
                      value={field.label}
                      className="h-8"
                      onChange={(e) => update(idx, 'label', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-v2-muted">字段类型</label>
                    <Select
                      value={field.fieldType}
                      onValueChange={(v) => update(idx, 'fieldType', v ?? 'textarea')}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue>
                          {(v: string) => FIELD_TYPES.find((t) => t.value === v)?.label ?? v}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-v2-muted">提示文字</label>
                    <Input
                      value={field.placeholder ?? ''}
                      className="h-8"
                      placeholder="输入框提示…"
                      onChange={(e) => update(idx, 'placeholder', e.target.value)}
                    />
                  </div>
                  {field.fieldType === 'ci_selector' && (
                    <div className="col-span-2 mt-1 space-y-1 rounded-v2-md border border-v2-primary-border bg-v2-primary-soft p-3 text-xs text-v2-primary">
                      <p className="font-semibold">CI 选择器用法说明</p>
                      <p>允许填写人在变更文档中搜索并选择受影响的 CI 实例。</p>
                      <ul className="list-inside list-disc space-y-0.5 opacity-80">
                        <li>选中一个 CI 后，自动展示其 2 层关联 CI 作为候选建议</li>
                        <li>存储选中时的 CI 名称快照，CI 删除后仍可查看历史记录</li>
                        <li>变更文档详情页中以 CI 卡片列表呈现，可点击跳转 CMDB</li>
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 pt-1">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-v2-fg">
                    <input
                      type="checkbox"
                      checked={!!field.required}
                      onChange={(e) => update(idx, 'required', e.target.checked)}
                      className="rounded"
                    />
                    必填
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-v2-fg">
                    <input
                      type="checkbox"
                      checked={!!field.inForm}
                      onChange={(e) => update(idx, 'inForm', e.target.checked)}
                      className="rounded"
                    />
                    表单可见
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 w-7 p-0 text-v2-danger"
                    onClick={() => removeField(idx, field.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {fields.length === 0 && (
          <div className="rounded-lg border border-v2-border bg-v2-surface py-8 text-center text-sm text-v2-muted">
            暂无字段配置。上传 .docx 后点「解析书签」，或手动添加字段。
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={addField}>
          <Plus className="h-4 w-4" />
          添加字段
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
        >
          {saveMutation.isPending ? '保存中…' : '保存配置'}
        </Button>
      </div>
    </div>
  )
}
