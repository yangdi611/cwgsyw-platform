import api from '@/lib/api'

export interface AnalyticsFieldMetadata {
  key: string
  label: string
  type: string
  roles: string[]
  aggregations: string[]
  unit?: string
  defaultAggregation?: string
  validation: Record<string, unknown>
}

export interface AnalyticsQueryRequest {
  source: { templateVersionIds: number[] }
  time: { field?: string; from: string; to: string; grain?: string }
  metrics: Array<{
    fieldKey?: string
    tableColumn?: string
    aggregation: string
    alias?: string
    numeratorFieldKey?: string
    denominatorFieldKey?: string
    weightFieldKey?: string
  }>
  dimensions: string[]
  filters: Array<{ field: string; operator: string; value?: unknown }>
  effectivePolicy?: string
  orderBy?: Array<{ field: string; direction?: string }>
  limit?: number
  output?: string
  detailFields?: string[]
  textSearch?: string
}

export interface AnalyticsQueryResponse {
  columns: string[]
  rows: Array<Record<string, unknown>>
  scannedFacts: number
  generatedAt: string
  effectivePolicy: string
  definition: Record<string, unknown>
}

export interface AnalyticsDashboard {
  id: number
  code: string
  name: string
  description?: string
  scopeType: 'private' | 'group' | 'tenant'
  ownerId: number
  ownerGroupId?: number
  layoutConfig: Record<string, unknown>
  widgets: AnalyticsWidget[]
  canManage: boolean
  createdAt: string
  updatedAt: string
}

export interface AnalyticsWidget {
  id: number
  dashboardId: number
  widgetType: string
  title: string
  dataSourceConfig: Record<string, unknown>
  displayConfig: Record<string, unknown>
  sortOrder: number
  updatedAt: string
}

export interface AnalyticsSubscription {
  id: number
  dashboardId: number
  name: string
  recipientType: 'user' | 'group'
  recipientConfig: { ids: number[] }
  scheduleConfig: { type: 'daily' | 'weekly' | 'monthly'; time?: string; dayOfWeek?: number; dayOfMonth?: number }
  channel: 'notification' | 'email'
  status: string
  lastSentAt?: string
  nextSendAt?: string
  createdAt: string
  updatedAt: string
}

export interface AnalyticsSubscriptionPayload {
  name: string
  recipientType: 'user' | 'group'
  recipientConfig: { ids: number[] }
  scheduleConfig: { type: 'daily' | 'weekly' | 'monthly'; time: string; dayOfWeek?: number; dayOfMonth?: number }
  channel: 'notification' | 'email'
}

export type MetricValueType = 'number' | 'ratio' | 'percentage' | 'duration' | 'count'
export type MetricAggregation = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'weighted_avg' | 'ratio'
export type MetricAdditivity = 'additive' | 'non_additive' | 'semi_additive' | 'distinct' | 'snapshot' | 'formula'
export type MetricSourceRole = 'fact' | 'system_rollup' | 'manual_report'

export interface TaskMetricBinding {
  id: number
  metricId: number
  templateVersionId: number
  fieldId: number
  fieldKey: string
  fieldLabel: string
  fieldType: string
  sourceRole: MetricSourceRole
  ratioComponent?: 'numerator' | 'denominator'
  unitConversion: Record<string, unknown>
  enabled: boolean
}

export interface TaskMetricDefinition {
  id: number
  code: string
  name: string
  description?: string
  valueType: MetricValueType
  unit?: string
  scale?: number
  aggregation: MetricAggregation
  additivity: MetricAdditivity
  formulaConfig: Record<string, unknown>
  authorityPolicy: Record<string, unknown>
  bindings: TaskMetricBinding[]
  createdAt: string
  updatedAt: string
}

export interface TaskMetricDefinitionPayload {
  code: string
  name: string
  description?: string
  valueType: MetricValueType
  unit?: string
  scale?: number
  aggregation: MetricAggregation
  additivity: MetricAdditivity
  formulaConfig?: Record<string, unknown>
  authorityPolicy?: Record<string, unknown>
}

export interface TaskMetricBindingPayload {
  templateVersionId: number
  fieldId: number
  sourceRole: MetricSourceRole
  ratioComponent?: 'numerator' | 'denominator'
  unitConversion?: Record<string, unknown>
  enabled?: boolean
}

export interface TaskMetricPreview {
  metricId: number
  from: string
  to: string
  systemValue?: number
  manualValue?: number
  difference?: number
  selectedSourceRole: string
  sourceTaskCount: number
  factIds: number[]
  taskIds: number[]
  submissionIds: number[]
}

export interface TaskMetricGoal {
  id: number
  metricId: number
  metricName: string
  scopeType: 'tenant' | 'group' | 'user' | 'template'
  scopeKey?: string
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
  periodConfig: Record<string, unknown>
  targetValue: number
  actualValue?: number
  completionRate?: number
  warningThreshold?: number
  criticalThreshold?: number
  comparison: 'at_least' | 'at_most' | 'exact'
  status: 'met' | 'warning' | 'critical' | 'not_met' | 'no_data'
  effectiveFrom: string
  effectiveTo: string
}

