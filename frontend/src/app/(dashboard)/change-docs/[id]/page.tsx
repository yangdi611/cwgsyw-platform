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
import { Download, Mail, History } from 'lucide-react'

interface ChangeDocVO {
  id: number
  changeNo: string
  title: string
  status: string
  applicantName: string
  applyTime: string
  changeDesc: string
  impactScope: string
  changeWindow: string
  resourceSupport: string
  background: string
  steps: string
  riskAssessment: string
  rollbackPlan: string
  verifyMethod: string
  contacts: string
  approvedAt: string
  approverName: string
  approverComment: string
  createdAt: string
  updatedAt: string
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

  const [form, setForm] = useState<Partial<ChangeDocVO>>({})
  const [aiLoading, setAiLoading] = useState(false)
  const [approveComment, setApproveComment] = useState('')
  const [emailBody, setEmailBody] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const { data: snapshots = [] } = useQuery<{ id: number; remark: string; created_at: string; operator_id: number }[]>({
    queryKey: ['change-doc-snapshots', id],
    queryFn: () => api.get(`/change-docs/${id}/snapshots`).then(r => r.data.data),
    enabled: showHistory && hasPermission('change_doc', 'read'),
  })

  useEffect(() => {
    if (!hasPermission('change_doc', 'read')) router.replace('/')
  }, [hasPermission, router])

  useEffect(() => {
    if (doc) setForm(doc)
  }, [doc])

  const isDraft = doc?.status === 'draft'
  const isPending = doc?.status === 'pending'
  const st = doc ? (STATUS_MAP[doc.status] ?? { label: doc.status, variant: 'secondary' as const }) : null

