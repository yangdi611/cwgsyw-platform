'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import { TaskEmpty, TaskPanel, TASK_TARGET_ICON, TASK_TARGET_NODE } from '@/components/task-runtime/TaskEmpty'
import {
  Button,
  Checkbox,
  Field,
  IconButton,
  ErrorState,
  Input,
  LoadingState,
  NeutralTooltip,
  PageHeader,
  Select,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

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

const METRIC_STEPS = ['指标定义', '来源字段', '指标目标', '期间预览']
const today = new Date().toISOString().slice(0, 10)
const monthStart = `${today.slice(0, 8)}01`
type SelectOption = { value: string; label: string }
const metricValueTypeOptions: SelectOption[] = [{ value: 'number', label: '数值' }, { value: 'count', label: '计数' }, { value: 'percentage', label: '百分比' }, { value: 'duration', label: '时长' }, { value: 'ratio', label: '比率' }]
const metricAggregationLabels: Record<string, string> = { sum: '合计', avg: '平均值', min: '最小值', max: '最大值', count: '计数', distinct_count: '去重计数', latest: '最新值', ratio: '比率', weighted_avg: '加权平均' }
const metricAdditivityOptions: SelectOption[] = [{ value: 'additive', label: '可加' }, { value: 'non_additive', label: '不可加' }, { value: 'semi_additive', label: '半可加' }, { value: 'distinct', label: '去重' }, { value: 'snapshot', label: '快照' }, { value: 'formula', label: '公式' }]
const sourceRoleOptions: SelectOption[] = [{ value: 'fact', label: '明细事实' }, { value: 'system_rollup', label: '系统汇总' }, { value: 'manual_report', label: '人工上报' }]
const ratioComponentOptions: SelectOption[] = [{ value: '', label: '请选择' }, { value: 'numerator', label: '分子' }, { value: 'denominator', label: '分母' }]
const comparisonOptions: SelectOption[] = [{ value: 'at_least', label: '至少' }, { value: 'at_most', label: '至多' }, { value: 'exact', label: '等于' }]
const periodOptions: SelectOption[] = [{ value: 'daily', label: '每日' }, { value: 'weekly', label: '每周' }, { value: 'monthly', label: '每月' }, { value: 'quarterly', label: '每季度' }, { value: 'yearly', label: '每年' }, { value: 'custom', label: '自定义' }]
const scopeLabels: Record<string, string> = { tenant: '租户', template: '任务模板', group: '用户组', user: '用户' }
const valueTypeLabels: Record<string, string> = Object.fromEntries(metricValueTypeOptions.map((item) => [item.value, item.label]))
const sourceRoleLabels: Record<string, string> = Object.fromEntries(sourceRoleOptions.map((item) => [item.value, item.label]))
const periodLabels: Record<string, string> = Object.fromEntries(periodOptions.map((item) => [item.value, item.label]))
const goalStatusLabels: Record<string, string> = { met: '已达成', not_met: '未达成', warning: '预警', critical: '严重', in_progress: '进行中' }

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
  const [step, setStep] = useState(0)

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
      setStep(1)
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
      setStep(0)
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

  if (metrics.isLoading || goals.isLoading) return <LoadingState label="正在加载指标与目标" />
  if (metrics.isError || goals.isError) {
    return <ErrorState title="指标配置加载失败" retry={<Button type="button" variant="secondary" onClick={() => { void metrics.refetch(); void goals.refetch() }}>重试</Button>} />
  }

  const startMetricEdit = () => {
    if (!selected) return
    setEditingMetric(metricDraftFrom(selected))
  }
  const startGoalEdit = (goal: TaskMetricGoal) => {
    setEditingGoalId(goal.id)
    setGoalDraft(goalDraftFrom(goal))
  }

  const detailProps = selected ? {
    metric: selected,
    editDraft: editingMetric,
    onEditDraft: setEditingMetric,
    onStartEdit: startMetricEdit,
    onSaveEdit: () => saveMetric.mutate(),
    savingEdit: saveMetric.isPending,
    bindingDraft,
    onBindingDraft: setBindingDraft,
    editingBinding,
    onEditingBinding: setEditingBinding,
    templates: templates.data?.records ?? [],
    fields: numericFields,
    onAddBinding: () => addBinding.mutate(),
    addingBinding: addBinding.isPending,
    onSaveBinding: () => saveBinding.mutate(),
    savingBinding: saveBinding.isPending,
    onDeleteBinding: (id: number) => removeBinding.mutate(id),
    onDeleteMetric: () => removeMetric.mutate(selected.id),
    preview: previewRange,
    onPreviewChange: setPreviewRange,
    onRunPreview: () => metricPreview.mutate(),
    previewResult: metricPreview.data,
    previewing: metricPreview.isPending,
    permissions,
  } : null

  return (
    <div className="cwgsyw-tasks-page">
      <PageHeader
        showEyebrow={false}
        showBreadcrumb={false}
        showSubtitle={false}
        title="指标与目标"
      />
      <div className="cwgsyw-tasks-metrics-editor">
        <ol className="cwgsyw-cmdb-wizard-steps" aria-label="指标配置步骤">
          {METRIC_STEPS.map((label, index) => (
            <li
              key={label}
              data-state={index < step ? 'complete' : index === step ? 'current' : 'upcoming'}
              aria-current={step === index ? 'step' : undefined}
            >
              <button type="button" className="cwgsyw-tasks-wizard-step" onClick={() => setStep(index)}>
                <span className="cwgsyw-cmdb-wizard-steps__index" aria-hidden="true">{index + 1}</span>
                <span className="cwgsyw-cmdb-wizard-steps__label">{label}</span>
              </button>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <>
          <TaskPanel title="指标定义" description="先新建一个统一口径，或从下方已有指标继续配置。">
            {permissions.create ? (
              <div className="cwgsyw-tasks-section">
                <h3 className="cwgsyw-tasks-section__title">新建指标</h3>
                <MetricDefinitionForm
                  value={metricDraft}
                  onChange={setMetricDraft}
                  onSubmit={() => createMetric.mutate()}
                  busy={createMetric.isPending}
                  submitLabel="新建指标"
                />
              </div>
            ) : null}
            <div className="cwgsyw-tasks-section">
              <h3 className="cwgsyw-tasks-section__title">已有指标</h3>
              <div className="cwgsyw-tasks-pick-list">
                {metrics.data?.map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    className="cwgsyw-tasks-pick"
                    data-selected={selectedId === metric.id}
                    onClick={() => { setSelectedId(metric.id); setEditingMetric(undefined) }}
                  >
                    <span className="cwgsyw-tasks-cell-title">{metric.name}</span>
                    <span className="cwgsyw-tasks-cell-meta">
                      {metric.code} · {metric.bindings.length} 个来源 · {metric.unit || '无单位'}
                    </span>
                    <StatusBadge label={metricAggregationLabels[metric.aggregation] ?? metric.aggregation} status="neutral" />
                  </button>
                ))}
              </div>
              {metrics.data?.length === 0 ? <TaskEmpty iconSrc={TASK_TARGET_ICON} figmaNode={TASK_TARGET_NODE} title="暂无统一指标" description="创建指标后即可映射模板字段并跟踪目标。" /> : null}
            </div>
          </TaskPanel>
          {selected && detailProps ? <MetricDetail {...detailProps} section="definition" /> : null}
          </>
        ) : null}

        {step === 1 ? (
          selected && detailProps ? (
            <MetricDetail {...detailProps} section="sources" />
          ) : (
            <TaskPanel title="来源字段">
              <TaskEmpty iconSrc={TASK_TARGET_ICON} figmaNode={TASK_TARGET_NODE} title="先选择指标" description="回到上一步选择或新建指标后，再绑定来源字段。" />
            </TaskPanel>
          )
        ) : null}

        {step === 2 ? (
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
        ) : null}

        {step === 3 ? (
          selected && detailProps ? (
            <MetricDetail {...detailProps} section="preview" />
          ) : (
            <TaskPanel title="期间预览">
              <TaskEmpty iconSrc={TASK_TARGET_ICON} figmaNode={TASK_TARGET_NODE} title="先选择指标" description="回到第一步选择指标后，再计算期间预览。" />
            </TaskPanel>
          )
        ) : null}

        <div className="cwgsyw-form__actions cwgsyw-tasks-create-actions">
          <Button type="button" size="sm" variant="secondary" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>上一步</Button>
          {step < METRIC_STEPS.length - 1 ? (
            <Button type="button" size="sm" variant="primary" disabled={!selectedId} onClick={() => setStep((value) => value + 1)}>下一步</Button>
          ) : null}
        </div>
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
    <div className="cwgsyw-tasks-form-grid">
      <Field label="名称" required>
        <Input size="sm" value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} />
      </Field>
      <Field label="稳定编码" required>
        <Input size="sm" value={value.code} onChange={(event) => onChange({ ...value, code: event.target.value.replace(/\s+/g, '_').toLowerCase() })} />
      </Field>
      <Field label="值类型">
        <Select size="sm" overlay value={value.valueType} onChange={(valueType) => onChange({ ...value, valueType: valueType as MetricValueType, aggregation: valueType === 'ratio' ? 'ratio' : value.aggregation === 'ratio' ? 'sum' : value.aggregation })} options={metricValueTypeOptions} />
      </Field>
      <Field label="聚合方式">
        <Select size="sm" overlay value={value.aggregation} onChange={(aggregation) => onChange({ ...value, aggregation: aggregation as MetricAggregation })} options={aggregations.map((aggregation) => ({ value: aggregation, label: metricAggregationLabels[aggregation] ?? aggregation }))} />
      </Field>
      <Field label="可加性">
        <Select size="sm" overlay value={value.additivity} onChange={(additivity) => onChange({ ...value, additivity: additivity as MetricAdditivity })} options={metricAdditivityOptions} />
      </Field>
      <Field label="权威来源">
        <Select size="sm" overlay value={value.authoritySource} onChange={(authoritySource) => onChange({ ...value, authoritySource: authoritySource as MetricSourceRole })} options={sourceRoleOptions} />
      </Field>
      <Field label="单位（可选）">
        <Input size="sm" value={value.unit} onChange={(event) => onChange({ ...value, unit: event.target.value })} />
      </Field>
      <Field label="小数位">
        <Input size="sm" type="number" min="0" max="10" value={value.scale} onChange={(event) => onChange({ ...value, scale: event.target.value })} />
      </Field>
      <div className="cwgsyw-tasks-form-grid__full">
        <Field label="说明">
          <Input size="sm" value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} />
        </Field>
      </div>
      <div className="cwgsyw-tasks-form-grid__full">
        <Button size="sm" onClick={onSubmit} disabled={busy || !value.name.trim() || !value.code.trim()}>{submitLabel}</Button>
      </div>
    </div>
  )
}

