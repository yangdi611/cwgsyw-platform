'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DataManagementPage,
  EmptyState,
  Field,
  IconButton,
  Input,
  LoadingState,
  NeutralAlertDialog,
  NeutralDialog,
  NeutralTooltip,
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
      template: b.templateInstanceId != null ? <StatusBadge size="sm" label={`模板实例 #${b.templateInstanceId}`} status="neutral" /> : '-',
      status: <StatusBadge size="sm" label={b.enabled ? '已启用' : '已停用'} status={b.enabled ? 'success' : 'neutral'} />,
      updated: b.updatedAt ? new Date(b.updatedAt).toLocaleString('zh-CN') : '',
      actions: canConfigure ? (
        <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions">
          <NeutralTooltip content="编辑" className="cwgsyw-tooltip--pill" followCursor>
            <IconButton
              type="button"
              size="sm"
              variant="ghost"
              icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--edit" />}
              aria-label={`编辑 ${businessTypeLabel(b.businessType)}`}
              onClick={() => openEditDialog(b)}
            />
          </NeutralTooltip>
          <NeutralTooltip content={b.enabled ? '停用' : '启用'} className="cwgsyw-tooltip--pill" followCursor>
            <IconButton
              type="button"
              size="sm"
              variant="ghost"
              disabled={actionBindingId === b.id}
              icon={<span aria-hidden="true" className={`cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon ${b.enabled ? 'cwgsyw-workflow-bindings__figma-action-icon--pause' : 'cwgsyw-workflow-bindings__figma-action-icon--play'}`} />}
              aria-label={`${b.enabled ? '停用' : '启用'} ${businessTypeLabel(b.businessType)}`}
              onClick={() => handleToggle(b)}
            />
          </NeutralTooltip>
          <NeutralTooltip content="删除" className="cwgsyw-tooltip--pill" followCursor>
            <IconButton
              type="button"
              size="sm"
              variant="ghost"
              className="cwgsyw-cmdb-admin__delete-action"
              disabled={actionBindingId === b.id}
              icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--trash" />}
              aria-label={`删除 ${businessTypeLabel(b.businessType)}`}
              onClick={() => setDeleteTarget(b)}
            />
          </NeutralTooltip>
        </div>
      ) : null,
    },
  }))

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-workflow cwgsyw-workflow-bindings"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="流程绑定"
            subtitle="将业务类型绑定到具体的流程定义版本，业务提交时按绑定的流程发起审批。"
            actions={
              canConfigure ? (
                <Button className="cwgsyw-workflow__header-actions" type="button" size="sm" onClick={openCreateDialog}>
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
            <div className="cwgsyw-workflow-empty">
              {/* Official Figma git-branch glyph; image optimization adds no value here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/figma-icons/workflow-git-branch.svg" width={22} height={22} alt="" data-figma-node="6:26741" />
              <EmptyState
                showIcon={false}
                title="暂无流程绑定"
                description="尚未为任何业务类型绑定流程定义，业务提交将无法发起审批。"
              />
            </div>
          ) : (
            <Table
              className="cwgsyw-cmdb-table cwgsyw-workflow-bindings__table"
              density="compact"
              showSearch={false}
              columns={[
                { key: 'type', label: '业务类型' },
                { key: 'process', label: '流程定义' },
                { key: 'template', label: '模板' },
                { key: 'status', label: '状态' },
                { key: 'updated', label: '更新时间' },
                ...(canConfigure ? [{ key: 'actions', label: <span className="cwgsyw-sr-only">操作</span>, align: 'right' as const }] : []),
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
        size="sm"
        footer={
          <div className="cwgsyw-inline-controls cwgsyw-workflow-dialog-actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button type="button" size="sm" disabled={!canSubmit || submitting} loading={submitting} onClick={handleBind}>
              {editing ? '保存' : '绑定'}
            </Button>
          </div>
        }
      >
        <div className="cwgsyw-workflow-dialog-form">
          <Field label="业务类型" htmlFor="binding-type" required>
            <Select
              id="binding-type"
              size="sm"
              overlay
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
            <Input id="binding-remark" size="sm" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="可选" />
          </Field>
        </div>
      </NeutralDialog>

      <NeutralAlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        className="cwgsyw-cmdb-model-detail__delete-dialog"
        icon={<img src="/figma-icons/cmdb-model-alert.svg" alt="" width={56} height={56} />}
        title="确认删除流程绑定"
        description={`删除「${deleteTarget ? businessTypeLabel(deleteTarget.businessType) : ''}」后，新业务将无法启动审批；已有流程实例不受影响。`}
        intent="destructive"
        confirmLabel={actionBindingId !== null ? '删除中…' : '确认删除'}
        onConfirm={handleDelete}
      />
    </>
  )
}
