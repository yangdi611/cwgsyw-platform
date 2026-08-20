'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { CiInstanceSelect } from '@/components/cmdb/CiInstanceSelect'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Field,
  FormSettingsPage,
  Input,
  PageHeader,
  Textarea,
} from '@/design-system/figma-neutral/components'

interface CiDetail {
  id: number
  name: string
  modelId: string
  modelName: string
  fieldsData: Record<string, unknown>
}

function deviceTypeName(modelId?: string): string {
  if (!modelId) return '其他'
  if (['host', 'app'].includes(modelId)) return '服务器'
  if (['switch', 'router'].includes(modelId)) return '网络设备'
  if (modelId === 'firewall') return '安全设备'
  return '其他'
}

export default function NewDevicePage() {
  const router = useRouter()
  const [ciId, setCiId] = useState<number | null>(null)
  const [form, setForm] = useState({ category: '', description: '' })

  const { data: ci } = useQuery<CiDetail>({
    queryKey: ['ci-detail-for-device', ciId],
    queryFn: () => api.get(`/cmdb/instances/${ciId}`).then((r) => r.data.data),
    enabled: !!ciId,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/devices', {
        ciInstanceId: ciId,
        category: form.category || null,
        description: form.description || null,
      }),
    onSuccess: (res) => {
      toast.success('设备已创建')
      router.push(`/devices/${res.data.data.id}`)
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '创建失败')),
  })

  return (
    <FormSettingsPage
      embedded
      className="cwgsyw-devices cwgsyw-devices-new"
      layout="default"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title="新增设备凭证"
          subtitle="把访问凭证绑定到已有 CMDB 资产。名称、IP 和类型从资产只读带出。"
        />
      }
      form={
        <section className="cwgsyw-devices-panel">
          <header className="cwgsyw-devices-panel__head">创建设备</header>
          <div className="cwgsyw-devices-panel__body cwgsyw-form">
            <Field
              label="选择 CMDB 资产"
              required
              helperText="密码必须关联到已存在的 CMDB 资产。"
            >
              <CiInstanceSelect value={ciId} onChange={setCiId} />
            </Field>
            {!ciId ? (
              <p className="cwgsyw-type-label-xs">
                找不到资产？<Link href="/cmdb">去 CMDB 创建</Link>
              </p>
            ) : null}

            {ci ? (
              <>
                <section className="cwgsyw-devices-panel cwgsyw-devices-panel--nested">
                  <header className="cwgsyw-devices-panel__head">来自 CMDB（只读）</header>
                  <div className="cwgsyw-devices-panel__body">
                  <p className="cwgsyw-devices-panel__hint">这些字段由所选资产带出，不能在本页修改。</p>
                  <dl className="cwgsyw-devices-defs">
                    <div>
                      <dt className="cwgsyw-type-label-xs">设备名称</dt>
                      <dd className="cwgsyw-type-body-sm">{ci.name}</dd>
                    </div>
                    <div>
                      <dt className="cwgsyw-type-label-xs">IP 地址</dt>
                      <dd className="cwgsyw-type-body-sm">{String(ci.fieldsData?.inner_ip ?? '-')}</dd>
                    </div>
                    <div>
                      <dt className="cwgsyw-type-label-xs">设备类型</dt>
                      <dd className="cwgsyw-type-body-sm">{deviceTypeName(ci.modelId)}</dd>
                    </div>
                    <div>
                      <dt className="cwgsyw-type-label-xs">模型</dt>
                      <dd className="cwgsyw-type-body-sm">{ci.modelName}</dd>
                    </div>
                  </dl>
                  </div>
                </section>
                <Field htmlFor="device-category" label="分类标签" helperText="可选，用于进一步分类筛选">
                  <Input
                    id="device-category"
                    size="sm"
                    value={form.category}
                    placeholder="例：生产环境、MySQL 主库"
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  />
                </Field>
                <Field htmlFor="device-description" label="备注">
                  <Textarea
                    id="device-description"
                    size="sm"
                    rows={3}
                    placeholder="用途、注意事项等补充说明"
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </Field>
              </>
            ) : null}

            <div className="cwgsyw-inline-controls">
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={createMutation.isPending}
                disabled={!ciId}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? '创建中…' : '创建设备'}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => router.push('/devices')}>
                取消
              </Button>
            </div>
          </div>
        </section>
      }
    />
  )
}