function MetricDetail(props: MetricDetailProps) {
  const {
    metric, editDraft, onEditDraft, onStartEdit, onSaveEdit, savingEdit, bindingDraft, onBindingDraft,
    editingBinding, onEditingBinding, templates, fields, onAddBinding, addingBinding, onSaveBinding,
    savingBinding, onDeleteBinding, onDeleteMetric, preview, onPreviewChange, onRunPreview,
    previewResult, previewing, permissions, section = 'all',
  } = props
  const showDefinition = section === 'all' || section === 'definition'
  const showSources = section === 'all' || section === 'sources'
  const showPreview = section === 'all' || section === 'preview'
  const selectedField = fields.find((field) => field.id === bindingDraft.fieldId)
  const sourceUnit = textValue(selectedField?.analytics?.unit)
  const needsConversion = Boolean(metric.unit && sourceUnit && metric.unit !== sourceUnit)

  return (
    <TaskPanel
      title={metric.name}
      description={`${metric.code} · ${valueTypeLabels[metric.valueType] ?? metric.valueType} · ${metric.unit || '无单位'} · 权威来源 ${sourceRoleLabels[textValue(metric.authorityPolicy.sourceRole)] ?? '明细事实'}`}
      action={showDefinition ? (
        <span className="cwgsyw-inline-controls">
          {permissions.update && !editDraft ? <TaskIconAction label="编辑指标" icon="edit" onClick={onStartEdit} /> : null}
          {permissions.delete ? <TaskIconAction label="删除指标" icon="trash" danger onClick={onDeleteMetric} /> : null}
        </span>
      ) : undefined}
    >
        {showDefinition && editDraft ? (
          <div className="cwgsyw-tasks-form-stack">
            <MetricDefinitionForm value={editDraft} onChange={onEditDraft} onSubmit={onSaveEdit} busy={savingEdit} submitLabel="保存指标" />
            <Button size="sm" variant="secondary" onClick={() => onEditDraft(undefined)}>取消编辑</Button>
          </div>
        ) : null}
        {showSources ? <section className="cwgsyw-tasks-section">
          <h3 className="cwgsyw-tasks-section__title">来源字段</h3>
          <div className="cwgsyw-tasks-row-list">
            {metric.bindings.map((item) => editingBinding?.id === item.id ? (
              <BindingEditor key={item.id} value={editingBinding} onChange={onEditingBinding} onSave={onSaveBinding} saving={savingBinding} onCancel={() => onEditingBinding(undefined)} />
            ) : (
              <div key={item.id} className="cwgsyw-tasks-row">
                <div className="cwgsyw-tasks-row__main">
                  <p className="cwgsyw-tasks-cell-title">{item.fieldLabel}</p>
                  <p className="cwgsyw-tasks-cell-meta">{item.fieldKey} · 换算 {conversionFactor(item.unitConversion)}</p>
                </div>
                <StatusBadge
                  label={item.enabled ? item.ratioComponent ? `${sourceRoleLabels[item.sourceRole] ?? item.sourceRole} · ${item.ratioComponent === 'numerator' ? '分子' : '分母'}` : (sourceRoleLabels[item.sourceRole] ?? item.sourceRole) : '已停用'}
                  status={item.enabled ? 'success' : 'neutral'}
                />
                {permissions.update ? <TaskIconAction label="编辑字段绑定" icon="edit" onClick={() => onEditingBinding(bindingDraftFrom(item))} /> : null}
                {permissions.update ? <TaskIconAction label="移除字段绑定" icon="trash" danger onClick={() => onDeleteBinding(item.id)} /> : null}
              </div>
            ))}
          </div>
          {metric.bindings.length === 0 ? <p className="cwgsyw-tasks-cell-meta">尚未绑定来源字段。</p> : null}
          {permissions.update ? (
            <div className="cwgsyw-tasks-form-grid cwgsyw-tasks-form-grid--binding">
              <Field label="模板版本">
                <Select size="sm" overlay placeholder="选择模板" value={bindingDraft.templateVersionId == null ? '' : String(bindingDraft.templateVersionId)} options={[{ value: '', label: '选择模板' }, ...templates.filter((item) => item.latestVersionId).map((item) => ({ value: String(item.latestVersionId), label: item.name }))]} onChange={(value) => onBindingDraft({ ...bindingDraft, templateVersionId: value ? Number(value) : undefined, fieldId: undefined })} />
              </Field>
              <Field label="统计字段">
                <Select size="sm" overlay placeholder="选择字段" value={bindingDraft.fieldId == null ? '' : String(bindingDraft.fieldId)} options={[{ value: '', label: '选择字段' }, ...fields.map((field) => ({ value: String(field.id), label: field.label }))]} onChange={(value) => onBindingDraft({ ...bindingDraft, fieldId: value ? Number(value) : undefined })} />
              </Field>
              <Field label="来源角色">
                <Select size="sm" overlay value={bindingDraft.sourceRole} onChange={(sourceRole) => onBindingDraft({ ...bindingDraft, sourceRole: sourceRole as MetricSourceRole })} options={sourceRoleOptions} />
              </Field>
              {metric.valueType === 'ratio' ? (
                <Field label="比率组成">
                  <Select size="sm" overlay value={bindingDraft.ratioComponent ?? ''} onChange={(ratioComponent) => onBindingDraft({ ...bindingDraft, ratioComponent: ratioComponent as BindingDraft['ratioComponent'] })} options={ratioComponentOptions} />
                </Field>
              ) : null}
              <Field label={needsConversion ? '换算系数 *' : '换算系数'}>
                <Input size="sm" type="number" min="0.000001" step="any" value={bindingDraft.conversionFactor} placeholder={needsConversion ? `${sourceUnit} → ${metric.unit}` : '默认 1'} onChange={(event) => onBindingDraft({ ...bindingDraft, conversionFactor: event.target.value })} />
              </Field>
              <div className="cwgsyw-tasks-form-grid__full">
                <Button size="sm" onClick={onAddBinding} disabled={addingBinding || !bindingDraft.templateVersionId || !bindingDraft.fieldId || (metric.valueType === 'ratio' && !bindingDraft.ratioComponent) || (needsConversion && !bindingDraft.conversionFactor)}>绑定字段</Button>
              </div>
            </div>
          ) : null}
        </section> : null}
        {showPreview ? <section className="cwgsyw-tasks-section">
          <h3 className="cwgsyw-tasks-section__title">期间预览</h3>
          <div className="cwgsyw-tasks-preview-controls">
            <Field label="开始日期">
              <Input size="sm" type="date" value={preview.from} onChange={(event) => onPreviewChange({ ...preview, from: event.target.value })} />
            </Field>
            <Field label="结束日期">
              <Input size="sm" type="date" value={preview.to} onChange={(event) => onPreviewChange({ ...preview, to: event.target.value })} />
            </Field>
            <Button size="sm" onClick={onRunPreview} disabled={previewing}>计算</Button>
          </div>
          {previewResult ? (
            <div className="cwgsyw-tasks-preview">
              <MetricValue label="系统汇总" value={previewResult.systemValue} />
              <MetricValue label="人工上报" value={previewResult.manualValue} />
              <MetricValue label="差异" value={previewResult.difference} />
              <MetricValue label="来源任务" value={previewResult.sourceTaskCount} note={sourceRoleLabels[previewResult.selectedSourceRole] ?? previewResult.selectedSourceRole} />
            </div>
          ) : null}
        </section> : null}
    </TaskPanel>
  )
}

