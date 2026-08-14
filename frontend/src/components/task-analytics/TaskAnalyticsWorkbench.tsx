'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { analyticsDisplayColumns, formatAnalyticsValue } from '@/components/task-analytics/analytics-display'
import { listTaskTemplates, type TaskTemplateSummary } from '@/lib/task-template-api'
import {
  addAnalyticsWidget,
  createAnalyticsDashboard,
  exportTaskAnalytics,
  listAnalyticsDashboards,
  listAnalyticsFields,
  listAnalyticsDimensions,
  queryTaskAnalytics,
  type AnalyticsFieldMetadata,
  type AnalyticsQueryRequest,
} from '@/lib/task-analytics-api'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  DataManagementPage,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  NeutralPopover,
  PageHeader,
  SearchInput,
  Select,
  Table,
} from '@/design-system/figma-neutral/components'

const today = new Date().toISOString().slice(0, 10)
const monthStart = `${today.slice(0, 8)}01`
const aggregationLabels: Record<string, string> = { sum: '合计', avg: '平均值', min: '最小值', max: '最大值', count: '计数', distinct_count: '去重计数', weighted_avg: '加权平均值', ratio: '比率' }

interface FieldSelection { key: string; aggregation: string }

export function TaskAnalyticsWorkbench() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [templateVersionId, setTemplateVersionId] = useState<number>()
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [grain, setGrain] = useState('day')
  const [fieldSelections, setFieldSelections] = useState<FieldSelection[]>([])
  const [dimension, setDimension] = useState('business_date')
  const [output, setOutput] = useState('aggregate')
  const [textSearch, setTextSearch] = useState('')
  const [request, setRequest] = useState<AnalyticsQueryRequest>()

  const templates = useQuery({
    queryKey: ['task-analytics-templates'],
    queryFn: () => listTaskTemplates({ status: 'published', size: 200 }),
  })
  const publishedTemplates = templates.data?.records ?? []
  const effectiveTemplateVersionId = templateVersionId ?? publishedTemplates[0]?.latestVersionId
  const fields = useQuery({
    queryKey: ['task-analytics-fields', effectiveTemplateVersionId],
    queryFn: () => listAnalyticsFields(effectiveTemplateVersionId as number),
    enabled: Boolean(effectiveTemplateVersionId),
  })
  const dimensions = useQuery({ queryKey: ['task-analytics-dimensions'], queryFn: listAnalyticsDimensions })
  const result = useQuery({
    queryKey: ['task-analytics-query', request],
    queryFn: () => queryTaskAnalytics(request as AnalyticsQueryRequest),
    enabled: Boolean(request),
  })
  const selectedFields = fieldSelections.map((selection) => ({
    selection,
    field: fields.data?.find((item) => item.key === selection.key),
  })).filter((item): item is { selection: FieldSelection; field: AnalyticsFieldMetadata } => Boolean(item.field))
  const selectedFieldSummary = selectedFields.length === 0 ? '选择字段' : selectedFields.map((item) => item.field.label).join('、')
  const aggregationSummary = selectedFields.length === 1
    ? aggregationLabels[selectedFields[0].selection.aggregation] ?? selectedFields[0].selection.aggregation
    : `已配置 ${selectedFields.length} 个字段`
  const canExport = hasPermission('task_analytics', 'export')
  const canCreateDashboard = hasPermission('task_analytics', 'create')
  const dashboards = useQuery({ queryKey: ['task-analytics-dashboards'], queryFn: listAnalyticsDashboards })
  const setupLoading = templates.isLoading || dimensions.isLoading || Boolean(effectiveTemplateVersionId && fields.isLoading)
  const setupError = templates.isError || dimensions.isError || fields.isError

  const retrySetup = () => {
    void templates.refetch()
    void dimensions.refetch()
    if (effectiveTemplateVersionId) void fields.refetch()
  }

  const buildRequest = (): AnalyticsQueryRequest | undefined => {
    if (!effectiveTemplateVersionId || fieldSelections.length === 0) return undefined
    const metrics = output === 'aggregate' ? fieldSelections.map(({ key, aggregation }) => {
      const [fieldKey, tableColumn] = splitTableField(key)
      return { fieldKey, tableColumn, aggregation, alias: `${key}_${aggregation}` }
    }) : []
    return {
      source: { templateVersionIds: [effectiveTemplateVersionId] },
      time: { field: 'business_date', from, to, grain },
      metrics,
      dimensions: [dimension],
      filters: [],
      effectivePolicy: 'approved_or_no_approval',
      orderBy: metrics[0]?.alias ? [{ field: metrics[0].alias, direction: 'desc' }] : undefined,
      limit: 200,
      output,
      detailFields: output === 'aggregate' ? undefined : fieldSelections.map((item) => item.key),
      textSearch: textSearch || undefined,
    }
  }

  const toggleField = (field: AnalyticsFieldMetadata, checked: boolean) => {
    setFieldSelections((current) => checked
      ? [...current, { key: field.key, aggregation: defaultAggregation(field) }]
      : current.filter((item) => item.key !== field.key))
  }

  const updateAggregation = (key: string, aggregation: string) => {
    setFieldSelections((current) => current.map((item) => item.key === key ? { ...item, aggregation } : item))
  }

  const run = () => {
    const next = buildRequest()
    if (!next) return
    setRequest(next)
    void queryClient.invalidateQueries({ queryKey: ['task-analytics-query'] })
  }

  const saveDashboard = async () => {
    if (!request || !canCreateDashboard) return
    const selectionTitle = selectedFields.length === 1 ? selectedFields[0].field.label : `${selectedFields[0]?.field.label ?? '任务'}等${selectedFields.length}项`
    const dashboard = await createAnalyticsDashboard({ name: `${selectionTitle}统计看板` })
    await addAnalyticsWidget(dashboard.id, {
      widgetType: output === 'aggregate' ? 'bar_chart' : output,
      title: `${selectionTitle}统计`,
      dataSourceConfig: { query: request },
      displayConfig: { valueFormat: selectedFields.length === 1 ? selectedFields[0].field.unit ?? '' : '' },
    })
    await queryClient.invalidateQueries({ queryKey: ['task-analytics-dashboards'] })
    router.push(`/tasks/analytics/${dashboard.id}`)
  }

  const tableColumns = useMemo(() => analyticsDisplayColumns(result.data?.columns ?? []), [result.data?.columns])
  const tableRows = (result.data?.rows ?? []).map((row, index) => ({
    id: String(index),
    cells: Object.fromEntries(tableColumns.map((column) => [column, formatAnalyticsValue(column, row[column])])),
  }))

  return (
    <DataManagementPage
      embedded
      header={
        <PageHeader
          eyebrow="统一任务平台"
          title="任务统计"
          subtitle="按模板字段、时间、人员、组和 CI 快照查询数字、文字与附件事实。"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/tasks', label: '我的任务' },
                { label: '任务统计' },
              ]}
            />
          }
          actions={
            <div className="cwgsyw-designer__actions">
              {canCreateDashboard && request ? <Button type="button" size="sm" onClick={() => void saveDashboard()}>保存为看板</Button> : null}
              {canExport && request ? (
                <>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void exportTaskAnalytics(request, 'csv')}>CSV</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void exportTaskAnalytics(request, 'xlsx')}>Excel</Button>
                </>
              ) : null}
            </div>
          }
        />
      }
      filter={
        setupLoading ? <LoadingState label="正在加载统计配置…" /> : setupError ? (
          <ErrorState
            title="统计配置加载失败"
            description="无法读取模板、字段或维度配置，请重试。"
            retry={<Button type="button" variant="secondary" onClick={retrySetup}>重试</Button>}
          />
        ) : (
          <Card title="查询条件">
            <div className="cwgsyw-filter-grid">
              <Field label="任务模板">
                <Select
                  value={effectiveTemplateVersionId ? String(effectiveTemplateVersionId) : ''}
                  onChange={(value) => { setTemplateVersionId(Number(value)); setFieldSelections([]) }}
                  options={publishedTemplates.map((template: TaskTemplateSummary) => ({ value: String(template.latestVersionId), label: template.name }))}
                  placeholder="选择模板"
                />
              </Field>
              <Field label="统计字段">
                <NeutralPopover title="选择一个或多个字段" trigger={<Button type="button" variant="secondary">{selectedFieldSummary}</Button>}>
                  <div className="cwgsyw-form">
                    {fields.data?.map((field) => (
                      <Checkbox
                        key={field.key}
                        label={field.label}
                        checked={fieldSelections.some((item) => item.key === field.key)}
                        onChange={(event) => toggleField(field, event.target.checked)}
                      />
                    ))}
                  </div>
                </NeutralPopover>
              </Field>
              <Field label="聚合方式">
                <NeutralPopover title="分别配置聚合方式" trigger={<Button type="button" variant="secondary" disabled={output !== 'aggregate' || selectedFields.length === 0}>{output === 'aggregate' ? aggregationSummary : '明细无需聚合'}</Button>}>
                  <div className="cwgsyw-form">
                    {selectedFields.map(({ field, selection }) => (
                      <Field key={field.key} label={field.label}>
                        <Select
                          value={selection.aggregation}
                          onChange={(value) => updateAggregation(field.key, value)}
                          options={field.aggregations.map((option) => ({ value: option, label: aggregationLabels[option] ?? option }))}
                        />
                      </Field>
                    ))}
                  </div>
                </NeutralPopover>
              </Field>
              <Field label="输出类型">
                <Select
                  value={output}
                  onChange={setOutput}
                  options={[
                    { value: 'aggregate', label: '聚合' },
                    { value: 'detail', label: '明细' },
                    { value: 'text_list', label: '文字列表' },
                    { value: 'attachment_list', label: '附件列表' },
                    { value: 'image_gallery', label: '图片墙' },
                  ]}
                />
              </Field>
              <Field label="开始日期">
                <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </Field>
              <Field label="结束日期">
                <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </Field>
              <Field label="时间粒度">
                <Select
                  value={grain}
                  onChange={setGrain}
                  options={[
                    { value: 'day', label: '日' },
                    { value: 'week', label: '周' },
                    { value: 'month', label: '月' },
                    { value: 'quarter', label: '季' },
                    { value: 'year', label: '年' },
                  ]}
                />
              </Field>
              <Field label="分组维度">
                <Select
                  value={dimension}
                  onChange={setDimension}
                  options={(dimensions.data ?? []).map((item) => ({ value: item.key, label: item.label }))}
                />
              </Field>
              <div className="cwgsyw-filter-grid--span-3">
                <Field label="文字搜索">
                  <SearchInput value={textSearch} onChange={(event) => setTextSearch(event.target.value)} placeholder="仅对文字事实筛选" />
                </Field>
              </div>
              <div>
                <Button type="button" variant="primary" onClick={run} disabled={!effectiveTemplateVersionId || fieldSelections.length === 0}>运行统计</Button>
              </div>
            </div>
          </Card>
        )
      }
      content={
        setupLoading || setupError ? null : (
          <div className="cwgsyw-form">
            <Card
              title="结果"
              description={result.data ? `扫描 ${result.data.scannedFacts} 条事实，生成于 ${new Date(result.data.generatedAt).toLocaleString('zh-CN')}` : '选择条件后运行统计'}
              headerAction={<Button type="button" size="sm" variant="ghost" onClick={() => setRequest(undefined)} disabled={!request}>清空</Button>}
            >
              {result.isLoading ? <LoadingState label="正在计算统计结果…" /> : null}
              {result.isError ? (
                <ErrorState
                  title="统计查询失败"
                  description={getApiErrorMessage(result.error, '请检查查询条件后重试。')}
                  retry={<Button type="button" variant="secondary" onClick={() => void result.refetch()}>重试</Button>}
                />
              ) : null}
              {!result.isLoading && !result.isError && result.data?.rows.length === 0 ? (
                <EmptyState title="没有符合条件的事实" description="调整查询条件后重新运行统计。" />
              ) : null}
              {!result.isLoading && !result.isError && (result.data?.rows.length ?? 0) > 0 ? (
                <Table
                  showSearch={false}
                  columns={tableColumns.map((column) => ({ key: column, label: result.data?.columnLabels?.[column] ?? column }))}
                  rows={tableRows}
                />
              ) : null}
              {!request && !result.isLoading && !result.isError && !result.data ? (
                <EmptyState title="尚未运行统计" description="选择条件后运行统计。" />
              ) : null}
            </Card>
            <Card title="我的看板" description="保存后的统计组件会按查看人的任务权限重新计算。">
              {(dashboards.data ?? []).length === 0 ? (
                <EmptyState title="暂无看板" description="运行一次统计后即可保存。" />
              ) : (
                <div className="cwgsyw-dashboard-grid">
                  {(dashboards.data ?? []).map((dashboard) => (
                    <Button key={dashboard.id} type="button" variant="outline" className="cwgsyw-dashboard-tile" onClick={() => router.push(`/tasks/analytics/${dashboard.id}`)}>
                      <span>
                        <strong>{dashboard.name}</strong>
                        <span className="cwgsyw-type-label-xs">{dashboard.scopeType === 'private' ? '私有' : dashboard.scopeType === 'group' ? '组内共享' : '租户共享'}</span>
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )
      }
    />
  )
}

function defaultAggregation(field: AnalyticsFieldMetadata): string {
  return field.defaultAggregation && field.aggregations.includes(field.defaultAggregation)
    ? field.defaultAggregation
    : field.aggregations[0] ?? 'count'
}

function splitTableField(key: string) {
  const separator = key.indexOf('.')
  return separator < 0 ? [key, undefined] : [key.slice(0, separator), key.slice(separator + 1)]
}