  const set = (k: keyof ChangeDocVO) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/change-docs/${id}`, {
      title: form.title,
      changeDesc: form.changeDesc,
      impactScope: form.impactScope,
      changeWindow: form.changeWindow,
      resourceSupport: form.resourceSupport,
      background: form.background,
      steps: form.steps,
      riskAssessment: form.riskAssessment,
      rollbackPlan: form.rollbackPlan,
      verifyMethod: form.verifyMethod,
      contacts: form.contacts,
    }),
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

  const handleAiGenerate = async () => {
    if (!doc) return
    setAiLoading(true)
    try {
      const res = await api.post(`/change-docs/${id}/ai-generate`, {
        changeDesc: form.changeDesc || doc.changeDesc,
        impactScope: form.impactScope || doc.impactScope,
        changeWindow: form.changeWindow || doc.changeWindow,
      })
      const raw = res.data.data as string
      try {
        const cleaned = raw.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        setForm(f => ({
          ...f,
          background: parsed.background ?? f.background,
          steps: parsed.steps ?? f.steps,
          riskAssessment: parsed.risk_assessment ?? f.riskAssessment,
          rollbackPlan: parsed.rollback_plan ?? f.rollbackPlan,
          verifyMethod: parsed.verify_method ?? f.verifyMethod,
        }))
        toast.success('AI 内容已生成，请审阅后保存')
      } catch {
        setForm(f => ({ ...f, steps: raw }))
        toast.success('AI 内容已填入步骤字段（非JSON格式），请审阅后保存')
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? 'AI 生成失败')
    } finally {
      setAiLoading(false)
    }
  }

  const handleExport = async (format: 'pdf' | 'docx') => {
    setExporting(true)
    try {
      const res = await api.get(`/change-docs/${id}/export`, {
        params: { format },
        responseType: 'blob',
      })
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

  const handleEmailTemplate = async () => {
    try {
      const res = await api.get(`/change-docs/${id}/email-template`)
      setEmailBody(res.data.data)
    } catch {
      toast.error('获取邮件模板失败')
    }
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">加载中...</p>
  if (!doc) return <p className="text-muted-foreground text-sm">文档不存在</p>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>← 返回</Button>
        <h1 className="text-xl font-bold flex-1">{doc.changeNo} — {doc.title}</h1>
        {st && <Badge variant={st.variant}>{st.label}</Badge>}
      </div>

      <div className="space-y-6">
        {/* 变更申请单 */}
        <section className="border rounded-lg p-5">
          <h2 className="font-semibold text-base mb-4">变更申请单</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">申请人：</span>{doc.applicantName}</div>
              <div><span className="text-muted-foreground">申请时间：</span>{doc.applyTime}</div>
            </div>
            <div className="space-y-1.5">
              <Label>标题</Label>
              {isDraft ? <Input value={form.title ?? ''} onChange={set('title')} /> : <p className="text-sm">{doc.title}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>变更内容描述</Label>
              {isDraft ? <Textarea value={form.changeDesc ?? ''} onChange={set('changeDesc')} rows={3} /> : <p className="text-sm whitespace-pre-wrap">{doc.changeDesc}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>影响范围</Label>
              {isDraft ? <Textarea value={form.impactScope ?? ''} onChange={set('impactScope')} rows={2} /> : <p className="text-sm whitespace-pre-wrap">{doc.impactScope}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>变更时间窗口</Label>
                {isDraft ? <Input value={form.changeWindow ?? ''} onChange={set('changeWindow')} /> : <p className="text-sm">{doc.changeWindow}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>资源支持说明</Label>
                {isDraft ? <Textarea value={form.resourceSupport ?? ''} onChange={set('resourceSupport')} rows={2} /> : <p className="text-sm whitespace-pre-wrap">{doc.resourceSupport}</p>}
              </div>
            </div>
          </div>
        </section>

        {/* 变更方案 */}
        <section className="border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base">变更方案</h2>
            {isDraft && (
              <Button variant="outline" size="sm" onClick={handleAiGenerate} disabled={aiLoading}>
                {aiLoading ? 'AI 生成中...' : '✨ AI 辅助生成'}
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {(['background', 'steps', 'riskAssessment', 'rollbackPlan', 'verifyMethod', 'contacts'] as const).map(field => {
              const labels: Record<string, string> = {
                background: '背景与目的', steps: '详细操作步骤',
                riskAssessment: '风险评估与应对措施', rollbackPlan: '回滚计划',
                verifyMethod: '验证方法', contacts: '相关人员联系方式',
              }
              return (
                <div key={field} className="space-y-1.5">
                  <Label>{labels[field]}</Label>
                  {isDraft
                    ? <Textarea value={form[field] ?? ''} onChange={set(field)} rows={3} />
                    : <p className="text-sm whitespace-pre-wrap">{(doc as unknown as Record<string, string>)[field] || '—'}</p>
                  }
                </div>
              )
            })}
          </div>
        </section>

        {/* 审批结果 */}
        {(doc.status === 'approved' || doc.status === 'rejected') && (
          <section className="border rounded-lg p-5">
            <h2 className="font-semibold text-base mb-3">审批结果</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">审批人：</span>{doc.approverName}</div>
              <div><span className="text-muted-foreground">审批时间：</span>{doc.approvedAt}</div>
            </div>
            {doc.approverComment && <p className="text-sm mt-2"><span className="text-muted-foreground">意见：</span>{doc.approverComment}</p>}
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
          {/* Export buttons — visible for approved docs with export permission */}
          {doc.status === 'approved' && hasPermission('change_doc', 'export') && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={exporting}>
                <Download className="h-4 w-4 mr-1" />导出 PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('docx')} disabled={exporting}>
                <Download className="h-4 w-4 mr-1" />导出 Word
              </Button>
              <Button variant="outline" size="sm" onClick={handleEmailTemplate}>
                <Mail className="h-4 w-4 mr-1" />生成邮件
              </Button>
            </>
          )}
        </div>

        {/* Email template preview */}
        {emailBody && (
          <div className="mt-4 border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">邮件正文（复制后手动发送）</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(emailBody).catch(() => {
                    const el = document.createElement('textarea')
                    el.value = emailBody
                    el.style.cssText = 'position:fixed;opacity:0'
                    document.body.appendChild(el)
                    el.select()
                    document.execCommand('copy')
                    document.body.removeChild(el)
                  })
                  toast.success('邮件内容已复制')
                }}
              >
                复制
              </Button>
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-md max-h-64 overflow-y-auto">
              {emailBody}
            </pre>
          </div>
        )}

        {/* Snapshot history */}
        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(h => !h)}>
            <History className="h-4 w-4 mr-1" />
            {showHistory ? '收起操作历史' : '查看操作历史'}
          </Button>
          {showHistory && (
            <div className="mt-2 border rounded-lg divide-y text-sm">
              {snapshots.length === 0 ? (
                <p className="px-4 py-3 text-muted-foreground text-xs">暂无历史记录</p>
              ) : snapshots.map(s => (
                <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">{s.remark}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
