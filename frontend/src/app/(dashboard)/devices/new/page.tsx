'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card, CardContent } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Textarea } from '@/components/v2/Textarea'
import { toast } from 'sonner'
import { ArrowLeft, Lock } from 'lucide-react'
import Link from 'next/link'
import { CiInstanceSelect } from '@/components/cmdb/CiInstanceSelect'

interface CiDetail {
  id: number
  name: string
  modelId: string
  modelName: string
  fieldsData: Record<string, any>
}

// CMDB modelId → 设备类型中文（与后端 mapModelToDeviceType 对齐）
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

  // 选中 CI 后拉详情，派生只读字段
  const { data: ci } = useQuery<CiDetail>({
    queryKey: ['ci-detail-for-device', ciId],
    queryFn: () => api.get(`/cmdb/instances/${ciId}`).then((r) => r.data.data),
    enabled: !!ciId,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/devices', {
        ci_instance_id: ciId,
        category: form.category || null,
        description: form.description || null,
      }),
    onSuccess: (res) => {
      toast.success('设备已创建')
      router.push(`/devices/${res.data.data.id}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/devices"
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Link>
        <h1 className="text-2xl font-bold text-v2-fg">新增设备凭证</h1>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          {/* CI 选择（必填） */}
          <div className="space-y-1.5">
            <Label>选择 CMDB 资产 *</Label>
            <CiInstanceSelect value={ciId} onChange={setCiId} />
            {!ciId && (
              <p className="text-xs text-v2-muted">
                密码必须关联到已存在的 CMDB 资产。找不到？{' '}
                <Link href="/cmdb/instances" className="text-v2-primary hover:underline">
                  去 CMDB 创建
                </Link>
              </p>
            )}
          </div>

          {ci && (
            <>
              {/* 只读字段：来自 CMDB */}
              <div className="rounded-v2-md border border-v2-border bg-v2-surface-soft p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-v2-muted uppercase tracking-wider">
                  <Lock className="h-3.5 w-3.5" />
                  以下信息来自 CMDB（只读）
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <dt className="text-xs text-v2-muted">设备名称</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-v2-fg">{ci.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-v2-muted">IP 地址</dt>
                    <dd className="mt-0.5 font-v2-mono text-sm text-v2-fg">
                      {ci.fieldsData?.inner_ip || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-v2-muted">设备类型</dt>
                    <dd className="mt-0.5 text-sm text-v2-fg">{deviceTypeName(ci.modelId)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-v2-muted">模型</dt>
                    <dd className="mt-0.5 text-sm text-v2-fg">{ci.modelName}</dd>
                  </div>
                </dl>
              </div>

              {/* 可编辑字段 */}
              <div className="space-y-1.5">
                <Label>分类标签</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="例：生产环境、MySQL 主库"
                />
                <p className="text-xs text-v2-muted">可选，用于进一步分类筛选</p>
              </div>

              <div className="space-y-1.5">
                <Label>备注</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="用途、注意事项等补充说明"
                  rows={3}
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="primary"
              onClick={() => createMutation.mutate()}
              disabled={!ciId || createMutation.isPending}
            >
              {createMutation.isPending ? '创建中…' : '创建设备'}
            </Button>
            <Button variant="secondary" onClick={() => router.push('/devices')}>
              取消
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
