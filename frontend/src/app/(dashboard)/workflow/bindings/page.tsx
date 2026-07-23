'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api-error'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  const [editing, setEditing] = useState<Binding | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Binding | null>(null)
  const [businessType, setBusinessType] = useState('')
  const [processDefinitionId, setProcessDefinitionId] = useState('')
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionBindingId, setActionBindingId] = useState<number | null>(null)

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

  const openCreateDialog = () => {
    setEditing(null)
    setBusinessType('')
    setProcessDefinitionId('')
    setRemark('')
    setDialogOpen(true)
  }

  const openEditDialog = (binding: Binding) => {
    setEditing(binding)
    setBusinessType(binding.businessType)
    setProcessDefinitionId(binding.processDefinitionId)
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
      toast.success(editing ? '绑定已更新' : '绑定成功')
      setDialogOpen(false)
      setEditing(null)
      await refetch()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '绑定失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (binding: Binding) => {
    setActionBindingId(binding.id)
    try {
      await api.post(`/workflow/center/bindings/${binding.id}/${binding.enabled ? 'disable' : 'enable'}`)
      toast.success(binding.enabled ? '绑定已停用' : '绑定已启用')
      await refetch()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, binding.enabled ? '停用失败' : '启用失败'))
    } finally {
      setActionBindingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setActionBindingId(deleteTarget.id)
    try {
      await api.delete(`/workflow/center/bindings/${deleteTarget.id}`)
      toast.success('绑定已删除')
      setDeleteTarget(null)
      await refetch()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '删除失败'))
    } finally {
      setActionBindingId(null)
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
            <Button variant="primary" size="sm" onClick={openCreateDialog}>
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
              <div className="flex shrink-0 items-center gap-2">
                <span className="mr-2 text-xs text-v2-subtle">
                  {b.updatedAt ? new Date(b.updatedAt).toLocaleString('zh-CN') : ''}
                </span>
                {canConfigure && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(b)}>编辑</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionBindingId === b.id}
                      onClick={() => handleToggle(b)}
                    >
                      {b.enabled ? '停用' : '启用'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-v2-danger"
                      disabled={actionBindingId === b.id}
                      onClick={() => setDeleteTarget(b)}
                    >
                      删除
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑流程绑定' : '新增流程绑定'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                业务类型<span className="text-v2-danger"> *</span>
              </Label>
              <Select value={businessType} onValueChange={(v) => setBusinessType(v ?? '')} disabled={editing !== null}>
                <SelectTrigger disabled={editing !== null}>
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
              <p className="text-xs text-v2-muted">{editing ? '更新只影响后续新启动的流程实例。' : '同一业务类型只保留一条活动绑定。'}</p>
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
              {editing ? '保存' : '绑定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除流程绑定</AlertDialogTitle>
            <AlertDialogDescription>
              删除「{deleteTarget ? businessTypeLabel(deleteTarget.businessType) : ''}」后，新业务将无法启动审批；已有流程实例不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBindingId !== null}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={actionBindingId !== null}
              onClick={handleDelete}
            >
              {actionBindingId !== null ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
