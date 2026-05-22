'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'

export default function NewChangeDocPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    changeNo: '',
    changeDesc: '',
    impactScope: '',
    changeWindow: '',
    resourceSupport: '',
  })

  useEffect(() => {
    if (!hasPermission('change_doc', 'create')) router.replace('/change-docs')
  }, [hasPermission, router])

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('标题不能为空'); return }
    setSubmitting(true)
    try {
      const res = await api.post('/change-docs', {
        title: form.title,
        changeNo: form.changeNo || undefined,
        changeDesc: form.changeDesc,
        impactScope: form.impactScope,
        changeWindow: form.changeWindow,
        resourceSupport: form.resourceSupport,
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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">新建变更文档</h1>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>标题 *</Label>
          <Input value={form.title} onChange={set('title')} placeholder="变更标题" />
        </div>
        <div className="space-y-1.5">
          <Label>变更编号（可选，留空自动生成）</Label>
          <Input value={form.changeNo} onChange={set('changeNo')} placeholder="CHG-YYYYMMDD-NNN" />
        </div>
        <div className="space-y-1.5">
          <Label>变更内容描述</Label>
          <Textarea value={form.changeDesc} onChange={set('changeDesc')} rows={3} placeholder="描述本次变更的内容" />
        </div>
        <div className="space-y-1.5">
          <Label>影响范围</Label>
          <Textarea value={form.impactScope} onChange={set('impactScope')} rows={2} placeholder="受影响的系统或服务" />
        </div>
        <div className="space-y-1.5">
          <Label>变更时间窗口</Label>
          <Input value={form.changeWindow} onChange={set('changeWindow')} placeholder="例：2026-05-30 02:00-04:00" />
        </div>
        <div className="space-y-1.5">
          <Label>资源支持说明</Label>
          <Textarea value={form.resourceSupport} onChange={set('resourceSupport')} rows={2} placeholder="所需资源或人员支持" />
        </div>
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
