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
  Card,
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
  Switch,
  Table,
  Textarea,
} from '@/design-system/figma-neutral/components'

interface TemplateConfigField {
  key: string
  label: string
  type: 'select' | 'user' | 'group' | 'role' | 'string' | 'boolean'
  required: boolean
  options?: string[] | null
  defaultValue?: string | null
}

interface TemplateDefinition {
  code: string
  name: string
  description: string
  version: number
  supportedBusinessTypes: string[]
  configSchema: TemplateConfigField[]
  enabled: boolean
}

interface TemplateInstanceVO {
  id: number
  templateCode: string
  name: string
  processKey: string
  businessType: string
  description: string
  latestProcessDefinitionId: string
  latestVersion: number
  status: string
  createdAt: string
}

const businessTypeLabels: Record<string, string> = {
  wiki_page: 'Wiki 页面',
  change_doc: '变更文档',
  device_access: '设备权限',
}

const sourceOptionLabels: Record<string, string> = {
  specific_user: '指定用户',
  submitter_group_leaders: '提交人组长',
  submitter_group: '提交人所在组',
  specific_group: '指定组',
  role: '按角色',
  any_one: '任一人通过',
}

function optionLabel(v: string): string {
  return sourceOptionLabels[v] ?? v
}

function instanceStatus(status: string): { label: string; tone: 'success' | 'warning' | 'neutral' } {
  if (status === 'active') return { label: '启用', tone: 'success' }
  if (status === 'draft') return { label: '草稿', tone: 'warning' }
  if (status === 'deprecated') return { label: '停用', tone: 'neutral' }
  return { label: status, tone: 'neutral' }
}

function initialValues(tpl: TemplateDefinition): Record<string, string> {
  const values: Record<string, string> = {}
  for (const f of tpl.configSchema) {
    if (f.defaultValue != null) values[f.key] = f.defaultValue
    else if (f.type === 'boolean') values[f.key] = 'false'
    else values[f.key] = ''
  }
  return values
}

