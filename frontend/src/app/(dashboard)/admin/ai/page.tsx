'use client'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { useRouter } from 'next/navigation'

interface AiProviderConfigVO {
  provider: string
  providerLabel: string
  baseUrl: string
  model: string
  enabled: boolean
  systemPrompt: string
  configured: boolean
}

interface ProviderFormState {
  apiKey: string
  baseUrl: string
  model: string
  enabled: boolean
  systemPrompt: string
}

function ProviderCard({
  config,
  canWrite,
}: {
  config: AiProviderConfigVO
  canWrite: boolean
}) {
  const [form, setForm] = useState<ProviderFormState>({
    apiKey: '',
    baseUrl: config.baseUrl,
    model: config.model,
    enabled: config.enabled,
    systemPrompt: config.systemPrompt,
  })

  useEffect(() => {
    setForm({
      apiKey: '',
      baseUrl: config.baseUrl,
      model: config.model,
      enabled: config.enabled,
      systemPrompt: config.systemPrompt,
    })
  }, [config])

  const saveMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        baseUrl: form.baseUrl,
        model: form.model,
        enabled: form.enabled,
        systemPrompt: form.systemPrompt,
      }
      if (form.apiKey && !form.apiKey.startsWith('••')) {
        body.apiKey = form.apiKey
      }
      return api.put(`/admin/ai/providers/${config.provider}`, body)
    },
    onSuccess: () => toast.success(`${config.providerLabel} 配置已保存`),
    onError: () => toast.error('保存失败'),
  })

  const testMutation = useMutation({
    mutationFn: () =>
      api.post(`/admin/ai/providers/${config.provider}/test`).then(r => r.data.data as string),
    onSuccess: (reply: string) => toast.success(`测试成功：${reply}`),
    onError: () => toast.error('测试失败'),
  })

  return (
    <section className="border rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{config.providerLabel}</h2>
        <div className="flex items-center gap-2">
          <Switch
            id={`${config.provider}-enabled`}
            checked={form.enabled}
            onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))}
            disabled={!canWrite}
          />
          <Label htmlFor={`${config.provider}-enabled`}>启用</Label>
        </div>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>API Key</Label>
          <Input
            type="password"
            value={form.apiKey}
            onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
            placeholder={config.configured ? '••••••••（已配置，留空则不修改）' : '请输入 API Key'}
            disabled={!canWrite}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Base URL</Label>
            <Input
              value={form.baseUrl}
              onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
              placeholder="https://api.example.com/v1"
              disabled={!canWrite}
            />
          </div>
          <div className="space-y-1.5">
            <Label>模型</Label>
            <Input
              value={form.model}
              onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
              placeholder="model-name"
              disabled={!canWrite}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>系统提示词</Label>
          <Textarea
            value={form.systemPrompt}
            onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
            rows={4}
            placeholder="You are a helpful assistant..."
            disabled={!canWrite}
          />
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              保存
            </Button>
            <Button
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              测试
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

export default function AdminAiPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const canRead = hasPermission('ai_config', 'read')
  const canWrite = hasPermission('ai_config', 'write')

  useEffect(() => {
    if (!canRead) router.replace('/')
  }, [canRead, router])

  const { data: providers = [], isLoading } = useQuery<AiProviderConfigVO[]>({
    queryKey: ['ai-providers'],
    queryFn: () => api.get('/admin/ai/providers').then(r => r.data.data),
    enabled: canRead,
  })

  if (!canRead) return null

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">AI 网关配置</h1>
      {isLoading ? (
        <p className="text-muted-foreground">加载中…</p>
      ) : (
        providers.map(p => (
          <ProviderCard key={p.provider} config={p} canWrite={canWrite} />
        ))
      )}
    </div>
  )
}
