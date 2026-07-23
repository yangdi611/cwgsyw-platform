'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Link2, Pencil, RefreshCw, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/v2/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared'
import { usePermission } from '@/hooks/usePermission'
import { getApiErrorMessage } from '@/lib/api-error'
import { listDirectoryGroups, listDirectoryUsers } from '@/lib/task-plan-api'
import { getTaskTemplateVersion, listTaskTemplates, type TaskFieldDefinition, type TaskTemplateSummary } from '@/lib/task-template-api'
import {
  addTaskMetricBinding,
  createTaskMetric,
  createTaskMetricGoal,
  deleteTaskMetric,
  deleteTaskMetricBinding,
  deleteTaskMetricGoal,
  listTaskMetricGoals,
  listTaskMetrics,
  previewTaskMetric,
  updateTaskMetric,
  updateTaskMetricBinding,
  updateTaskMetricGoal,
  type MetricAdditivity,
  type MetricAggregation,
  type MetricSourceRole,
  type MetricValueType,
  type TaskMetricBinding,
  type TaskMetricDefinition,
  type TaskMetricGoal,
  type TaskMetricGoalPayload,
} from '@/lib/task-analytics-api'

const today = new Date().toISOString().slice(0, 10)
const monthStart = `${today.slice(0, 8)}01`

