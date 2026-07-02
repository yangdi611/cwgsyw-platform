'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Textarea } from '@/components/v2/Textarea'
import { Switch } from '@/components/v2/Switch'
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
import { LayoutTemplate, Plus } from 'lucide-react'

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
  daily_report: '日报',
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

/** Build the initial config values from a template's schema defaults. */
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

  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => api.get('/workflow/templates').then((r) => r.data.data as TemplateDefinition[]),
  })

  const { data: instances, isLoading: loadingInstances, refetch } = useQuery({
    queryKey: ['workflow-template-instances'],
    queryFn: () =>
      api.get('/workflow/templates/instances').then((r) => r.data.data as TemplateInstanceVO[]),
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
    } catch (err: any) {
      toast.error(err.response?.data?.message || '创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (f: TemplateConfigField) => {
    const val = values[f.key] ?? ''
    if (f.type === 'boolean') {
      return (
        <div className="flex items-center justify-between" key={f.key}>
          <Label>{f.label}</Label>
          <Switch checked={val === 'true'} onCheckedChange={(c) => setValue(f.key, String(c))} />
        </div>
      )
    }
    if (f.type === 'select' && f.options && f.options.length > 0) {
      return (
        <div className="space-y-1.5" key={f.key}>
          <Label>
            {f.label}
            {f.required && <span className="text-v2-danger"> *</span>}
          </Label>
          <Select value={val} onValueChange={(v) => setValue(f.key, v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="请选择">
                {(v: string) => (v ? optionLabel(v) : '请选择')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {f.options.map((o) => (
                <SelectItem key={o} value={o}>
                  {optionLabel(o)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )
    }
    // user / group / role / string all render as text input in MVP
    const hint =
      f.type === 'user'
        ? '填写用户 ID'
        : f.type === 'group'
          ? '填写组标识'
          : f.type === 'role'
            ? '填写角色 code'
            : undefined
    return (
      <div className="space-y-1.5" key={f.key}>
        <Label>
          {f.label}
          {f.required && <span className="text-v2-danger"> *</span>}
        </Label>
        <Input value={val} onChange={(e) => setValue(f.key, e.target.value)} placeholder={hint} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="流程中心"
        title="流程模板"
        subtitle="基于内置模板快速生成审批流程，无需手绘 BPMN。创建后可直接绑定到业务类型。"
      />

      {/* 内置模板 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-v2-fg">内置模板</h2>
        {loadingTemplates ? null : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(templates ?? []).map((tpl) => (
              <Card key={tpl.code} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="h-4 w-4 text-v2-primary" />
                    <span className="font-semibold text-v2-fg">{tpl.name}</span>
                  </div>
                  <StatusBadge status={tpl.enabled ? 'ok' : 'neutral'}>
                    {tpl.enabled ? '可用' : '停用'}
                  </StatusBadge>
                </div>
                <p className="text-sm text-v2-muted">{tpl.description}</p>
                <div className="flex flex-wrap gap-1">
                  {tpl.supportedBusinessTypes.map((bt) => (
                    <span
                      key={bt}
                      className="rounded-md border border-v2-border bg-v2-surface-soft px-2 py-0.5 text-xs text-v2-muted"
                    >
                      {businessTypeLabels[bt] ?? bt}
                    </span>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-auto"
                  disabled={!canConfigure || !tpl.enabled}
                  onClick={() => openCreate(tpl)}
                >
                  <Plus className="h-4 w-4" />
                  基于此模板创建
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 已创建实例 */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-v2-fg">已创建的流程实例</h2>
        {loadingInstances ? null : (instances ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon={<LayoutTemplate className="h-5 w-5 text-v2-muted" />}
              title="尚未创建流程实例"
              description="从上方内置模板中选择一个，填写配置即可生成可部署的审批流程。"
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {(instances ?? []).map((inst) => (
              <Card key={inst.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-v2-fg">{inst.name}</span>
                    <StatusBadge status={inst.status === 'active' ? 'ok' : 'neutral'}>
                      {inst.status}
                    </StatusBadge>
                    <span className="text-xs text-v2-muted">
                      {businessTypeLabels[inst.businessType] ?? inst.businessType}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-v2-muted">
                    {inst.processKey} · v{inst.latestVersion}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-v2-muted">
                  {new Date(inst.createdAt).toLocaleString('zh-CN')}
                </span>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 创建对话框 */}
      <Dialog open={!!createTpl} onOpenChange={(o) => !o && closeCreate()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>基于「{createTpl?.name}」创建流程</DialogTitle>
          </DialogHeader>
          {createTpl && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>
                  流程名称<span className="text-v2-danger"> *</span>
                </Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 变更文档两级审批" />
              </div>
              <div className="space-y-1.5">
                <Label>
                  流程 Key<span className="text-v2-danger"> *</span>
                </Label>
                <Input
                  value={processKey}
                  onChange={(e) => setProcessKey(e.target.value)}
                  placeholder="字母开头，3-64 位字母数字下划线连字符"
                />
                {processKey && !processKeyValid && (
                  <p className="text-xs text-v2-danger">Key 格式非法：需字母开头，3-64 位 [A-Za-z0-9_-]</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>
                  业务类型<span className="text-v2-danger"> *</span>
                </Label>
                <Select value={businessType} onValueChange={(v) => setBusinessType(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择业务类型">
                      {(v: string) => (v ? businessTypeLabels[v] ?? v : '请选择业务类型')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {createTpl.supportedBusinessTypes.map((bt) => (
                      <SelectItem key={bt} value={bt}>
                        {businessTypeLabels[bt] ?? bt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 border-t border-v2-border pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-v2-subtle">模板配置</p>
                {createTpl.configSchema.map(renderField)}
              </div>

              <div className="space-y-1.5">
                <Label>描述</Label>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="可选"
                />
              </div>

              <div className="flex items-center justify-between border-t border-v2-border pt-3">
                <div>
                  <Label>创建后立即绑定</Label>
                  <p className="text-xs text-v2-muted">绑定到所选业务类型，替换其现有流程</p>
                </div>
                <Switch checked={bindNow} onCheckedChange={setBindNow} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={closeCreate} disabled={submitting}>
              取消
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!canSubmit || submitting}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
