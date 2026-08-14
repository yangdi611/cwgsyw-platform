'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Chip,
  DataManagementPage,
  EmptyState,
  Field,
  Input,
  LoadingState,
  NeutralAlertDialog,
  NeutralDialog,
  PageHeader,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

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
    queryFn: () => api.get('/workflow/center/bindings').then((r) => r.data.data as Binding[]),
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

  const rows = (bindings ?? []).map((b) => ({
    id: String(b.id),
    cells: {
      type: businessTypeLabel(b.businessType),
      process: `${b.processDefinitionKey} v${b.processDefinitionVersion}`,
      template: b.templateInstanceId != null ? <Chip label={`模板实例 #${b.templateInstanceId}`} /> : '-',
      status: <StatusBadge label={b.enabled ? '已启用' : '已停用'} status={b.enabled ? 'success' : 'neutral'} />,
      updated: b.updatedAt ? new Date(b.updatedAt).toLocaleString('zh-CN') : '',
      actions: canConfigure ? (
        <div className="cwgsyw-inline-controls">
          <Button type="button" variant="ghost" size="sm" onClick={() => openEditDialog(b)}>
            编辑
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={actionBindingId === b.id}
            onClick={() => handleToggle(b)}
          >
            {b.enabled ? '停用' : '启用'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={actionBindingId === b.id}
            onClick={() => setDeleteTarget(b)}
          >
            删除
          </Button>
        </div>
      ) : null,
    },
  }))

  return (
    <>
      <DataManagementPage
        embedded
        header={
          <PageHeader
            eyebrow="流程中心"
            title="流程绑定"
            subtitle="将业务类型绑定到具体的流程定义版本，业务提交时按绑定的流程发起审批。"
            breadcrumb={
              <Breadcrumb
                items={[
                  { href: '/', label: '工作台' },
                  { href: '/workflow/design', label: '流程中心' },
                  { label: '流程绑定' },
                ]}
              />
            }
            actions={
              canConfigure ? (
                <Button type="button" variant="primary" onClick={openCreateDialog}>
                  新增绑定
                </Button>
              ) : undefined
            }
          />
        }
        content={
          isLoading ? (
            <LoadingState label="加载流程绑定" />
          ) : rows.length === 0 ? (
            <EmptyState
              title="暂无流程绑定"
              description="尚未为任何业务类型绑定流程定义，业务提交将无法发起审批。"
            />
          ) : (
            <Table
              showSearch={false}
              columns={[
                { key: 'type', label: '业务类型' },
                { key: 'process', label: '流程定义' },
                { key: 'template', label: '模板' },
                { key: 'status', label: '状态' },
                { key: 'updated', label: '更新时间' },
                ...(canConfigure ? [{ key: 'actions', label: '操作', align: 'right' as const }] : []),
              ]}
              rows={rows}
            />
          )
        }
      />

      <NeutralDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? '编辑流程绑定' : '新增流程绑定'}
        showDescription={false}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button type="button" disabled={!canSubmit || submitting} loading={submitting} onClick={handleBind}>
              {editing ? '保存' : '绑定'}
            </Button>
          </>
        }
      >
        <div className="cwgsyw-form">
          <Field label="业务类型" htmlFor="binding-type" required>
            <Select
              id="binding-type"
              value={businessType}
              disabled={editing !== null}
              placeholder="选择业务类型"
              options={BUSINESS_TYPES}
              onChange={setBusinessType}
            />
          </Field>
          <Field
            label="流程定义"
            htmlFor="binding-def"
            required
            helperText={editing ? '更新只影响后续新启动的流程实例。' : '同一业务类型只保留一条活动绑定。'}
          >
            <Select
              id="binding-def"
              value={processDefinitionId}
              placeholder="选择流程定义版本"
              options={(definitions ?? []).map((d) => ({
                value: d.id,
                label: `${d.name} (${d.key} v${d.version})`,
              }))}
              onChange={setProcessDefinitionId}
            />
          </Field>
          <Field label="备注" htmlFor="binding-remark">
            <Input id="binding-remark" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="可选" />
          </Field>
        </div>
      </NeutralDialog>

      <NeutralAlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="确认删除流程绑定"
        description={`删除「${deleteTarget ? businessTypeLabel(deleteTarget.businessType) : ''}」后，新业务将无法启动审批；已有流程实例不受影响。`}
        intent="destructive"
        confirmLabel={actionBindingId !== null ? '删除中…' : '确认删除'}
        onConfirm={handleDelete}
      />
    </>
  )
}