function BindingEditor({ value, onChange, onSave, saving, onCancel }: {
  value: BindingDraft
  onChange: (value?: BindingDraft) => void
  onSave: () => void
  saving: boolean
  onCancel: () => void
}) {
  return (
    <div className="cwgsyw-tasks-form-grid cwgsyw-tasks-form-grid--binding">
      <div>
        <p className="cwgsyw-tasks-cell-title">{value.fieldLabel}</p>
        <p className="cwgsyw-tasks-cell-meta">{value.fieldKey}</p>
      </div>
      <Field label="来源角色">
        <Select size="sm" overlay value={value.sourceRole} onChange={(sourceRole) => onChange({ ...value, sourceRole: sourceRole as MetricSourceRole })} options={sourceRoleOptions} />
      </Field>
      <Field label="换算系数">
        <Input size="sm" type="number" min="0.000001" step="any" value={value.conversionFactor} onChange={(event) => onChange({ ...value, conversionFactor: event.target.value })} />
      </Field>
      <div className="cwgsyw-tasks-inline-end">
        <Checkbox className="cwgsyw-tasks-choice" label="启用" checked={value.enabled} onChange={(event) => onChange({ ...value, enabled: event.target.checked })} />
        <Button size="sm" onClick={onSave} disabled={saving}>保存</Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>取消</Button>
      </div>
    </div>
  )
}

