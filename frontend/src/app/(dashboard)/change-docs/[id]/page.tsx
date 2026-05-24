'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { Download, Sparkles } from 'lucide-react'

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

interface ChangeDocVO {
  id: number
  changeNo: string
  status: string
  templateId: number
  templateName: string
  applicantId: number
  applicantName: string
  applyTime: string
  approvedAt: string | null
  approverId: number | null
  approverName: string | null
  approverComment: string | null
  createdAt: string
  updatedAt: string
  fieldsData: Record<string, string>
  fieldConfig: FieldConfigVO[]
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft:    { label: '草稿',   variant: 'secondary' },
  pending:  { label: '待审批', variant: 'default' },
  approved: { label: '已通过', variant: 'outline' },
  rejected: { label: '已拒绝', variant: 'destructive' },
}

export default function ChangeDocDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: doc, isLoading } = useQuery<ChangeDocVO>({
    queryKey: ['change-doc', id],
    queryFn: () => api.get(`/change-docs/${id}`).then(r => r.data.data),
    enabled: hasPermission('change_doc', 'read'),
  })

  const [fieldsData, setFieldsData] = useState<Record<string, string>>({})
  const [approveComment, setApproveComment] = useState('')
  const [exporting, setExporting] = useState(false)
  const [aiLoadingField, setAiLoadingField] = useState<string | null>(null)

  useEffect(() => {
    if (!hasPermission('change_doc', 'read')) router.replace('/')
  }, [hasPermission, router])

  useEffect(() => {
    if (doc) setFieldsData(doc.fieldsData ?? {})
  }, [doc])

  const isDraft = doc?.status === 'draft'
  const isPending = doc?.status === 'pending'
  const st = doc ? (STATUS_MAP[doc.status] ?? { label: doc.status, variant: 'secondary' as const }) : null

  const setField = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFieldsData(f => ({ ...f, [key]: e.target.value }))

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/change-docs/${id}`, { fieldsData }),
    onSuccess: () => {
      toast.success('已保存')
      queryClient.invalidateQueries({ queryKey: ['change-doc', id] })
    },
    onError: () => toast.error('保存失败'),
  })

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/change-docs/${id}/submit`),
    onSuccess: () => {
      toast.success('已提交审批')
      queryClient.invalidateQueries({ queryKey: ['change-doc', id] })
      queryClient.invalidateQueries({ queryKey: ['change-docs'] })
    },
    onError: () => toast.error('提交失败'),
  })

  const approveMutation = useMutation({
    mutationFn: (approved: boolean) => api.post(`/change-docs/${id}/approve`, { approved, comment: approveComment }),
    onSuccess: (_data, approved) => {
      toast.success(approved ? '已审批通过' : '已拒绝')
      queryClient.invalidateQueries({ queryKey: ['change-doc', id] })
      queryClient.invalidateQueries({ queryKey: ['change-docs'] })
    },
    onError: () => toast.error('操作失败'),
  })

  const handleAiGenerate = async (fieldKey: string) => {
    setAiLoadingField(fieldKey)
    try {
      const res = await api.post(`/change-docs/${id}/ai-generate`, { fieldKey })
      const generated = res.data.data as string
      setFieldsData(f => ({ ...f, [fieldKey]: generated }))
      toast.success('AI 内容已生成，请审阅后保存')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'AI 生成失败')
    } finally {
      setAiLoadingField(null)
    }
  }

  const handleExport = async (format: 'pdf' | 'docx') => {
    setExporting(true)
    try {
      const res = await api.get(`/change-docs/${id}/export/${format}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc?.changeNo ?? 'change-doc'}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const visibleFields = (doc?.fieldConfig ?? []).filter(f => f.in_form).sort((a, b) => a.sort_order - b.sort_order)

  if (isLoading) return <p className="text-muted-foreground text-sm">加载中...</p>
  if (!doc) return <p className="text-muted-foreground text-sm">文档不存在</p>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← 返回</Button>
        <h1 className="text-xl font-bold flex-1">{doc.changeNo}</h1>
        <span className="text-sm text-muted-foreground">{doc.templateName}</span>
        {st && <Badge variant={st.variant}>{st.label}</Badge>}
      </div>

      <div className="space-y-6">
        {/* Meta info */}
        <section className="border rounded-lg p-5">
          <h2 className="font-semibold text-base mb-3">基本信息</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">申请人：</span>{doc.applicantName}</div>
            <div><span className="text-muted-foreground">申请时间：</span>{doc.applyTime}</div>
          </div>
        </section>

        {/* Dynamic fields */}
        {visibleFields.length > 0 ? (
          <section className="border rounded-lg p-5">
            <h2 className="font-semibold text-base mb-4">变更内容</h2>
            <div className="space-y-4">
              {visibleFields.map(field => {
                const value = fieldsData[field.field_key] ?? ''
                const isTextarea = field.field_type === 'textarea'
                return (
                  <div key={field.field_key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
                      {isDraft && isTextarea && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleAiGenerate(field.field_key)}
                          disabled={aiLoadingField === field.field_key}
                        >
                          <Sparkles className="h-3 w-3" />
                          {aiLoadingField === field.field_key ? 'AI 生成中...' : 'AI 生成'}
                        </Button>
                      )}
                    </div>
                    {isDraft ? (
                      isTextarea ? (
                        <Textarea
                          value={value}
                          onChange={setField(field.field_key)}
                          placeholder={field.placeholder ?? undefined}
                          rows={4}
                        />
                      ) : field.field_type === 'date' ? (
                        <Input type="date" value={value} onChange={setField(field.field_key)} />
                      ) : field.field_type === 'datetime' ? (
                        <Input type="datetime-local" value={value} onChange={setField(field.field_key)} />
                      ) : (
                        <Input value={value} onChange={setField(field.field_key)} placeholder={field.placeholder ?? undefined} />
                      )
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{value || '—'}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ) : (
          <section className="border rounded-lg p-5">
            <p className="text-sm text-muted-foreground">此文档无字段配置（旧数据或模板未配置字段）</p>
          </section>
        )}

        {/* Approval result */}
        {(doc.status === 'approved' || doc.status === 'rejected') && (
          <section className="border rounded-lg p-5">
            <h2 className="font-semibold text-base mb-3">审批结果</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">审批人：</span>{doc.approverName}</div>
              <div><span className="text-muted-foreground">审批时间：</span>{doc.approvedAt}</div>
            </div>
            {doc.approverComment && (
              <p className="text-sm mt-2"><span className="text-muted-foreground">意见：</span>{doc.approverComment}</p>
            )}
          </section>
        )}

        {/* Action bar */}
        <div className="flex gap-2 flex-wrap">
          {isDraft && (
            <>
              {hasPermission('change_doc', 'update') && (
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>保存</Button>
              )}
              <Button variant="outline" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>提交审批</Button>
            </>
          )}
          {isPending && hasPermission('change_doc', 'approve') && (
            <>
              <div className="flex items-center gap-2 w-full">
                <Input
                  placeholder="审批意见（可选）"
                  value={approveComment}
                  onChange={e => setApproveComment(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              <Button onClick={() => approveMutation.mutate(true)} disabled={approveMutation.isPending}>审批通过</Button>
              <Button variant="destructive" onClick={() => approveMutation.mutate(false)} disabled={approveMutation.isPending}>拒绝</Button>
            </>
          )}
          {doc.status === 'approved' && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={exporting}>
                <Download className="h-4 w-4 mr-1" />导出 PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('docx')} disabled={exporting}>
                <Download className="h-4 w-4 mr-1" />导出 Word
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
