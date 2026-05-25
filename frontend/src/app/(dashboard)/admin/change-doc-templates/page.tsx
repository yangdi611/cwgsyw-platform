'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Upload, Settings } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface TemplateVO {
  id: number
  name: string
  description: string
  version: number
  is_active: boolean
  has_docx: boolean
  fields: { id: number; field_key: string; label: string }[]
  created_at: string
}

export default function ChangeDocTemplatesPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  useEffect(() => {
    if (!hasPermission('change_doc_template', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: templates = [], isLoading } = useQuery<TemplateVO[]>({
    queryKey: ['change-doc-templates'],
    queryFn: () => api.get('/admin/change-doc-templates').then(r => r.data.data),
    enabled: hasPermission('change_doc_template', 'read'),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post(`/admin/change-doc-templates?name=${encodeURIComponent(newName)}&description=${encodeURIComponent(newDesc ?? '')}`),
    onSuccess: (res) => {
      toast.success('模板已创建')
      queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] })
      setCreating(false)
      setNewName('')
      setNewDesc('')
      router.push(`/admin/change-doc-templates/${res.data.data.id}`)
    },
    onError: () => toast.error('创建失败'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api.put(`/admin/change-doc-templates/${id}/active?active=${active}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] }),
    onError: () => toast.error('操作失败'),
  })

  const handleUpload = async (templateId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post(`/admin/change-doc-templates/${templateId}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await api.post(`/admin/change-doc-templates/${templateId}/parse-bookmarks`)
      toast.success('模板文件已上传，书签已解析')
      queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '上传失败')
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">变更文档模板</h1>
          <p className="text-sm text-muted-foreground mt-1">管理 Word 模板文件和字段配置</p>
        </div>
        {hasPermission('change_doc_template', 'write') && (
          <Button size="sm" onClick={() => setCreating(v => !v)}>
            <Plus className="h-4 w-4 mr-1" />新建模板
          </Button>
        )}
      </div>

      {creating && (
        <div className="border rounded-lg p-4 mb-6 space-y-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">模板名称 *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="例：网络变更模板" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">描述</Label>
              <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="适用场景说明" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newName || createMutation.isPending}>
              创建
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>取消</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : (
        <div className="space-y-3">
          {templates.map(tpl => (
            <div key={tpl.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{tpl.name}</span>
                    <Badge variant={tpl.is_active ? 'default' : 'secondary'}>
                      {tpl.is_active ? '启用中' : '已禁用'}
                    </Badge>
                    {tpl.has_docx && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">已上传 .docx</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">v{tpl.version} · {tpl.fields?.length ?? 0} 个字段</span>
                  </div>
                  {tpl.description && (
                    <p className="text-sm text-muted-foreground mt-1">{tpl.description}</p>
                  )}
                </div>

                {hasPermission('change_doc_template', 'write') && (
                  <div className="flex gap-2 shrink-0">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".docx"
                        className="hidden"
                        onChange={e => { if (e.target.files?.[0]) handleUpload(tpl.id, e.target.files[0]) }}
                      />
                      <Button size="sm" variant="outline" type="button">
                        <Upload className="h-4 w-4 mr-1" />上传 .docx
                      </Button>
                    </label>
                    <Link href={`/admin/change-doc-templates/${tpl.id}`} className="inline-flex items-center gap-1 border rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
                      <Settings className="h-4 w-4" />配置字段
                    </Link>
                    <Button
                      size="sm"
                      variant={tpl.is_active ? 'secondary' : 'outline'}
                      onClick={() => toggleMutation.mutate({ id: tpl.id, active: !tpl.is_active })}
                      disabled={toggleMutation.isPending}
                    >
                      {tpl.is_active ? '禁用' : '启用'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">暂无模板</p>
          )}
        </div>
      )}
    </div>
  )
}
