'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { Label } from '@/components/v2/Label'
import { Input } from '@/components/v2/Input'
import { StatusBadge } from '@/components/v2/StatusBadge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/v2/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/v2/Dialog'
import { PageHeader, EmptyState } from '@/components/shared'
import { toast } from 'sonner'
import { Link2, Plus } from 'lucide-react'

interface Binding {
  id: number
  tenantId: string
  businessType: string
  processDefinitionId: string
  processDefinitionKey: string
  processDefinitionVersion: number
  templateInstanceId: number | null
  enabled: boolean
  updatedAt: string
}

interface ProcessDef {
  id: string
  name: string
  key: string
  version: number
}

const BUSINESS_TYPES = [
  { value: 'daily_report', label: '日报审批' },
  { value: 'wiki_page', label: 'Wiki 页面审批' },
  { value: 'change_doc', label: '变更文档审批' },
]

function businessTypeLabel(v: string): string {
  return BUSINESS_TYPES.find((b) => b.value === v)?.label ?? v
}

export default function WorkflowBindingsPage() {
  const { hasPermission } = usePermission()
  const canConfigure = hasPermission('workflow', 'configure')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [businessType, setBusinessType] = useState('')
  const [processDefinitionId, setProcessDefinitionId] = useState('')
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: bindings, isLoading, refetch } = useQuery({
    queryKey: ['workflow-bindings'],
    queryFn: () =>
      api.get('/workflow/center/bindings').then((r) => r.data.data as Binding[]),
  })

  const { data: definitions } = useQuery({
    queryKey: ['workflow-definitions-all'],
    queryFn: () =>
      api
        .get('/workflow/definitions', { params: { page: 1, size: 200 } })
        .then((r) => (r.data.data?.records ?? []) as ProcessDef[]),
  })

  const openDialog = () => {
    setBusinessType('')
    setProcessDefinitionId('')
    setRemark('')
    setDialogOpen(true)
  }

  const canSubmit = useMemo(
    () => Boolean(businessType && processDefinitionId),
    [businessType, processDefinitionId],
  )

  const handleBind = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await api.post('/workflow/center/bindings', {
        businessType,
        processDefinitionId,
        remark: remark.trim() || undefined,
      })
      toast.success('绑定成功')
      setDialogOpen(false)
      refetch()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '绑定失败')
    } finally {
      setSubmitting(false)
    }
  }

  const rows = bindings ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="流程中心"
        title="流程绑定"
        subtitle="将业务类型绑定到具体的流程定义版本，业务提交时按绑定的流程发起审批。"
        actions={
          canConfigure ? (
            <Button variant="primary" size="sm" onClick={openDialog}>
              <Plus className="h-4 w-4" />
              新增绑定
            </Button>
          ) : undefined
        }
      />

      {isLoading ? null : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Link2 className="h-5 w-5 text-v2-muted" />}
            title="暂无流程绑定"
            description="尚未为任何业务类型绑定流程定义，业务提交将无法发起审批。"
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <Card key={b.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-v2-fg">{businessTypeLabel(b.businessType)}</span>
                  <StatusBadge status={b.enabled ? 'ok' : 'neutral'}>
                    {b.enabled ? '已启用' : '已停用'}
                  </StatusBadge>
                  {b.templateInstanceId != null && (
                    <span className="rounded-md border border-v2-border bg-v2-surface-soft px-2 py-0.5 text-xs text-v2-muted">
                      模板实例 #{b.templateInstanceId}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-v2-muted">
                  {b.processDefinitionKey} v{b.processDefinitionVersion}
                  <span className="ml-2 text-v2-subtle">{b.processDefinitionId}</span>
                </p>
              </div>
              <div className="shrink-0 text-xs text-v2-subtle">
                {b.updatedAt ? new Date(b.updatedAt).toLocaleString('zh-CN') : ''}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新增流程绑定</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                业务类型<span className="text-v2-danger"> *</span>
              </Label>
              <Select value={businessType} onValueChange={(v) => setBusinessType(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="选择业务类型">
                    {(v: string) => BUSINESS_TYPES.find((b) => b.value === v)?.label ?? '选择业务类型'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                流程定义<span className="text-v2-danger"> *</span>
              </Label>
              <Select value={processDefinitionId} onValueChange={(v) => setProcessDefinitionId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="选择流程定义版本">
                    {(v: string) => {
                      const d = (definitions ?? []).find((def) => def.id === v)
                      return d ? `${d.name} (${d.key} v${d.version})` : '选择流程定义版本'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(definitions ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.key} v{d.version})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-v2-muted">绑定后将覆盖该业务类型现有的流程绑定。</p>
            </div>
            <div className="space-y-1.5">
              <Label>备注</Label>
              <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="可选" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button variant="primary" onClick={handleBind} disabled={!canSubmit || submitting}>
              绑定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
