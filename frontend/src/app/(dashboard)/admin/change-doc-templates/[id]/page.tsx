'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

interface TemplateVO {
  id: number
  name: string
  description: string
  hasDocx: boolean
  fields: FieldConfigVO[]
}

const FIELD_TYPES = [
  { value: 'text',     label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'date',     label: '日期' },
  { value: 'readonly', label: '只读（导出用）' },
]

export default function TemplateFieldsPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [fields, setFields] = useState<FieldConfigVO[]>([])
  const [dirty, setDirty] = useState(false)

  const { data: tpl, isLoading } = useQuery<TemplateVO>({
    queryKey: ['change-doc-template', id],
    queryFn: () => api.get(`/admin/change-doc-templates/${id}`).then(r => r.data.data),
  })

  useEffect(() => {
    if (tpl && !dirty) setFields(tpl.fields ?? [])
  }, [tpl, dirty])

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
    setFields(f => f.map((field, i) => i === idx ? { ...field, [key]: val } : field))
  }

  const addField = () => {
    setDirty(true)
    const maxOrder = fields.reduce((m, f) => Math.max(m, f.sortOrder ?? 0), 0)
    setFields(f => [...f, {
      id: 0,
      fieldKey: '',
      label: '新字段',
      fieldType: 'textarea',
      sortOrder: maxOrder + 10,
      required: false,
      inForm: true,
      placeholder: '',
    }])
  }

  const removeField = (idx: number, fieldId: number) => {
    if (fieldId > 0) {
      deleteMutation.mutate(fieldId)
    }
    setFields(f => f.filter((_, i) => i !== idx))
    setDirty(true)
  }

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/change-doc-templates" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{tpl?.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Word 模板中的 <code className="bg-muted px-1 rounded">{'{{field_key}}'}</code> 与此处 field_key 对应
          </p>
        </div>
        {tpl?.hasDocx && <Badge variant="outline" className="text-green-600 border-green-300">已上传 .docx</Badge>}
      </div>

      {!tpl?.hasDocx && (
        <div className="mb-4 p-3 border border-amber-200 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-sm text-amber-800 dark:text-amber-200">
          尚未上传 Word 模板文件。可先配置字段，上传后点「解析书签」自动识别占位符。
        </div>
      )}

      <div className="space-y-2 mb-4">
        {fields.map((field, idx) => (
          <div key={field.id || `new-${idx}`} className="border rounded-lg p-3 bg-card">
            <div className="flex gap-2 items-start">
              <GripVertical className="h-4 w-4 text-muted-foreground mt-2.5 shrink-0" />
              <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">书签 Key</label>
                  <Input
                    value={field.fieldKey}
                    className="h-8 text-xs font-mono"
                    placeholder="例：change_desc"
                    onChange={e => update(idx, 'fieldKey', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">显示标签</label>
                  <Input
                    value={field.label}
                    className="h-8"
                    onChange={e => update(idx, 'label', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">字段类型</label>
                  <Select
                    value={field.fieldType}
                    onValueChange={v => update(idx, 'fieldType', v ?? 'textarea')}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">提示文字</label>
                  <Input
                    value={field.placeholder ?? ''}
                    className="h-8"
                    placeholder="输入框提示..."
                    onChange={e => update(idx, 'placeholder', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0 pt-1">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!field.required}
                    onChange={e => update(idx, 'required', e.target.checked)}
                    className="rounded"
                  />
                  必填
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!field.inForm}
                    onChange={e => update(idx, 'inForm', e.target.checked)}
                    className="rounded"
                  />
                  表单可见
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive mt-1"
                  onClick={() => removeField(idx, field.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {fields.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8 border rounded-lg">
            暂无字段配置。上传 .docx 后点「解析书签」，或手动添加字段。
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={addField}>
          <Plus className="h-4 w-4 mr-1" />添加字段
        </Button>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
        >
          {saveMutation.isPending ? '保存中...' : '保存配置'}
        </Button>
      </div>
    </div>
  )
}