export interface TaskMetricGoalPayload {
  metricId: number
  scopeType: TaskMetricGoal['scopeType']
  scopeKey?: string
  periodType: TaskMetricGoal['periodType']
  periodConfig?: Record<string, unknown>
  targetValue: number
  warningThreshold?: number
  criticalThreshold?: number
  comparison: TaskMetricGoal['comparison']
  effectiveFrom: string
  effectiveTo: string
}

export interface TaskAutomationRule {
  id: number
  name: string
  description?: string
  triggerType: 'submission_approved' | 'metric_threshold' | 'task_completed'
  triggerConfig: Record<string, unknown>
  conditionConfig: Record<string, unknown>
  actionType: 'create_task' | 'notify'
  actionConfig: Record<string, unknown>
  status: 'draft' | 'active' | 'paused' | 'archived'
  createdAt: string
  updatedAt: string
}

export interface TaskAutomationRulePayload {
  name: string
  description?: string
  triggerType: TaskAutomationRule['triggerType']
  triggerConfig?: Record<string, unknown>
  conditionConfig?: Record<string, unknown>
  actionType: TaskAutomationRule['actionType']
  actionConfig?: Record<string, unknown>
}

export interface TaskAutomationExecution {
  id: number
  ruleId: number
  sourceType: string
  sourceId: number
  dedupeKey: string
  status: 'pending' | 'succeeded' | 'failed' | 'dead' | 'skipped'
  resultTaskId?: number
  attemptCount?: number
  nextAttemptAt?: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

export interface TaskAutomationPreview {
  matched: boolean
  reason: string
  resolvedAction: Record<string, unknown>
}

export async function listAnalyticsFields(templateVersionId: number) {
  return api.get(`/task-analytics/templates/${templateVersionId}/fields`)
    .then((response) => response.data.data as AnalyticsFieldMetadata[])
}

export async function listAnalyticsDimensions() {
  return api.get('/task-analytics/dimensions').then((response) => response.data.data as Array<{ key: string; label: string; category: string }>)
}

export async function queryTaskAnalytics(request: AnalyticsQueryRequest) {
  return api.post('/task-analytics/query', request).then((response) => response.data.data as AnalyticsQueryResponse)
}

export async function drilldownTaskAnalytics(request: { query: AnalyticsQueryRequest; dimensions?: Record<string, unknown>; page?: number; size?: number }) {
  return api.post('/task-analytics/drilldown', request).then((response) => response.data.data as { records: Array<Record<string, unknown>>; total: number; page: number; size: number })
}

export async function fetchAnalyticsAttachment(downloadPath: string) {
  const endpoint = downloadPath.replace(/^\/api/, '')
  return api.get(endpoint, { responseType: 'blob' }).then((response) => response.data as Blob)
}

export async function downloadAnalyticsAttachment(downloadPath: string, fileName: string) {
  const blob = await fetchAnalyticsAttachment(downloadPath)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function exportTaskAnalytics(request: AnalyticsQueryRequest, format: 'csv' | 'xlsx') {
  const response = await api.post('/task-analytics/export', { query: request, format, fileName: '任务统计' }, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data as Blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `任务统计.${format}`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function listAnalyticsDashboards() {
  return api.get('/task-analytics/dashboards').then((response) => response.data.data as AnalyticsDashboard[])
}

export async function createAnalyticsDashboard(payload: { name: string; description?: string; scopeType?: string; ownerGroupId?: number }) {
  return api.post('/task-analytics/dashboards', payload).then((response) => response.data.data as AnalyticsDashboard)
}

export async function getAnalyticsDashboard(id: number) {
  return api.get(`/task-analytics/dashboards/${id}`).then((response) => response.data.data as AnalyticsDashboard)
}

export async function addAnalyticsWidget(dashboardId: number, payload: { widgetType: string; title: string; dataSourceConfig: Record<string, unknown>; displayConfig?: Record<string, unknown>; sortOrder?: number }) {
  return api.post(`/task-analytics/dashboards/${dashboardId}/widgets`, payload).then((response) => response.data.data as AnalyticsWidget)
}

export async function updateAnalyticsDashboard(id: number, payload: { name: string; description?: string; scopeType?: string; ownerGroupId?: number; layoutConfig?: Record<string, unknown> }) {
  return api.put(`/task-analytics/dashboards/${id}`, payload).then((response) => response.data.data as AnalyticsDashboard)
}

export async function deleteAnalyticsDashboard(id: number) {
  await api.delete(`/task-analytics/dashboards/${id}`)
}

export async function shareAnalyticsDashboard(id: number, payload: { scopeType: string; ownerGroupId?: number }) {
  return api.post(`/task-analytics/dashboards/${id}/share`, payload).then((response) => response.data.data as AnalyticsDashboard)
}

export async function updateAnalyticsWidget(id: number, payload: { widgetType: string; title: string; dataSourceConfig: Record<string, unknown>; displayConfig?: Record<string, unknown>; sortOrder?: number }) {
  return api.put(`/task-analytics/widgets/${id}`, payload).then((response) => response.data.data as AnalyticsWidget)
}

export async function deleteAnalyticsWidget(id: number) {
  await api.delete(`/task-analytics/widgets/${id}`)
}

export async function listAnalyticsSubscriptions(dashboardId: number) {
  return api.get(`/task-analytics/dashboards/${dashboardId}/subscriptions`)
    .then((response) => response.data.data as AnalyticsSubscription[])
}

export async function createAnalyticsSubscription(dashboardId: number, payload: AnalyticsSubscriptionPayload) {
  return api.post(`/task-analytics/dashboards/${dashboardId}/subscriptions`, payload)
    .then((response) => response.data.data as AnalyticsSubscription)
}

export async function deleteAnalyticsSubscription(subscriptionId: number) {
  await api.delete(`/task-analytics/subscriptions/${subscriptionId}`)
}

export async function testAnalyticsSubscription(subscriptionId: number) {
  await api.post(`/task-analytics/subscriptions/${subscriptionId}/test`)
}

export async function listTaskMetrics() {
  return api.get('/task-metrics').then((response) => response.data.data as TaskMetricDefinition[])
}

export async function createTaskMetric(payload: TaskMetricDefinitionPayload) {
  return api.post('/task-metrics', payload).then((response) => response.data.data as TaskMetricDefinition)
}

export async function updateTaskMetric(metricId: number, payload: TaskMetricDefinitionPayload) {
  return api.put(`/task-metrics/${metricId}`, payload).then((response) => response.data.data as TaskMetricDefinition)
}

export async function deleteTaskMetric(metricId: number) {
  await api.delete(`/task-metrics/${metricId}`)
}

export async function addTaskMetricBinding(metricId: number, payload: TaskMetricBindingPayload) {
  return api.post(`/task-metrics/${metricId}/bindings`, payload).then((response) => response.data.data as TaskMetricBinding)
}

export async function updateTaskMetricBinding(bindingId: number, payload: TaskMetricBindingPayload) {
  return api.put(`/task-metrics/bindings/${bindingId}`, payload).then((response) => response.data.data as TaskMetricBinding)
}

export async function deleteTaskMetricBinding(bindingId: number) {
  await api.delete(`/task-metrics/bindings/${bindingId}`)
}

export async function previewTaskMetric(metricId: number, payload: { from: string; to: string; groupId?: number }) {
  return api.post(`/task-metrics/${metricId}/preview`, payload).then((response) => response.data.data as TaskMetricPreview)
}

export async function listTaskMetricGoals() {
  return api.get('/task-metric-goals').then((response) => response.data.data as TaskMetricGoal[])
}

export async function createTaskMetricGoal(payload: TaskMetricGoalPayload) {
  return api.post('/task-metric-goals', payload).then((response) => response.data.data as TaskMetricGoal)
}

export async function updateTaskMetricGoal(goalId: number, payload: TaskMetricGoalPayload) {
  return api.put(`/task-metric-goals/${goalId}`, payload).then((response) => response.data.data as TaskMetricGoal)
}

export async function deleteTaskMetricGoal(goalId: number) {
  await api.delete(`/task-metric-goals/${goalId}`)
}

export async function listTaskAutomations() {
  return api.get('/task-automations').then((response) => response.data.data as TaskAutomationRule[])
}

export async function createTaskAutomation(payload: TaskAutomationRulePayload) {
  return api.post('/task-automations', payload).then((response) => response.data.data as TaskAutomationRule)
}

export async function updateTaskAutomation(ruleId: number, payload: TaskAutomationRulePayload) {
  return api.put(`/task-automations/${ruleId}`, payload).then((response) => response.data.data as TaskAutomationRule)
}

export async function deleteTaskAutomation(ruleId: number) {
  await api.delete(`/task-automations/${ruleId}`)
}

export async function changeTaskAutomationStatus(ruleId: number, action: 'activate' | 'pause') {
  return api.post(`/task-automations/${ruleId}/${action}`).then((response) => response.data.data as TaskAutomationRule)
}

export async function listTaskAutomationExecutions(ruleId: number) {
  return api.get(`/task-automations/${ruleId}/executions`).then((response) => response.data.data as TaskAutomationExecution[])
}

export async function retryTaskAutomationExecution(executionId: number) {
  await api.post(`/task-automations/executions/${executionId}/retry`)
}

export async function previewTaskAutomation(ruleId: number, payload: { sourceTaskId: number; sourceSubmissionId?: number; attributes?: Record<string, unknown> }) {
  return api.post(`/task-automations/${ruleId}/preview`, payload).then((response) => response.data.data as TaskAutomationPreview)
}