function GoalsCard(props: GoalsCardProps) {
  const { metrics, goals, templates, groups, users, value, editingGoalId, onChange, onSave, saving, onEdit, onCancelEdit, onDelete, permissions } = props
  const scopeOptions = goalScopeOptions(value.scopeType, templates, groups, users)
  const allowedScopes = ['tenant', ...(groups.length ? ['group'] : []), ...(users.length ? ['user'] : []), ...(templates.length ? ['template'] : [])]
  return (
    <TaskPanel title="指标目标" description="不同周期可使用独立目标、告警阈值和统计范围。">
        {(permissions.create || editingGoalId) ? (
          <div className="cwgsyw-tasks-form-grid cwgsyw-tasks-form-grid--wide">
            <Field label="指标">
              <Select size="sm" overlay placeholder="选择指标" value={value.metricId == null ? '' : String(value.metricId)} options={[{ value: '', label: '选择指标' }, ...metrics.map((metric) => ({ value: String(metric.id), label: metric.name }))]} onChange={(next) => onChange({ ...value, metricId: next ? Number(next) : undefined })} />
            </Field>
            <Field label="范围">
              <Select size="sm" overlay value={value.scopeType} onChange={(scopeType) => onChange({ ...value, scopeType: scopeType as GoalDraft['scopeType'], scopeKey: '' })} options={allowedScopes.map((scope) => ({ value: scope, label: scopeLabels[scope] ?? scope }))} />
            </Field>
            {value.scopeType !== 'tenant' ? (
              <Field label="范围对象">
                <Select size="sm" overlay placeholder="请选择" value={value.scopeKey} options={[{ value: '', label: '请选择' }, ...scopeOptions.map((option) => ({ value: option.value, label: option.label }))]} onChange={(scopeKey) => onChange({ ...value, scopeKey })} />
              </Field>
            ) : null}
            <Field label="目标值">
              <Input size="sm" type="number" min="0" step="any" value={value.targetValue} onChange={(event) => onChange({ ...value, targetValue: event.target.value })} />
            </Field>
            <Field label="预警阈值">
              <Input size="sm" type="number" min="0" step="any" value={value.warningThreshold} onChange={(event) => onChange({ ...value, warningThreshold: event.target.value })} />
            </Field>
            <Field label="严重阈值">
              <Input size="sm" type="number" min="0" step="any" value={value.criticalThreshold} onChange={(event) => onChange({ ...value, criticalThreshold: event.target.value })} />
            </Field>
            <Field label="比较">
              <Select size="sm" overlay value={value.comparison} onChange={(comparison) => onChange({ ...value, comparison: comparison as GoalDraft['comparison'] })} options={comparisonOptions} />
            </Field>
            <Field label="周期">
              <Select size="sm" overlay value={value.periodType} onChange={(periodType) => onChange({ ...value, periodType: periodType as GoalDraft['periodType'] })} options={periodOptions} />
            </Field>
            <Field label="生效开始">
              <Input size="sm" type="date" value={value.effectiveFrom} onChange={(event) => onChange({ ...value, effectiveFrom: event.target.value })} />
            </Field>
            <Field label="生效结束">
              <Input size="sm" type="date" value={value.effectiveTo} onChange={(event) => onChange({ ...value, effectiveTo: event.target.value })} />
            </Field>
            <div className="cwgsyw-tasks-form-grid__full cwgsyw-inline-controls">
              <Button size="sm" onClick={onSave} disabled={saving || !value.metricId || value.targetValue === '' || (value.scopeType !== 'tenant' && !value.scopeKey)}>{editingGoalId ? '更新目标' : '创建目标'}</Button>
              {editingGoalId ? <Button size="sm" variant="secondary" onClick={onCancelEdit}>取消</Button> : null}
            </div>
          </div>
        ) : null}
        <div className="cwgsyw-tasks-row-list">
          {goals.map((item) => (
            <div key={item.id} className="cwgsyw-tasks-row">
              <div className="cwgsyw-tasks-row__main">
                <p className="cwgsyw-tasks-cell-title">{item.metricName}</p>
                <p className="cwgsyw-tasks-cell-meta">{scopeLabel(item, templates, groups, users)} · {periodLabels[item.periodType] ?? item.periodType} · {item.effectiveFrom} 至 {item.effectiveTo}</p>
              </div>
              <StatusBadge label={goalStatusLabels[item.status] ?? item.status} status={goalTone(item.status)} />
              <span className="cwgsyw-tasks-cell-meta">目标 {item.targetValue} · 实际 {item.actualValue ?? '-'}</span>
              <span className="cwgsyw-tasks-cell-meta">{item.completionRate == null ? '-' : `${item.completionRate}%`}</span>
              {permissions.update ? <TaskIconAction label="编辑目标" icon="edit" onClick={() => onEdit(item)} /> : null}
              {permissions.delete ? <TaskIconAction label="删除目标" icon="trash" danger onClick={() => onDelete(item.id)} /> : null}
            </div>
          ))}
        </div>
        {goals.length === 0 ? <TaskEmpty iconSrc={TASK_TARGET_ICON} figmaNode={TASK_TARGET_NODE} title="暂无指标目标" description="为当前指标设置周期目标后会显示在这里。" /> : null}
    </TaskPanel>
  )
}


