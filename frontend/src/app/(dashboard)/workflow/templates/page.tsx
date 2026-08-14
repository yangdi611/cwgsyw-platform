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
  Card,
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
        <Input id={f.key} value={val} onChange={(event) => setValue(f.key, event.target.value)} placeholder={hint} />
      </Field>
    )
  }

  return (
    <>
      <DataManagementPage
        embedded
        header={
          <PageHeader
            eyebrow="流程中心"
            title="流程模板"
            subtitle="基于内置模板快速生成审批流程，无需手绘 BPMN。创建后可直接绑定到业务类型。"
            breadcrumb={
              <Breadcrumb
                items={[
                  { href: '/', label: '工作台' },
                  { href: '/workflow/design', label: '流程中心' },
                  { label: '流程模板' },
                ]}
              />
            }
          />
        }
        content={
          <div className="cwgsyw-form">
            <section className="cwgsyw-form">
              <div className="cwgsyw-type-label-sm">内置模板</div>
              {loadingTemplates ? (
                <LoadingState label="加载内置模板" />
              ) : (
                <div className="cwgsyw-filter-grid">
                  {(templates ?? []).map((tpl) => (
                    <Card
                      key={tpl.code}
                      title={tpl.name}
                      description={tpl.description}
                      headerAction={<StatusBadge label={tpl.enabled ? '可用' : '停用'} status={tpl.enabled ? 'success' : 'neutral'} />}
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
                          <Chip key={bt} label={businessTypeLabels[bt] ?? bt} />
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section className="cwgsyw-form">
              <div className="cwgsyw-type-label-sm">已创建的流程实例</div>
              {loadingInstances ? (
                <LoadingState label="加载模板实例" />
              ) : (instances ?? []).length === 0 ? (
                <EmptyState
                  title="尚未创建流程实例"
                  description="从上方内置模板中选择一个，填写配置即可生成可部署的审批流程。"
                />
              ) : (
                <Table
                  showSearch={false}
                  columns={[
                    { key: 'name', label: '名称' },
                    { key: 'type', label: '业务类型' },
                    { key: 'key', label: '流程 Key' },
                    { key: 'status', label: '状态' },
                    { key: 'created', label: '创建时间' },
                    { key: 'actions', label: '操作', align: 'right' },
                  ]}
                  rows={(instances ?? []).map((inst) => ({
                    id: String(inst.id),
                    cells: {
                      name: inst.name,
                      type: businessTypeLabels[inst.businessType] ?? inst.businessType,
                      key: `${inst.processKey} · v${inst.latestVersion}`,
                      status: <StatusBadge label={inst.status} status={inst.status === 'active' ? 'success' : 'neutral'} />,
                      created: new Date(inst.createdAt).toLocaleString('zh-CN'),
                      actions: (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!canConfigure}
                          onClick={() => setDeleteTarget(inst)}
                        >
                          删除
                        </Button>
                      ),
                    },
                  }))}
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
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeCreate} disabled={submitting}>
              取消
            </Button>
            <Button type="button" disabled={!canSubmit || submitting} loading={submitting} onClick={handleCreate}>
              创建
            </Button>
          </>
        }
      >
        {createTpl ? (
          <div className="cwgsyw-form">
            <Field label="流程名称" htmlFor="tpl-name" required>
              <Input id="tpl-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="如 变更文档两级审批" />
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
                value={processKey}
                onChange={(event) => setProcessKey(event.target.value)}
                placeholder="字母开头，3-64 位字母数字下划线连字符"
              />
            </Field>
            <Field label="业务类型" htmlFor="tpl-type" required>
              <Select
                id="tpl-type"
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
              <Textarea id="tpl-desc" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="可选" />
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
        title="确认删除模板实例"
        description={`删除 ${deleteTarget?.name ?? ''} 后无法恢复。仅在该模板实例没有业务绑定、运行中流程或历史流程记录时才可删除。`}
        intent="destructive"
        confirmLabel={deleting ? '删除中…' : '确认删除'}
        onConfirm={handleDelete}
      />
    </>
  )
}