export default function WorkflowTemplatesPage() {
  const { hasPermission } = usePermission()
  const canConfigure = hasPermission('workflow', 'configure')

  const [createTpl, setCreateTpl] = useState<TemplateDefinition | null>(null)
  const [name, setName] = useState('')
  const [processKey, setProcessKey] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [description, setDescription] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [bindNow, setBindNow] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TemplateInstanceVO | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => api.get('/workflow/templates').then((r) => r.data.data as TemplateDefinition[]),
  })

  const { data: instances, isLoading: loadingInstances, refetch } = useQuery({
    queryKey: ['workflow-template-instances'],
    queryFn: () => api.get('/workflow/templates/instances').then((r) => r.data.data as TemplateInstanceVO[]),
  })

  const openCreate = (tpl: TemplateDefinition) => {
    setCreateTpl(tpl)
    setName('')
    setProcessKey('')
    setBusinessType(tpl.supportedBusinessTypes[0] ?? '')
    setDescription('')
    setValues(initialValues(tpl))
    setBindNow(false)
  }

  const closeCreate = () => setCreateTpl(null)
  const setValue = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }))
  const processKeyValid = useMemo(() => /^[A-Za-z][A-Za-z0-9_-]{2,63}$/.test(processKey), [processKey])

  const canSubmit = useMemo(() => {
    if (!createTpl) return false
    if (!name.trim() || !processKeyValid || !businessType) return false
    for (const f of createTpl.configSchema) {
      if (f.required && !(values[f.key] ?? '').trim()) return false
    }
    return true
  }, [createTpl, name, processKeyValid, businessType, values])

  const handleCreate = async () => {
    if (!createTpl || !canSubmit) return
    setSubmitting(true)
    try {
      await api.post('/workflow/templates/instances', {
        templateCode: createTpl.code,
        name: name.trim(),
        processKey: processKey.trim(),
        businessType,
        description: description.trim() || undefined,
        configValues: values,
        bindNow,
      })
      toast.success(bindNow ? '模板实例已创建并绑定' : '模板实例已创建')
      closeCreate()
      refetch()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '创建失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/workflow/templates/instances/${deleteTarget.id}`)
      toast.success('模板实例已删除')
      setDeleteTarget(null)
      refetch()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '删除失败'))
    } finally {
      setDeleting(false)
    }
  }

  const renderField = (f: TemplateConfigField) => {
    const val = values[f.key] ?? ''
    if (f.type === 'boolean') {
      return (
        <Switch
          key={f.key}
          label={f.label}
          checked={val === 'true'}
          onChange={(event) => setValue(f.key, String(event.currentTarget.checked))}
        />
      )
    }
    if (f.type === 'select' && f.options && f.options.length > 0) {
      return (
        <Field key={f.key} label={f.label} htmlFor={f.key} required={f.required}>
          <Select
            id={f.key}
            size="sm"
            overlay
            value={val}
            placeholder="请选择"
            options={f.options.map((o) => ({ value: o, label: optionLabel(o) }))}
            onChange={(next) => setValue(f.key, next)}
          />
        </Field>
      )
    }
    const hint =
      f.type === 'user' ? '填写用户 ID' : f.type === 'group' ? '填写组标识' : f.type === 'role' ? '填写角色 code' : undefined
    return (
      <Field key={f.key} label={f.label} htmlFor={f.key} required={f.required}>
        <Input id={f.key} size="sm" value={val} onChange={(event) => setValue(f.key, event.target.value)} placeholder={hint} />
      </Field>
    )
  }

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-workflow cwgsyw-workflow-templates"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="流程模板"
            subtitle="基于内置模板快速生成审批流程，无需手绘 BPMN。创建后可直接绑定到业务类型。"
          />
        }
        content={
          <div className="cwgsyw-form">
            <section className="cwgsyw-workflow-section">
              <header><h2>内置模板</h2></header>
              <div className="cwgsyw-workflow-section__body">
              {loadingTemplates ? (
                <LoadingState label="加载内置模板" />
              ) : (
                <div className="cwgsyw-workflow-templates__catalog">
                  {(templates ?? []).map((tpl) => (
                    <Card
                      key={tpl.code}
                      title={tpl.name}
                      description={tpl.description}
                      padding="sm"
                      headerAction={<StatusBadge size="sm" label={tpl.enabled ? '可用' : '停用'} status={tpl.enabled ? 'success' : 'neutral'} />}
                      footer={
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={!canConfigure || !tpl.enabled}
                          onClick={() => openCreate(tpl)}
                        >
                          基于此模板创建
                        </Button>
                      }
                    >
                      <div className="cwgsyw-inline-controls">
                        {tpl.supportedBusinessTypes.map((bt) => (
                          <StatusBadge key={bt} size="sm" label={businessTypeLabels[bt] ?? bt} status="neutral" />
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              </div>
            </section>

            <section className="cwgsyw-workflow-templates__list" aria-labelledby="workflow-template-instances-title">
              <h2 id="workflow-template-instances-title">已创建的流程实例</h2>
              {loadingInstances ? (
                <LoadingState label="加载模板实例" />
              ) : (instances ?? []).length === 0 ? (
                <div className="cwgsyw-workflow-empty">
                  {/* Official Figma layout-template glyph; image optimization adds no value here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/figma-icons/task-layout-template.svg"
                    width={22}
                    height={22}
                    alt=""
                    data-figma-node="6:27507"
                  />
                  <EmptyState
                    showIcon={false}
                    title="尚未创建流程实例"
                    description="从上方内置模板中选择一个，填写配置即可生成可部署的审批流程。"
                  />
                </div>
              ) : (
                <Table
                  className="cwgsyw-cmdb-table cwgsyw-workflow-templates__table"
                  showSearch={false}
                  density="compact"
                  columns={[
                    { key: 'name', label: '名称' },
                    { key: 'type', label: '业务类型' },
                    { key: 'key', label: '流程 Key' },
                    { key: 'status', label: '状态' },
                    { key: 'created', label: '创建时间' },
                    { key: 'actions', label: <span className="cwgsyw-sr-only">操作</span>, align: 'right' },
                  ]}
                  rows={(instances ?? []).map((inst) => {
                    const status = instanceStatus(inst.status)
                    return {
                      id: String(inst.id),
                      cells: {
                        name: <span className="cwgsyw-workflow-templates__name" title={inst.name}>{inst.name}</span>,
                        type: businessTypeLabels[inst.businessType] ?? inst.businessType,
                        key: `${inst.processKey} · v${inst.latestVersion}`,
                        status: <StatusBadge size="sm" label={status.label} status={status.tone} />,
                        created: new Date(inst.createdAt).toLocaleString('zh-CN'),
                        actions: canConfigure ? (
                          <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions">
                            <NeutralTooltip content="删除" className="cwgsyw-tooltip--pill" followCursor>
                              <IconButton
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="cwgsyw-cmdb-admin__delete-action"
                                icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--trash" />}
                                aria-label={`删除 ${inst.name}`}
                                onClick={() => setDeleteTarget(inst)}
                              />
                            </NeutralTooltip>
                          </div>
                        ) : null,
                      },
                    }
                  })}
                />
              )}
            </section>
          </div>
        }
      />

      <NeutralDialog
        open={!!createTpl}
        onOpenChange={(open) => !open && closeCreate()}
        title={`基于「${createTpl?.name ?? ''}」创建流程`}
        showDescription={false}
        size="sm"
        footer={
          <div className="cwgsyw-inline-controls cwgsyw-workflow-dialog-actions">
            <Button type="button" variant="secondary" size="sm" onClick={closeCreate} disabled={submitting}>
              取消
            </Button>
            <Button type="button" size="sm" disabled={!canSubmit || submitting} loading={submitting} onClick={handleCreate}>
              创建
            </Button>
          </div>
        }
      >
        {createTpl ? (
          <div className="cwgsyw-workflow-dialog-form">
            <Field label="流程名称" htmlFor="tpl-name" required>
              <Input id="tpl-name" size="sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="如 变更文档两级审批" />
            </Field>
            <Field
              label="流程 Key"
              htmlFor="tpl-key"
              required
              state={processKey && !processKeyValid ? 'error' : 'default'}
              errorText={processKey && !processKeyValid ? 'Key 格式非法：需字母开头，3-64 位 [A-Za-z0-9_-]' : undefined}
            >
              <Input
                id="tpl-key"
                size="sm"
                value={processKey}
                onChange={(event) => setProcessKey(event.target.value)}
                placeholder="字母开头，3-64 位字母数字下划线连字符"
              />
            </Field>
            <Field label="业务类型" htmlFor="tpl-type" required>
              <Select
                id="tpl-type"
                size="sm"
                overlay
                value={businessType}
                placeholder="请选择业务类型"
                options={createTpl.supportedBusinessTypes.map((bt) => ({
                  value: bt,
                  label: businessTypeLabels[bt] ?? bt,
                }))}
                onChange={setBusinessType}
              />
            </Field>
            {createTpl.configSchema.map(renderField)}
            <Field label="描述" htmlFor="tpl-desc">
              <Textarea id="tpl-desc" size="sm" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="可选" />
            </Field>
            <Switch
              label="创建后立即绑定"
              checked={bindNow}
              onChange={(event) => setBindNow(event.currentTarget.checked)}
            />
          </div>
        ) : null}
      </NeutralDialog>

      <NeutralAlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        className="cwgsyw-cmdb-model-detail__delete-dialog"
        icon={<img src="/figma-icons/cmdb-model-alert.svg" alt="" width={56} height={56} />}
        title="确认删除模板实例"
        description={`删除 ${deleteTarget?.name ?? ''} 后无法恢复。仅在该模板实例没有业务绑定、运行中流程或历史流程记录时才可删除。`}
        intent="destructive"
        confirmLabel={deleting ? '删除中…' : '确认删除'}
        onConfirm={handleDelete}
      />
    </>
  )
}