function MetricValue({ label, value, note }: { label: string; value?: number; note?: string }) {
  return (
    <div className="cwgsyw-tasks-preview__item">
      <p className="cwgsyw-tasks-cell-meta">{label}</p>
      <p className="cwgsyw-tasks-preview__value">{value == null ? '-' : value}</p>
      {note ? <p className="cwgsyw-tasks-cell-meta">{note}</p> : null}
    </div>
  )
}


function TaskIconAction({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string
  icon: 'edit' | 'trash'
  onClick: () => void
  danger?: boolean
}) {
  return (
    <NeutralTooltip content={label} className="cwgsyw-tooltip--pill" followCursor>
      <IconButton
        type="button"
        size="sm"
        variant="ghost"
        aria-label={label}
        className={['cwgsyw-tasks-icon-action', danger ? 'cwgsyw-tasks-icon-action--danger' : ''].filter(Boolean).join(' ')}
        icon={<span aria-hidden="true" className={['cwgsyw-tasks-figma-icon', `cwgsyw-tasks-figma-icon--${icon}`].join(' ')} />}
        onClick={onClick}
      />
    </NeutralTooltip>
  )
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
  if (goal.scopeType === 'tenant') return '租户'
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

function goalTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  return status === 'met' ? 'success' : status === 'critical' ? 'danger' : status === 'warning' || status === 'not_met' ? 'warning' : 'neutral'
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
  section?: 'all' | 'definition' | 'sources' | 'preview'
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
