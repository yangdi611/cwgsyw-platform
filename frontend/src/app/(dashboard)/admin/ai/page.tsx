'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Card,
  ErrorState,
  Field,
  FormSettingsPage,
  Input,
  LoadingState,
  PageHeader,
  Switch,
  Textarea,
} from '@/design-system/figma-neutral/components'

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

function ProviderCard({ config, canWrite }: { config: AiProviderConfigVO; canWrite: boolean }) {
  const [form, setForm] = useState<ProviderFormState>({
    apiKey: '',
    baseUrl: config.baseUrl,
    model: config.model,
    enabled: config.enabled,
    systemPrompt: config.systemPrompt,
  })

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
    mutationFn: () => api.post(`/admin/ai/providers/${config.provider}/test`).then((r) => r.data.data as string),
    onSuccess: (reply: string) => toast.success(`测试成功：${reply}`),
    onError: () => toast.error('测试失败'),
  })

  return (
    <Card title={config.providerLabel} headerAction={
      <Switch
        id={`${config.provider}-enabled`}
        label="启用"
        checked={form.enabled}
        disabled={!canWrite}
        onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
      />
    }>
      <div className="cwgsyw-form">
        <Field label="API Key">
          <Input
            type="password"
            value={form.apiKey}
            onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder={config.configured ? '••••••••（已配置，留空则不修改）' : '请输入 API Key'}
            disabled={!canWrite}
          />
        </Field>
        <div className="cwgsyw-filter-grid">
          <Field label="Base URL">
            <Input
              value={form.baseUrl}
              onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
              placeholder="https://api.example.com/v1"
              disabled={!canWrite}
            />
          </Field>
          <Field label="模型">
            <Input
              value={form.model}
              onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
              placeholder="model-name"
              disabled={!canWrite}
            />
          </Field>
        </div>
        <Field label="系统提示词">
          <Textarea
            value={form.systemPrompt}
            onChange={(event) => setForm((current) => ({ ...current, systemPrompt: event.target.value }))}
            rows={4}
            placeholder="You are a helpful assistant..."
            disabled={!canWrite}
          />
        </Field>
        {canWrite ? (
          <div className="cwgsyw-designer__actions">
            <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>保存</Button>
            <Button type="button" variant="secondary" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>测试</Button>
          </div>
        ) : null}
      </div>
    </Card>
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

  const { data: providers = [], isLoading, isError, refetch } = useQuery<AiProviderConfigVO[]>({
    queryKey: ['ai-providers'],
    queryFn: () => api.get('/admin/ai/providers').then((r) => r.data.data),
    enabled: canRead,
  })

  if (!canRead) return null

  return (
    <FormSettingsPage
      embedded
      header={
        <PageHeader
          eyebrow="系统管理"
          title="AI 网关配置"
          subtitle="配置 AI 供应商的 API Key、模型与系统提示词，供变更文档 AI 生成使用。"
          breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { href: '/admin/config', label: '系统配置' }, { label: 'AI 网关' }]} />}
        />
      }
      form={
        isLoading ? (
          <LoadingState label="正在加载 AI 网关配置…" />
        ) : isError ? (
          <ErrorState
            title="AI 网关配置加载失败"
            description="无法读取供应商配置，请重试。"
            retry={<Button type="button" variant="secondary" onClick={() => void refetch()}>重试</Button>}
          />
        ) : (
          <div className="cwgsyw-form">
            {providers.map((provider) => (
              <ProviderCard
                key={`${provider.provider}:${provider.baseUrl}:${provider.model}:${provider.enabled}:${provider.systemPrompt}`}
                config={provider}
                canWrite={canWrite}
              />
            ))}
          </div>
        )
      }
    />
  )
}
