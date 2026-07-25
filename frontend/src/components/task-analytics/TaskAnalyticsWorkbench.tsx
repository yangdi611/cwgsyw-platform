'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, ChevronDown, Download, ExternalLink, FileDown, Plus, Save, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/shared'
import { analyticsDisplayColumns, formatAnalyticsValue } from '@/components/task-analytics/analytics-display'
import { listTaskTemplates, type TaskTemplateSummary } from '@/lib/task-template-api'
import { addAnalyticsWidget, createAnalyticsDashboard, exportTaskAnalytics, listAnalyticsDashboards, listAnalyticsFields, listAnalyticsDimensions, queryTaskAnalytics, type AnalyticsFieldMetadata, type AnalyticsQueryRequest } from '@/lib/task-analytics-api'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="统一任务平台"
        title="任务统计"
        subtitle="按模板字段、时间、人员、组和 CI 快照查询数字、文字与附件事实。"
        actions={<div className="flex flex-wrap gap-2">{canCreateDashboard && request && <Button size="sm" onClick={() => void saveDashboard()}><Save className="h-4 w-4" />保存为看板</Button>}{canExport && request && <><Button size="sm" onClick={() => void exportTaskAnalytics(request, 'csv')}><Download className="h-4 w-4" />CSV</Button><Button size="sm" onClick={() => void exportTaskAnalytics(request, 'xlsx')}><FileDown className="h-4 w-4" />Excel</Button></>}</div>}
      />
      <section className="grid gap-4 border border-v2-border bg-v2-surface p-4 lg:grid-cols-4">
        <label className="space-y-1 text-sm"><span>任务模板</span><select className="h-9 w-full rounded-v2-md border border-v2-border bg-v2-surface px-3" value={effectiveTemplateVersionId ?? ''} onChange={(event) => { setTemplateVersionId(Number(event.target.value)); setFieldSelections([]) }}><option value="">选择模板</option>{publishedTemplates.map((template: TaskTemplateSummary) => <option key={template.latestVersionId} value={template.latestVersionId}>{template.name}</option>)}</select></label>
        <div className="space-y-1 text-sm"><span>统计字段</span><DropdownMenu><DropdownMenuTrigger className="flex h-9 w-full items-center justify-between gap-2 rounded-v2-md border border-v2-border bg-v2-surface px-3 text-left"><span className="min-w-0 truncate">{selectedFieldSummary}</span><ChevronDown className="h-4 w-4 shrink-0 text-v2-muted" /></DropdownMenuTrigger><DropdownMenuContent className="min-w-72"><DropdownMenuGroup><DropdownMenuLabel>选择一个或多个字段</DropdownMenuLabel>{fields.data?.map((field) => <DropdownMenuCheckboxItem key={field.key} checked={fieldSelections.some((item) => item.key === field.key)} closeOnClick={false} onCheckedChange={(checked) => toggleField(field, checked)}>{field.label}</DropdownMenuCheckboxItem>)}</DropdownMenuGroup></DropdownMenuContent></DropdownMenu></div>
        <div className="space-y-1 text-sm"><span>聚合方式</span><DropdownMenu><DropdownMenuTrigger disabled={output !== 'aggregate' || selectedFields.length === 0} className="flex h-9 w-full items-center justify-between gap-2 rounded-v2-md border border-v2-border bg-v2-surface px-3 text-left disabled:cursor-not-allowed disabled:opacity-60"><span className="min-w-0 truncate">{output === 'aggregate' ? aggregationSummary : '明细无需聚合'}</span><ChevronDown className="h-4 w-4 shrink-0 text-v2-muted" /></DropdownMenuTrigger><DropdownMenuContent className="min-w-80 p-2"><DropdownMenuGroup><DropdownMenuLabel>分别配置聚合方式</DropdownMenuLabel><div className="space-y-2">{selectedFields.map(({ field, selection }) => <label key={field.key} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3"><span className="truncate">{field.label}</span><select aria-label={`${field.label}聚合方式`} className="h-8 rounded-v2-md border border-v2-border bg-v2-surface px-2" value={selection.aggregation} onClick={(event) => event.stopPropagation()} onChange={(event) => updateAggregation(field.key, event.target.value)}>{field.aggregations.map((option) => <option key={option} value={option}>{aggregationLabels[option] ?? option}</option>)}</select></label>)}</div></DropdownMenuGroup></DropdownMenuContent></DropdownMenu></div>
        <label className="space-y-1 text-sm"><span>输出类型</span><select className="h-9 w-full rounded-v2-md border border-v2-border bg-v2-surface px-3" value={output} onChange={(event) => setOutput(event.target.value)}><option value="aggregate">聚合</option><option value="detail">明细</option><option value="text_list">文字列表</option><option value="attachment_list">附件列表</option><option value="image_gallery">图片墙</option></select></label>
        <label className="space-y-1 text-sm"><span>开始日期</span><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>结束日期</span><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <label className="space-y-1 text-sm"><span>时间粒度</span><select className="h-9 w-full rounded-v2-md border border-v2-border bg-v2-surface px-3" value={grain} onChange={(event) => setGrain(event.target.value)}><option value="day">日</option><option value="week">周</option><option value="month">月</option><option value="quarter">季</option><option value="year">年</option></select></label>
        <label className="space-y-1 text-sm"><span>分组维度</span><select className="h-9 w-full rounded-v2-md border border-v2-border bg-v2-surface px-3" value={dimension} onChange={(event) => setDimension(event.target.value)}>{dimensions.data?.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        <label className="relative space-y-1 text-sm lg:col-span-3"><span>文字搜索</span><Search className="absolute left-3 top-8 h-4 w-4 text-v2-muted" /><Input className="pl-9" value={textSearch} onChange={(event) => setTextSearch(event.target.value)} placeholder="仅对文字事实筛选" /></label>
        <div className="flex items-end"><Button variant="primary" className="w-full" onClick={run} disabled={!effectiveTemplateVersionId || fieldSelections.length === 0}><BarChart3 className="h-4 w-4" />运行统计</Button></div>
      </section>
      <section className="overflow-hidden border border-v2-border bg-v2-surface">
        <div className="flex items-center justify-between border-b border-v2-border px-4 py-3"><div><h2 className="font-semibold">结果</h2><p className="text-xs text-v2-muted">{result.data ? `扫描 ${result.data.scannedFacts} 条事实，生成于 ${new Date(result.data.generatedAt).toLocaleString('zh-CN')}` : '选择条件后运行统计'}</p></div><Button size="sm" variant="ghost" onClick={() => setRequest(undefined)} disabled={!request}><Plus className="h-4 w-4 rotate-45" />清空</Button></div>
        {result.isError && <p className="p-4 text-sm text-v2-danger">{getApiErrorMessage(result.error, '统计查询失败，请检查查询条件后重试。')}</p>}
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-v2-surface-soft"><tr>{tableColumns.map((column) => <th key={column} className="whitespace-nowrap px-4 py-3 text-left font-semibold">{result.data?.columnLabels?.[column] ?? column}</th>)}</tr></thead><tbody>{result.data?.rows.map((row, index) => <tr key={index} className="border-t border-v2-border">{tableColumns.map((column) => <td key={column} className="max-w-96 whitespace-pre-wrap px-4 py-3 align-top">{formatAnalyticsValue(column, row[column])}</td>)}</tr>)}</tbody></table></div>
        {result.data?.rows.length === 0 && <p className="p-8 text-center text-sm text-v2-muted">没有符合条件的事实。</p>}
      </section>
      <section className="border border-v2-border bg-v2-surface p-4">
        <div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">我的看板</h2><p className="text-xs text-v2-muted">保存后的统计组件会按查看人的任务权限重新计算。</p></div><BarChart3 className="h-5 w-5 text-v2-primary" /></div>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">{(dashboards.data ?? []).map((dashboard) => <button key={dashboard.id} type="button" onClick={() => router.push(`/tasks/analytics/${dashboard.id}`)} className="flex items-center justify-between border border-v2-border p-3 text-left hover:border-v2-primary"><span><span className="block font-medium">{dashboard.name}</span><span className="text-xs text-v2-muted">{dashboard.scopeType === 'private' ? '私有' : dashboard.scopeType === 'group' ? '组内共享' : '租户共享'}</span></span><ExternalLink className="h-4 w-4 text-v2-muted" /></button>)}</div>
        {dashboards.data?.length === 0 && <p className="text-sm text-v2-muted">暂无看板，运行一次统计后即可保存。</p>}
      </section>
    </div>
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