export function TaskMetricsManager() {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<number>()
  const [metricDraft, setMetricDraft] = useState<MetricDraft>(emptyMetricDraft)
  const [editingMetric, setEditingMetric] = useState<MetricDraft>()
  const [bindingDraft, setBindingDraft] = useState<BindingDraft>(emptyBindingDraft)
  const [editingBinding, setEditingBinding] = useState<BindingDraft>()
  const [goalDraft, setGoalDraft] = useState<GoalDraft>(emptyGoalDraft)
  const [editingGoalId, setEditingGoalId] = useState<number>()
  const [previewRange, setPreviewRange] = useState({ from: monthStart, to: today })

  const metrics = useQuery({ queryKey: ['task-metrics'], queryFn: listTaskMetrics })
  const goals = useQuery({ queryKey: ['task-metric-goals'], queryFn: listTaskMetricGoals })
  const templates = useQuery({
    queryKey: ['task-metric-templates'],
    queryFn: () => listTaskTemplates({ status: 'published', size: 200 }),
  })
  const groups = useQuery({
    queryKey: ['task-metric-groups'],
    queryFn: listDirectoryGroups,
    enabled: hasPermission('group', 'read'),
  })
  const users = useQuery({
    queryKey: ['task-metric-users'],
    queryFn: listDirectoryUsers,
    enabled: hasPermission('user', 'read'),
  })
  const selected = useMemo(
    () => metrics.data?.find((item) => item.id === selectedId),
    [metrics.data, selectedId],
  )
  const templateVersionId = bindingDraft.templateVersionId
  const templateVersion = useQuery({
    queryKey: ['task-metric-template-version', templateVersionId],
    queryFn: () => getTaskTemplateVersion(templateVersionId as number),
    enabled: Boolean(templateVersionId),
  })
  const numericFields = (templateVersion.data?.fields ?? []).filter(isNumericAnalyticField)

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task-metrics'] }),
      queryClient.invalidateQueries({ queryKey: ['task-metric-goals'] }),
    ])
  }
  const metricPreview = useMutation({
    mutationFn: () => previewTaskMetric(selectedId as number, previewRange),
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '指标预览失败')),
  })
  const createMetric = useMutation({
    mutationFn: () => createTaskMetric(metricPayload(metricDraft)),
    onSuccess: async (value) => {
      toast.success('指标已创建')
      setSelectedId(value.id)
      setMetricDraft(emptyMetricDraft)
      await invalidate()
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '指标创建失败')),
  })
  const saveMetric = useMutation({
    mutationFn: () => updateTaskMetric(selectedId as number, metricPayload(editingMetric as MetricDraft)),
    onSuccess: async () => {
      toast.success('指标已更新')
      setEditingMetric(undefined)
      await invalidate()
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '指标更新失败')),
  })
  const removeMetric = useMutation({
    mutationFn: deleteTaskMetric,
    onSuccess: async () => {
      toast.success('指标已删除')
      setSelectedId(undefined)
      await invalidate()
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '指标删除失败')),
  })
  const addBinding = useMutation({
    mutationFn: () => addTaskMetricBinding(selectedId as number, bindingPayload(bindingDraft)),
    onSuccess: async () => {
      toast.success('来源字段已绑定')
      setBindingDraft(emptyBindingDraft)
      await invalidate()
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '字段绑定失败')),
  })
  const saveBinding = useMutation({
    mutationFn: () => updateTaskMetricBinding(editingBinding?.id as number, bindingPayload(editingBinding as BindingDraft)),
    onSuccess: async () => {
      toast.success('字段绑定已更新')
      setEditingBinding(undefined)
      await invalidate()
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '字段绑定更新失败')),
  })
  const removeBinding = useMutation({
    mutationFn: deleteTaskMetricBinding,
    onSuccess: async () => {
      toast.success('字段绑定已移除')
      await invalidate()
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '字段绑定删除失败')),
  })
  const saveGoal = useMutation({
    mutationFn: () => editingGoalId
      ? updateTaskMetricGoal(editingGoalId, goalPayload(goalDraft))
      : createTaskMetricGoal(goalPayload(goalDraft)),
    onSuccess: async () => {
      toast.success(editingGoalId ? '指标目标已更新' : '指标目标已创建')
      setEditingGoalId(undefined)
      setGoalDraft(emptyGoalDraft)
      await invalidate()
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '目标保存失败')),
  })
  const removeGoal = useMutation({
    mutationFn: deleteTaskMetricGoal,
    onSuccess: async () => {
      toast.success('指标目标已删除')
      await invalidate()
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '目标删除失败')),
  })

  const permissions = {
    create: hasPermission('task_analytics', 'create'),
    update: hasPermission('task_analytics', 'update'),
    delete: hasPermission('task_analytics', 'delete'),
  }

  if (metrics.isLoading || goals.isLoading) return <LoadingState label="正在加载指标与目标" minHeight={360} />
  if (metrics.isError || goals.isError) {
    return <ErrorState title="指标配置加载失败" onRetry={() => { void metrics.refetch(); void goals.refetch() }} />
  }

  const startMetricEdit = () => {
    if (!selected) return
    setEditingMetric(metricDraftFrom(selected))
  }
  const startGoalEdit = (goal: TaskMetricGoal) => {
    setEditingGoalId(goal.id)
    setGoalDraft(goalDraftFrom(goal))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="统一任务平台 / 跨周期汇总"
        title="指标与目标"
        subtitle="将不同模板中的统计字段映射为统一口径，并按组织、人员或模板跟踪周期目标。"
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader>
            <CardTitle>指标定义</CardTitle>
            <CardDescription>统一指标编码、聚合方式、单位和权威数据源。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {permissions.create && (
              <MetricDefinitionForm
                value={metricDraft}
                onChange={setMetricDraft}
                onSubmit={() => createMetric.mutate()}
                busy={createMetric.isPending}
                submitLabel="新建指标"
              />
            )}
            <div className="divide-y divide-v2-border border-y border-v2-border">
              {metrics.data?.map((metric) => (
                <button
                  key={metric.id}
                  type="button"
                  onClick={() => { setSelectedId(metric.id); setEditingMetric(undefined) }}
                  className={`block w-full px-2 py-3 text-left ${selectedId === metric.id ? 'bg-v2-primary-soft' : 'hover:bg-v2-surface-hover'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{metric.name}</span>
                    <StatusBadge status="neutral">{metric.aggregation}</StatusBadge>
                  </div>
                  <p className="mt-1 text-xs text-v2-muted">
                    {metric.code} · {metric.bindings.length} 个来源 · {metric.unit || '无单位'}
                  </p>
                </button>
              ))}
            </div>
            {metrics.data?.length === 0 && <p className="text-sm text-v2-muted">暂无统一指标。</p>}
          </CardContent>
        </Card>

        <section className="space-y-6">
          {selected ? (
            <MetricDetail
              metric={selected}
              editDraft={editingMetric}
              onEditDraft={setEditingMetric}
              onStartEdit={startMetricEdit}
              onSaveEdit={() => saveMetric.mutate()}
              savingEdit={saveMetric.isPending}
              bindingDraft={bindingDraft}
              onBindingDraft={setBindingDraft}
              editingBinding={editingBinding}
              onEditingBinding={setEditingBinding}
              templates={templates.data?.records ?? []}
              fields={numericFields}
              onAddBinding={() => addBinding.mutate()}
              addingBinding={addBinding.isPending}
              onSaveBinding={() => saveBinding.mutate()}
              savingBinding={saveBinding.isPending}
              onDeleteBinding={(id) => removeBinding.mutate(id)}
              onDeleteMetric={() => removeMetric.mutate(selected.id)}
              preview={previewRange}
              onPreviewChange={setPreviewRange}
              onRunPreview={() => metricPreview.mutate()}
              previewResult={metricPreview.data}
              previewing={metricPreview.isPending}
              permissions={permissions}
            />
          ) : (
            <Card><CardContent className="py-12 text-center text-sm text-v2-muted"><BarChart3 className="mx-auto mb-3 h-8 w-8" />选择一个指标以配置来源、预览和目标。</CardContent></Card>
          )}
          <GoalsCard
            metrics={metrics.data ?? []}
            goals={goals.data ?? []}
            templates={templates.data?.records ?? []}
            groups={groups.data ?? []}
            users={users.data ?? []}
            value={goalDraft}
            editingGoalId={editingGoalId}
            onChange={setGoalDraft}
            onSave={() => saveGoal.mutate()}
            saving={saveGoal.isPending}
            onEdit={startGoalEdit}
            onCancelEdit={() => { setEditingGoalId(undefined); setGoalDraft(emptyGoalDraft) }}
            onDelete={(id) => removeGoal.mutate(id)}
            permissions={permissions}
          />
        </section>
      </div>
    </div>
  )
}

function MetricDefinitionForm({ value, onChange, onSubmit, busy, submitLabel }: {
  value: MetricDraft
  onChange: (value: MetricDraft) => void
  onSubmit: () => void
  busy: boolean
  submitLabel: string
}) {
  const aggregations = value.valueType === 'ratio' ? ['ratio'] : ['sum', 'avg', 'min', 'max', 'count', 'weighted_avg']
  return (
    <div className="grid gap-3 border border-v2-border bg-v2-surface-soft p-3 sm:grid-cols-2">
      <label className="text-sm">名称<Input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} /></label>
      <label className="text-sm">稳定编码<Input value={value.code} onChange={(event) => onChange({ ...value, code: event.target.value.replace(/\s+/g, '_').toLowerCase() })} /></label>
      <label className="text-sm">值类型<Select value={value.valueType} onChange={(valueType) => onChange({ ...value, valueType: valueType as MetricValueType, aggregation: valueType === 'ratio' ? 'ratio' : value.aggregation === 'ratio' ? 'sum' : value.aggregation })} options={['number', 'count', 'percentage', 'duration', 'ratio']} /></label>
      <label className="text-sm">聚合方式<Select value={value.aggregation} onChange={(aggregation) => onChange({ ...value, aggregation: aggregation as MetricAggregation })} options={aggregations} /></label>
      <label className="text-sm">可加性<Select value={value.additivity} onChange={(additivity) => onChange({ ...value, additivity: additivity as MetricAdditivity })} options={['additive', 'non_additive', 'semi_additive', 'distinct', 'snapshot', 'formula']} /></label>
      <label className="text-sm">权威来源<Select value={value.authoritySource} onChange={(authoritySource) => onChange({ ...value, authoritySource: authoritySource as MetricSourceRole })} options={['fact', 'system_rollup', 'manual_report']} /></label>
      <label className="text-sm">单位（可选）<Input value={value.unit} onChange={(event) => onChange({ ...value, unit: event.target.value })} /></label>
      <label className="text-sm">小数位<Input type="number" min="0" max="10" value={value.scale} onChange={(event) => onChange({ ...value, scale: event.target.value })} /></label>
      <label className="text-sm sm:col-span-2">说明<Input value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} /></label>
      <div className="sm:col-span-2"><Button size="sm" onClick={onSubmit} disabled={busy || !value.name.trim() || !value.code.trim()}><Save className="h-4 w-4" />{submitLabel}</Button></div>
    </div>
  )
}

function MetricDetail(props: MetricDetailProps) {
  const {
    metric, editDraft, onEditDraft, onStartEdit, onSaveEdit, savingEdit, bindingDraft, onBindingDraft,
    editingBinding, onEditingBinding, templates, fields, onAddBinding, addingBinding, onSaveBinding,
    savingBinding, onDeleteBinding, onDeleteMetric, preview, onPreviewChange, onRunPreview,
    previewResult, previewing, permissions,
  } = props
  const selectedField = fields.find((field) => field.id === bindingDraft.fieldId)
  const sourceUnit = textValue(selectedField?.analytics?.unit)
  const needsConversion = Boolean(metric.unit && sourceUnit && metric.unit !== sourceUnit)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div><CardTitle>{metric.name}</CardTitle><CardDescription>{metric.code} · {metric.valueType} · {metric.unit || '无单位'} · 权威来源 {textValue(metric.authorityPolicy.sourceRole) || 'fact'}</CardDescription></div>
          <div className="flex gap-1">
            {permissions.update && !editDraft && <Button size="sm" variant="ghost" title="编辑指标" onClick={onStartEdit}><Pencil className="h-4 w-4" /></Button>}
            {permissions.delete && <Button size="sm" variant="danger" title="删除指标" onClick={onDeleteMetric}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {editDraft && <div className="space-y-2"><MetricDefinitionForm value={editDraft} onChange={onEditDraft} onSubmit={onSaveEdit} busy={savingEdit} submitLabel="保存指标" /><Button size="sm" variant="ghost" onClick={() => onEditDraft(undefined)}><X className="h-4 w-4" />取消编辑</Button></div>}
        <section>
          <h2 className="mb-2 text-sm font-semibold">来源字段</h2>
          <div className="divide-y divide-v2-border border-y border-v2-border">
            {metric.bindings.map((item) => editingBinding?.id === item.id ? (
              <BindingEditor key={item.id} value={editingBinding} onChange={onEditingBinding} onSave={onSaveBinding} saving={savingBinding} onCancel={() => onEditingBinding(undefined)} />
            ) : (
              <div key={item.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="min-w-48 flex-1">{item.fieldLabel} <span className="text-v2-muted">({item.fieldKey})</span></span>
                <StatusBadge status={item.enabled ? 'ok' : 'neutral'}>{item.enabled ? item.ratioComponent ? `${item.sourceRole} · ${item.ratioComponent === 'numerator' ? '分子' : '分母'}` : item.sourceRole : '已停用'}</StatusBadge>
                <span className="text-xs text-v2-muted">换算 {conversionFactor(item.unitConversion)}</span>
                {permissions.update && <Button size="sm" variant="ghost" title="编辑字段绑定" onClick={() => onEditingBinding(bindingDraftFrom(item))}><Pencil className="h-4 w-4" /></Button>}
                {permissions.update && <Button size="sm" variant="ghost" title="移除字段绑定" onClick={() => onDeleteBinding(item.id)}><Trash2 className="h-4 w-4 text-v2-danger" /></Button>}
              </div>
            ))}
          </div>
          {metric.bindings.length === 0 && <p className="mt-3 text-sm text-v2-muted">尚未绑定来源字段。</p>}
          {permissions.update && (
            <div className="mt-3 grid gap-3 border border-v2-border bg-v2-surface-soft p-3 md:grid-cols-4">
              <label className="text-sm">模板版本<select className={selectClass} value={bindingDraft.templateVersionId ?? ''} onChange={(event) => onBindingDraft({ ...bindingDraft, templateVersionId: Number(event.target.value) || undefined, fieldId: undefined })}><option value="">选择模板</option>{templates.filter((item) => item.latestVersionId).map((item) => <option key={item.id} value={item.latestVersionId}>{item.name}</option>)}</select></label>
              <label className="text-sm">统计字段<select className={selectClass} value={bindingDraft.fieldId ?? ''} onChange={(event) => onBindingDraft({ ...bindingDraft, fieldId: Number(event.target.value) || undefined })}><option value="">选择字段</option>{fields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>
              <label className="text-sm">来源角色<Select value={bindingDraft.sourceRole} onChange={(sourceRole) => onBindingDraft({ ...bindingDraft, sourceRole: sourceRole as MetricSourceRole })} options={['fact', 'system_rollup', 'manual_report']} /></label>
              {metric.valueType === 'ratio' && <label className="text-sm">比率组成<Select value={bindingDraft.ratioComponent ?? ''} onChange={(ratioComponent) => onBindingDraft({ ...bindingDraft, ratioComponent: ratioComponent as BindingDraft['ratioComponent'] })} options={['', 'numerator', 'denominator']} /></label>}
              <label className="text-sm">换算系数{needsConversion ? ' *' : ''}<Input type="number" min="0.000001" step="any" value={bindingDraft.conversionFactor} placeholder={needsConversion ? `${sourceUnit} → ${metric.unit}` : '默认 1'} onChange={(event) => onBindingDraft({ ...bindingDraft, conversionFactor: event.target.value })} /></label>
              <div className="md:col-span-4"><Button size="sm" onClick={onAddBinding} disabled={addingBinding || !bindingDraft.templateVersionId || !bindingDraft.fieldId || (metric.valueType === 'ratio' && !bindingDraft.ratioComponent) || (needsConversion && !bindingDraft.conversionFactor)}><Link2 className="h-4 w-4" />绑定字段</Button></div>
            </div>
          )}
        </section>
        <section className="border-t border-v2-border pt-4">
          <h2 className="mb-2 text-sm font-semibold">期间预览</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">开始日期<Input type="date" value={preview.from} onChange={(event) => onPreviewChange({ ...preview, from: event.target.value })} /></label>
            <label className="text-sm">结束日期<Input type="date" value={preview.to} onChange={(event) => onPreviewChange({ ...preview, to: event.target.value })} /></label>
            <Button size="sm" onClick={onRunPreview} disabled={previewing}><RefreshCw className="h-4 w-4" />计算</Button>
          </div>
          {previewResult && <div className="mt-3 grid gap-3 text-sm sm:grid-cols-4"><MetricValue label="系统汇总" value={previewResult.systemValue} /><MetricValue label="人工上报" value={previewResult.manualValue} /><MetricValue label="差异" value={previewResult.difference} /><MetricValue label="来源任务" value={previewResult.sourceTaskCount} note={previewResult.selectedSourceRole} /></div>}
        </section>
      </CardContent>
    </Card>
  )
}

function BindingEditor({ value, onChange, onSave, saving, onCancel }: {
  value: BindingDraft
  onChange: (value?: BindingDraft) => void
  onSave: () => void
  saving: boolean
  onCancel: () => void
}) {
  return <div className="grid gap-3 py-3 md:grid-cols-[1fr_180px_160px_auto] md:items-end"><p className="text-sm">{value.fieldLabel}<span className="block text-xs text-v2-muted">{value.fieldKey}</span></p><label className="text-sm">来源角色<Select value={value.sourceRole} onChange={(sourceRole) => onChange({ ...value, sourceRole: sourceRole as MetricSourceRole })} options={['fact', 'system_rollup', 'manual_report']} /></label><label className="text-sm">换算系数<Input type="number" min="0.000001" step="any" value={value.conversionFactor} onChange={(event) => onChange({ ...value, conversionFactor: event.target.value })} /></label><div className="flex items-center gap-1"><label className="mr-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={value.enabled} onChange={(event) => onChange({ ...value, enabled: event.target.checked })} />启用</label><Button size="sm" title="保存绑定" onClick={onSave} disabled={saving}><Save className="h-4 w-4" /></Button><Button size="sm" variant="ghost" title="取消编辑" onClick={onCancel}><X className="h-4 w-4" /></Button></div></div>
}

function GoalsCard(props: GoalsCardProps) {
  const { metrics, goals, templates, groups, users, value, editingGoalId, onChange, onSave, saving, onEdit, onCancelEdit, onDelete, permissions } = props
  const scopeOptions = goalScopeOptions(value.scopeType, templates, groups, users)
  const allowedScopes = ['tenant', ...(groups.length ? ['group'] : []), ...(users.length ? ['user'] : []), ...(templates.length ? ['template'] : [])]
  return (
    <Card>
      <CardHeader><CardTitle>指标目标</CardTitle><CardDescription>不同周期可使用独立目标、告警阈值和统计范围。</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {(permissions.create || editingGoalId) && (
          <div className="grid gap-3 border border-v2-border bg-v2-surface-soft p-3 md:grid-cols-3">
            <label className="text-sm">指标<select className={selectClass} value={value.metricId ?? ''} onChange={(event) => onChange({ ...value, metricId: Number(event.target.value) || undefined })}><option value="">选择指标</option>{metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.name}</option>)}</select></label>
            <label className="text-sm">范围<Select value={value.scopeType} onChange={(scopeType) => onChange({ ...value, scopeType: scopeType as GoalDraft['scopeType'], scopeKey: '' })} options={allowedScopes} /></label>
            {value.scopeType !== 'tenant' && <label className="text-sm">范围对象<select className={selectClass} value={value.scopeKey} onChange={(event) => onChange({ ...value, scopeKey: event.target.value })}><option value="">请选择</option>{scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
            <label className="text-sm">目标值<Input type="number" min="0" step="any" value={value.targetValue} onChange={(event) => onChange({ ...value, targetValue: event.target.value })} /></label>
            <label className="text-sm">预警阈值<Input type="number" min="0" step="any" value={value.warningThreshold} onChange={(event) => onChange({ ...value, warningThreshold: event.target.value })} /></label>
            <label className="text-sm">严重阈值<Input type="number" min="0" step="any" value={value.criticalThreshold} onChange={(event) => onChange({ ...value, criticalThreshold: event.target.value })} /></label>
            <label className="text-sm">比较<Select value={value.comparison} onChange={(comparison) => onChange({ ...value, comparison: comparison as GoalDraft['comparison'] })} options={['at_least', 'at_most', 'exact']} /></label>
            <label className="text-sm">周期<Select value={value.periodType} onChange={(periodType) => onChange({ ...value, periodType: periodType as GoalDraft['periodType'] })} options={['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']} /></label>
            <label className="text-sm">生效开始<Input type="date" value={value.effectiveFrom} onChange={(event) => onChange({ ...value, effectiveFrom: event.target.value })} /></label>
            <label className="text-sm">生效结束<Input type="date" value={value.effectiveTo} onChange={(event) => onChange({ ...value, effectiveTo: event.target.value })} /></label>
            <div className="flex items-end gap-2"><Button size="sm" onClick={onSave} disabled={saving || !value.metricId || value.targetValue === '' || (value.scopeType !== 'tenant' && !value.scopeKey)}><Save className="h-4 w-4" />{editingGoalId ? '更新目标' : '创建目标'}</Button>{editingGoalId && <Button size="sm" variant="ghost" onClick={onCancelEdit}><X className="h-4 w-4" />取消</Button>}</div>
          </div>
        )}
        <div className="divide-y divide-v2-border border-y border-v2-border">
          {goals.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 py-3 text-sm"><div className="min-w-48 flex-1"><p className="font-medium">{item.metricName}</p><p className="text-xs text-v2-muted">{scopeLabel(item, templates, groups, users)} · {item.periodType} · {item.effectiveFrom} 至 {item.effectiveTo}</p></div><StatusBadge status={goalTone(item.status)}>{item.status}</StatusBadge><span>目标 {item.targetValue} · 实际 {item.actualValue ?? '-'}</span><span className="text-v2-muted">{item.completionRate == null ? '-' : `${item.completionRate}%`}</span>{permissions.update && <Button size="sm" variant="ghost" title="编辑目标" onClick={() => onEdit(item)}><Pencil className="h-4 w-4" /></Button>}{permissions.delete && <Button size="sm" variant="ghost" title="删除目标" onClick={() => onDelete(item.id)}><Trash2 className="h-4 w-4 text-v2-danger" /></Button>}</div>)}
        </div>
        {goals.length === 0 && <p className="text-sm text-v2-muted">暂无指标目标。</p>}
      </CardContent>
    </Card>
  )
}

const selectClass = 'mt-1 h-9 w-full border border-v2-border bg-v2-surface px-2'

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
}

function MetricValue({ label, value, note }: { label: string; value?: number; note?: string }) {
  return <div className="border border-v2-border p-3"><p className="text-xs text-v2-muted">{label}</p><p className="mt-1 font-semibold">{value == null ? '-' : value}</p>{note && <p className="mt-1 text-xs text-v2-muted">{note}</p>}</div>
}

function isNumericAnalyticField(field: TaskFieldDefinition) {
  return ['number', 'money', 'percentage', 'rating', 'duration', 'formula', 'aggregate_reference'].includes(field.type)
    && field.analytics?.enabled === true && !field.sensitive
}

function metricPayload(value: MetricDraft) {
  return {
    code: value.code,
    name: value.name,
    description: value.description || undefined,
    valueType: value.valueType,
    unit: value.unit || undefined,
    scale: Number(value.scale || 4),
    aggregation: value.aggregation,
    additivity: value.additivity,
    formulaConfig: {},
    authorityPolicy: { sourceRole: value.authoritySource },
  }
}

function bindingPayload(value: BindingDraft) {
  return {
    templateVersionId: value.templateVersionId as number,
    fieldId: value.fieldId as number,
    sourceRole: value.sourceRole,
    ratioComponent: value.ratioComponent,
    unitConversion: value.conversionFactor ? { factor: Number(value.conversionFactor) } : undefined,
    enabled: value.enabled,
  }
}

function goalPayload(value: GoalDraft): TaskMetricGoalPayload {
  return {
    metricId: value.metricId as number,
    scopeType: value.scopeType,
    scopeKey: value.scopeType === 'tenant' ? undefined : value.scopeKey,
    periodType: value.periodType,
    periodConfig: {},
    targetValue: Number(value.targetValue),
    warningThreshold: optionalNumber(value.warningThreshold),
    criticalThreshold: optionalNumber(value.criticalThreshold),
    comparison: value.comparison,
    effectiveFrom: value.effectiveFrom,
    effectiveTo: value.effectiveTo,
  }
}

function metricDraftFrom(metric: TaskMetricDefinition): MetricDraft {
  return {
    code: metric.code,
    name: metric.name,
    description: metric.description ?? '',
    valueType: metric.valueType,
    unit: metric.unit ?? '',
    scale: String(metric.scale ?? 4),
    aggregation: metric.aggregation,
    additivity: metric.additivity,
    authoritySource: (textValue(metric.authorityPolicy.sourceRole) || 'fact') as MetricSourceRole,
  }
}

function bindingDraftFrom(binding: TaskMetricBinding): BindingDraft {
  return {
    id: binding.id,
    templateVersionId: binding.templateVersionId,
    fieldId: binding.fieldId,
    fieldKey: binding.fieldKey,
    fieldLabel: binding.fieldLabel,
    sourceRole: binding.sourceRole,
    ratioComponent: binding.ratioComponent,
    conversionFactor: conversionFactor(binding.unitConversion),
    enabled: binding.enabled,
  }
}

function goalDraftFrom(goal: TaskMetricGoal): GoalDraft {
  return {
    metricId: goal.metricId,
    scopeType: goal.scopeType,
    scopeKey: goal.scopeKey ?? '',
    periodType: goal.periodType,
    targetValue: String(goal.targetValue),
    warningThreshold: goal.warningThreshold == null ? '' : String(goal.warningThreshold),
    criticalThreshold: goal.criticalThreshold == null ? '' : String(goal.criticalThreshold),
    comparison: goal.comparison,
    effectiveFrom: goal.effectiveFrom,
    effectiveTo: goal.effectiveTo,
  }
}

function goalScopeOptions(scopeType: GoalDraft['scopeType'], templates: TaskTemplateSummary[], groups: DirectoryGroup[], users: DirectoryUser[]) {
  if (scopeType === 'group') return groups.map((item) => ({ value: String(item.id), label: item.name }))
  if (scopeType === 'user') return users.map((item) => ({ value: String(item.id), label: item.realName || item.username }))
  if (scopeType === 'template') return templates.filter((item) => item.latestVersionId).map((item) => ({ value: String(item.latestVersionId), label: item.name }))
  return []
}

function scopeLabel(goal: TaskMetricGoal, templates: TaskTemplateSummary[], groups: DirectoryGroup[], users: DirectoryUser[]) {
  if (goal.scopeType === 'tenant') return '全租户'
  return goalScopeOptions(goal.scopeType, templates, groups, users).find((item) => item.value === goal.scopeKey)?.label
    ?? `${goal.scopeType} #${goal.scopeKey}`
}

function conversionFactor(value: Record<string, unknown>) {
  return value.factor == null ? '1' : String(value.factor)
}

function optionalNumber(value: string) {
  return value === '' ? undefined : Number(value)
}

function textValue(value: unknown) {
  return value == null ? '' : String(value)
}

function goalTone(status: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  return status === 'met' ? 'ok' : status === 'critical' ? 'danger' : status === 'warning' || status === 'not_met' ? 'warn' : 'neutral'
}

interface MetricDraft {
  code: string
  name: string
  description: string
  valueType: MetricValueType
  unit: string
  scale: string
  aggregation: MetricAggregation
  additivity: MetricAdditivity
  authoritySource: MetricSourceRole
}

interface BindingDraft {
  id?: number
  templateVersionId?: number
  fieldId?: number
  fieldKey?: string
  fieldLabel?: string
  sourceRole: MetricSourceRole
  ratioComponent?: 'numerator' | 'denominator'
  conversionFactor: string
  enabled: boolean
}

interface GoalDraft {
  metricId?: number
  scopeType: 'tenant' | 'group' | 'user' | 'template'
  scopeKey: string
  periodType: TaskMetricGoalPayload['periodType']
  targetValue: string
  warningThreshold: string
  criticalThreshold: string
  comparison: TaskMetricGoalPayload['comparison']
  effectiveFrom: string
  effectiveTo: string
}

interface PermissionSet { create: boolean; update: boolean; delete: boolean }
type DirectoryGroup = Awaited<ReturnType<typeof listDirectoryGroups>>[number]
type DirectoryUser = Awaited<ReturnType<typeof listDirectoryUsers>>[number]

interface MetricDetailProps {
  metric: TaskMetricDefinition
  editDraft?: MetricDraft
  onEditDraft: (value?: MetricDraft) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  savingEdit: boolean
  bindingDraft: BindingDraft
  onBindingDraft: (value: BindingDraft) => void
  editingBinding?: BindingDraft
  onEditingBinding: (value?: BindingDraft) => void
  templates: TaskTemplateSummary[]
  fields: TaskFieldDefinition[]
  onAddBinding: () => void
  addingBinding: boolean
  onSaveBinding: () => void
  savingBinding: boolean
  onDeleteBinding: (id: number) => void
  onDeleteMetric: () => void
  preview: { from: string; to: string }
  onPreviewChange: (value: { from: string; to: string }) => void
  onRunPreview: () => void
  previewResult?: { systemValue?: number; manualValue?: number; difference?: number; selectedSourceRole: string; sourceTaskCount: number }
  previewing: boolean
  permissions: PermissionSet
}

interface GoalsCardProps {
  metrics: TaskMetricDefinition[]
  goals: TaskMetricGoal[]
  templates: TaskTemplateSummary[]
  groups: DirectoryGroup[]
  users: DirectoryUser[]
  value: GoalDraft
  editingGoalId?: number
  onChange: (value: GoalDraft) => void
  onSave: () => void
  saving: boolean
  onEdit: (goal: TaskMetricGoal) => void
  onCancelEdit: () => void
  onDelete: (id: number) => void
  permissions: PermissionSet
}

const emptyMetricDraft: MetricDraft = {
  code: '', name: '', description: '', valueType: 'number', unit: '', scale: '4',
  aggregation: 'sum', additivity: 'additive', authoritySource: 'fact',
}
const emptyBindingDraft: BindingDraft = { sourceRole: 'fact', conversionFactor: '', enabled: true }
const emptyGoalDraft: GoalDraft = {
  scopeType: 'tenant', scopeKey: '', periodType: 'monthly', targetValue: '', warningThreshold: '',
  criticalThreshold: '', comparison: 'at_least', effectiveFrom: monthStart, effectiveTo: today,
}
