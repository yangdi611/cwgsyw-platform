'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import { FigmaTrashIcon, TaskEmpty, TaskPanel, TASK_BAR_CHART_ICON, TASK_BAR_CHART_NODE } from '@/components/task-runtime/TaskEmpty'
import {
  Button,
  ErrorState,
  Icon,
  IconButton,
  LoadingState,
  NeutralTooltip,
  PageHeader,
  Select,
} from '@/design-system/figma-neutral/components'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { DashboardSubscriptions } from '@/components/task-analytics/DashboardSubscriptions'
import { analyticsDisplayColumns, formatAnalyticsValue } from '@/components/task-analytics/analytics-display'
import { listDirectoryGroups } from '@/lib/task-plan-api'
import {
  deleteAnalyticsDashboard, deleteAnalyticsWidget, downloadAnalyticsAttachment,
  drilldownTaskAnalytics, exportTaskAnalytics, fetchAnalyticsAttachment,
  getAnalyticsDashboard, queryTaskAnalytics, shareAnalyticsDashboard,
  type AnalyticsQueryRequest, type AnalyticsWidget,
} from '@/lib/task-analytics-api'

interface Props { dashboardId: number }
interface DrilldownState { widget: AnalyticsWidget; query: AnalyticsQueryRequest; dimensions: Record<string, unknown> }

const CHART_COLORS = ['var(--cwgsyw-neutral-900)', 'var(--cwgsyw-neutral-700)', 'var(--cwgsyw-neutral-500)', 'var(--cwgsyw-neutral-400)', 'var(--cwgsyw-neutral-300)', 'var(--cwgsyw-neutral-200)']

export function TaskAnalyticsDashboard({ dashboardId }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const groupScope = useAuthStore((state) => state.groupScope)
  const sessionGroupId = useAuthStore((state) => state.groupId)
  const [selectedScope, setSelectedScope] = useState<string>()
  const [selectedGroupId, setSelectedGroupId] = useState<number>()
  const [busyWidget, setBusyWidget] = useState<number>()
  const [drilldown, setDrilldown] = useState<DrilldownState>()
  const dashboard = useQuery({
    queryKey: ['task-analytics-dashboard', dashboardId],
    queryFn: () => getAnalyticsDashboard(dashboardId),
  })
  const groups = useQuery({
    queryKey: ['task-analytics-share-groups'],
    queryFn: listDirectoryGroups,
    enabled: groupScope === 'tenant' || groupScope === 'platform',
  })
  const detail = dashboard.data
  const widgets = useMemo(() => detail?.widgets ?? [], [detail?.widgets])
  const queries = useMemo(() => widgets
    .map((widget) => ({ widget, query: readQuery(widget) }))
    .filter((item): item is { widget: AnalyticsWidget; query: AnalyticsQueryRequest } => Boolean(item.query)), [widgets])
  const shareScope = selectedScope ?? detail?.scopeType ?? 'private'
  const shareGroupId = selectedGroupId ?? detail?.ownerGroupId ?? sessionGroupId ?? undefined
  const canShareTenant = groupScope === 'tenant' || groupScope === 'platform'

  const deleteDashboard = async () => {
    if (!detail?.canManage) return
    await deleteAnalyticsDashboard(dashboardId)
    router.replace('/tasks/analytics')
  }

  const share = async () => {
    if (!detail?.canManage || (shareScope === 'group' && !shareGroupId)) return
    await shareAnalyticsDashboard(dashboardId, {
      scopeType: shareScope,
      ownerGroupId: shareScope === 'group' ? shareGroupId : undefined,
    })
    setSelectedScope(undefined)
    setSelectedGroupId(undefined)
    await queryClient.invalidateQueries({ queryKey: ['task-analytics-dashboard', dashboardId] })
    await queryClient.invalidateQueries({ queryKey: ['task-analytics-dashboards'] })
  }

  const removeWidget = async (widget: AnalyticsWidget) => {
    if (!detail?.canManage) return
    setBusyWidget(widget.id)
    try {
      await deleteAnalyticsWidget(widget.id)
      await queryClient.invalidateQueries({ queryKey: ['task-analytics-dashboard', dashboardId] })
    } finally {
      setBusyWidget(undefined)
    }
  }

  if (dashboard.isLoading) {
    return (
      <div className="cwgsyw-tasks-page">
        <PageHeader showEyebrow={false} showBreadcrumb={false} showSubtitle={false} title="统计看板" />
        <LoadingState label="正在加载统计看板…" />
      </div>
    )
  }

  if (dashboard.isError || !detail) {
    return (
      <div className="cwgsyw-tasks-page">
        <PageHeader showEyebrow={false} showBreadcrumb={false} showSubtitle={false} title="统计看板" />
        <ErrorState
          title="统计看板加载失败"
          description="请检查访问权限或稍后重试。"
          retry={<Button type="button" variant="secondary" onClick={() => void dashboard.refetch()}>重试</Button>}
        />
      </div>
    )
  }

  return (
    <div className="cwgsyw-tasks-page">
      <PageHeader
        showEyebrow={false}
        showBreadcrumb={false}
        showSubtitle={false}
        title={detail?.name ?? '统计看板'}
        actions={detail?.canManage ? <div className="cwgsyw-inline-controls">
          <Select
            aria-label="共享范围"
            size="sm"
            overlay
            value={shareScope}
            options={[
              { value: 'private', label: '私有' },
              { value: 'group', label: '组内共享' },
              ...(canShareTenant ? [{ value: 'tenant', label: '租户共享' }] : []),
            ]}
            onChange={setSelectedScope}
          />
          {shareScope === 'group' && (
            <Select
              aria-label="共享用户组"
              size="sm"
              placeholder="选择用户组"
              disabled={groupScope === 'group'}
              value={shareGroupId == null ? '' : String(shareGroupId)}
              options={[
                { value: '', label: '选择用户组' },
                ...(groupScope === 'group' && sessionGroupId ? [{ value: String(sessionGroupId), label: '当前用户组' }] : []),
                ...(groups.data ?? []).map((group) => ({ value: String(group.id), label: group.name })),
              ]}
              onChange={(value) => setSelectedGroupId(value ? Number(value) : undefined)}
            />
          )}
          <Button size="sm" onClick={() => void share()} disabled={shareScope === 'group' && !shareGroupId}>保存共享</Button>
          <NeutralTooltip content="删除看板" className="cwgsyw-tooltip--pill" followCursor>
            <IconButton
              type="button"
              size="sm"
              variant="ghost"
              aria-label="删除看板"
              className="cwgsyw-tasks-icon-action cwgsyw-tasks-icon-action--danger"
              icon={<FigmaTrashIcon />}
              onClick={() => void deleteDashboard()}
            />
          </NeutralTooltip>
        </div> : undefined}
      />
      <p className="cwgsyw-tasks-cell-meta"><Icon name="eye" size="sm" /> 共享范围：{scopeLabel(detail?.scopeType)}</p>
      {widgets.length === 0 ? (
        <TaskPanel title="看板组件">
          <TaskEmpty
            iconSrc={TASK_BAR_CHART_ICON}
            figmaNode={TASK_BAR_CHART_NODE}
            title="看板暂无组件"
            description="返回任务统计运行查询后保存组件。"
            action={<Button type="button" size="sm" variant="secondary" leadingIcon="chevron-right" onClick={() => router.push('/tasks/analytics')}>返回统计工作台</Button>}
          />
        </TaskPanel>
      ) : null}
      <div className="cwgsyw-tasks-dashboard-grid">{queries.map(({ widget, query }) => <AnalyticsWidgetCard
        key={widget.id}
        widget={widget}
        query={query}
        canExport={hasPermission('task_analytics', 'export')}
        canManage={Boolean(detail?.canManage)}
        busy={busyWidget === widget.id}
        onDelete={() => void removeWidget(widget)}
        onDrilldown={(dimensions) => setDrilldown({ widget, query, dimensions })}
      />)}</div>
      {queries.length < widgets.length ? <p className="cwgsyw-tasks-cell-meta">部分组件配置无法读取，已隐藏以避免执行未校验的统计请求。</p> : null}
      <DashboardSubscriptions dashboardId={dashboardId} canManage={Boolean(detail?.canManage)} />
      {drilldown && <DrilldownPanel state={drilldown} onClose={() => setDrilldown(undefined)} />}
    </div>
  )
}

function AnalyticsWidgetCard({ widget, query, canExport, canManage, busy, onDelete, onDrilldown }: {
  widget: AnalyticsWidget
  query: AnalyticsQueryRequest
  canExport: boolean
  canManage: boolean
  busy: boolean
  onDelete: () => void
  onDrilldown: (dimensions: Record<string, unknown>) => void
}) {
  const result = useQuery({ queryKey: ['task-analytics-widget', widget.id, query], queryFn: () => queryTaskAnalytics(query), staleTime: 30_000 })
  const rows = result.data?.rows ?? []
  const columns = result.data?.columns ?? []
  const columnLabels = result.data?.columnLabels ?? {}
  return <TaskPanel
    title={widget.title}
    description={result.data ? `扫描 ${result.data.scannedFacts} 条事实 · ${new Date(result.data.generatedAt).toLocaleString('zh-CN')}` : '加载中'}
    action={<div className="cwgsyw-inline-controls">
      {canExport ? <><Button type="button" size="sm" variant="secondary" aria-label="导出 CSV" onClick={() => void exportTaskAnalytics(query, 'csv')}>CSV</Button><Button type="button" size="sm" variant="secondary" onClick={() => void exportTaskAnalytics(query, 'xlsx')}>Excel</Button></> : null}
      {canManage ? (
        <NeutralTooltip content="删除组件" className="cwgsyw-tooltip--pill" followCursor>
          <IconButton
            type="button"
            size="sm"
            variant="ghost"
            aria-label="删除组件"
            className="cwgsyw-tasks-icon-action cwgsyw-tasks-icon-action--danger"
            icon={<FigmaTrashIcon />}
            disabled={busy}
            onClick={onDelete}
          />
        </NeutralTooltip>
      ) : null}
    </div>}
  >
    <div className="cwgsyw-tasks-widget">
      {result.isError && <ErrorState title="组件查询失败" description="请检查模板版本、统计口径或权限。" retry={<Button type="button" variant="secondary" onClick={() => void result.refetch()}>重试</Button>} />}
      {result.isLoading && <div className="min-h-48"><LoadingState label="正在计算组件…" /></div>}
      {!result.isLoading && !result.isError && <WidgetResult type={widget.widgetType} rows={rows} columns={columns} columnLabels={columnLabels} query={query} onDrilldown={onDrilldown} />}
    </div>
  </TaskPanel>
}

function WidgetResult({ type, rows, columns, columnLabels, query, onDrilldown }: {
  type: string
  rows: Array<Record<string, unknown>>
  columns: string[]
  columnLabels: Record<string, string>
  query: AnalyticsQueryRequest
  onDrilldown: (dimensions: Record<string, unknown>) => void
}) {
  if (rows.length === 0) return <EmptyResult />
  const dimensionColumns = query.dimensions.filter((dimension) => columns.includes(dimension))
  const metricColumns = columns.filter((column) => !dimensionColumns.includes(column))
  const displayColumns = analyticsDisplayColumns(columns)
  const metric = metricColumns[0]
  if (type === 'kpi') return <Button type="button" variant="ghost" className="cwgsyw-dashboard-tile border-[var(--cwgsyw-border-default)] hover:bg-[var(--cwgsyw-bg-surface-hover)]" onClick={() => onDrilldown({})}><span className="cwgsyw-type-title-sm">{formatValue(metric ? rows[0]?.[metric] : undefined)}</span><span className="cwgsyw-type-label-xs">点击查看来源任务</span></Button>
  if ((type === 'line_chart' || type === 'bar_chart') && dimensionColumns[0] && metric) {
    const dimension = dimensionColumns[0]
    const chartData = rows.map((row) => ({ ...row, ...Object.fromEntries(metricColumns.map((column) => [column, numberValue(row[column])])) }))
    const open = (event: unknown) => { const payload = chartEventPayload(event); if (payload) onDrilldown(pickDimensions(payload, dimensionColumns)) }
    return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%">{type === 'line_chart' ? <LineChart data={chartData} onClick={open}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={dimension} /><YAxis /><Tooltip /><Legend />{metricColumns.map((column, index) => <Line key={column} type="monotone" dataKey={column} name={columnLabels[column] ?? column} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2} activeDot={{ r: 5 }} />)}</LineChart> : <BarChart data={chartData} onClick={open}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={dimension} /><YAxis /><Tooltip /><Legend />{metricColumns.map((column, index) => <Bar key={column} dataKey={column} name={columnLabels[column] ?? column} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</BarChart>}</ResponsiveContainer></div>
  }
  if (type === 'pie_chart' && dimensionColumns[0] && metric) {
    const dimension = dimensionColumns[0]
    const data = rows.map((row) => ({ name: String(row[dimension] ?? '未分类'), value: numberValue(row[metric]), dimensions: pickDimensions(row, dimensionColumns) }))
    return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip /><Legend /><Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88} onClick={(entry: unknown) => { const payload = chartEventPayload(entry); if (payload?.dimensions && typeof payload.dimensions === 'object') onDrilldown(payload.dimensions as Record<string, unknown>) }}>{data.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie></PieChart></ResponsiveContainer></div>
  }
  if (type === 'image_gallery') return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{rows.slice(0, 18).map((row) => <AttachmentImage key={String(row.attachmentId)} row={row} />)}</div>
  if (type === 'attachment_list') return <div className="divide-y divide-[var(--cwgsyw-border-subtle)] ">{rows.slice(0, 50).map((row) => <AttachmentRow key={String(row.attachmentId)} row={row} />)}</div>
  if (type === 'text_list') return <div className="cwgsyw-stack-list">{rows.slice(0, 50).map((row, index) => <Button type="button" key={index} variant="ghost" className="cwgsyw-stack-list__item" onClick={() => onDrilldown(pickDimensions(row, dimensionColumns))}>{displayColumns.filter((column) => !TRACE_COLUMNS.has(column)).map((column) => <p key={column} className="cwgsyw-type-body-sm"><span className="cwgsyw-type-label-xs">{columnLabels[column] ?? column}</span> {formatAnalyticsValue(column, row[column])}</p>)}</Button>)}</div>
  return <div className="cwgsyw-cmdb-table"><table className="cwgsyw-table"><thead><tr className="cwgsyw-tr">{displayColumns.map((column) => <th key={column} className="cwgsyw-th">{columnLabels[column] ?? column}</th>)}</tr></thead><tbody>{rows.slice(0, 50).map((row, index) => <tr key={index} className="cwgsyw-tr" onClick={() => onDrilldown(pickDimensions(row, dimensionColumns))}>{displayColumns.map((column) => <td key={column} className="cwgsyw-td">{formatAnalyticsValue(column, row[column])}</td>)}</tr>)}</tbody></table></div>
}

function DrilldownPanel({ state, onClose }: { state: DrilldownState; onClose: () => void }) {
  const result = useQuery({
    queryKey: ['task-analytics-drilldown', state.widget.id, state.dimensions],
    queryFn: () => drilldownTaskAnalytics({ query: state.query, dimensions: state.dimensions, page: 1, size: 100 }),
  })
  const records = result.data?.records ?? []
  return <TaskPanel title={`${state.widget.title} · 来源明细`} description={`${dimensionSummary(state.dimensions, result.data?.columnLabels)}${result.data ? ` · 共 ${result.data.total} 条` : ''}`} action={<IconButton size="sm" variant="ghost" icon="close" aria-label="关闭下钻" onClick={onClose} />}>
    {result.isLoading && <div className="min-h-48"><LoadingState label="正在加载来源任务…" /></div>}
    {result.isError && <ErrorState title="来源任务加载失败" description="请检查权限或查询口径。" retry={<Button type="button" variant="secondary" onClick={() => void result.refetch()}>重试</Button>} />}
    <div className="divide-y divide-[var(--cwgsyw-border-subtle)] ">{records.map((record) => <div key={`${record.taskId}:${record.submissionId}`} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"><div><Link className="font-medium " href={`/tasks/${record.taskId}`}>{formatValue(record.taskTitle)}</Link><p className="mt-1 text-xs cwgsyw-type-label-xs">任务 #{formatValue(record.taskId)} · 提交 #{formatValue(record.submissionId)} v{formatValue(record.submissionVersion)} · 业务日期 {formatValue(record.businessDate)}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">{Object.entries(record).filter(([key]) => !TRACE_COLUMNS.has(key)).map(([key, value]) => <span key={key}><strong className="mr-1 text-xs cwgsyw-type-label-xs">{result.data?.columnLabels?.[key] ?? key}</strong>{formatValue(value)}</span>)}</div></div><Link href={`/tasks/${record.taskId}`} className="cwgsyw-btn cwgsyw-btn--sm cwgsyw-btn--outline">查看提交<Icon name="chevron-right" size="sm" /></Link></div>)}</div>
    {!result.isLoading && records.length === 0 ? <p className="cwgsyw-tasks-cell-meta">该数据点没有当前用户可查看的来源任务。</p> : null}
  </TaskPanel>
}

function AttachmentRow({ row }: { row: Record<string, unknown> }) {
  const path = String(row.downloadPath ?? '')
  const fileName = String(row.fileName ?? '附件')
  return <div className="cwgsyw-tasks-pick"><span className="cwgsyw-tasks-cell-title">{fileName}</span><span className="cwgsyw-tasks-cell-meta">{formatBytes(row.sizeBytes)} · 任务 #{formatValue(row.taskId)}</span><Button type="button" size="sm" variant="secondary" aria-label="下载附件" disabled={!path} onClick={() => void downloadAnalyticsAttachment(path, fileName)}>下载</Button></div>
}

function AttachmentImage({ row }: { row: Record<string, unknown> }) {
  const path = String(row.downloadPath ?? '')
  const fileName = String(row.fileName ?? '图片')
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!path) return
    let active = true
    let objectUrl: string | undefined
    void fetchAnalyticsAttachment(path).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [path])
  return <Button type="button" variant="outline" className="cwgsyw-dashboard-tile" onClick={() => void downloadAnalyticsAttachment(path, fileName)}>{url ? <span className="relative block aspect-square w-full"><Image src={url} alt={fileName} fill unoptimized className="object-cover" /></span> : <span className="cwgsyw-tasks-cell-meta">加载中</span>}<span className="cwgsyw-tasks-cell-meta">{fileName}</span></Button>
}

const TRACE_COLUMNS = new Set(['taskId', 'taskTitle', 'submissionId', 'submissionVersion', 'templateVersionId', 'businessDate', 'submittedAt', 'assigneeId', 'groupId', 'fieldFactIds'])
function readQuery(widget: AnalyticsWidget): AnalyticsQueryRequest | undefined { const query = widget.dataSourceConfig.query; return query && typeof query === 'object' ? query as AnalyticsQueryRequest : undefined }
function chartEventPayload(event: unknown): Record<string, unknown> | undefined {
  if (!event || typeof event !== 'object') return undefined
  const record = event as Record<string, unknown>
  const activePayload = record.activePayload
  if (Array.isArray(activePayload) && activePayload[0] && typeof activePayload[0] === 'object') {
    const payload = (activePayload[0] as Record<string, unknown>).payload
    if (payload && typeof payload === 'object') return payload as Record<string, unknown>
  }
  const nested = record.payload
  return nested && typeof nested === 'object' ? nested as Record<string, unknown> : record
}
function pickDimensions(row: Record<string, unknown>, dimensions: string[]) { return Object.fromEntries(dimensions.filter((key) => row[key] != null).map((key) => [key, row[key]])) }
function numberValue(value: unknown) { const result = Number(value); return Number.isFinite(result) ? result : 0 }
function formatValue(value: unknown): string { if (Array.isArray(value)) return value.map(formatValue).join('、'); if (value && typeof value === 'object') return JSON.stringify(value); return value == null ? '-' : String(value) }
function formatBytes(value: unknown) { const bytes = numberValue(value); if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function scopeLabel(scope?: string) { return scope === 'tenant' ? '租户共享' : scope === 'group' ? '组内共享' : '私有' }
function dimensionSummary(dimensions: Record<string, unknown>, labels?: Record<string, string>) { const entries = Object.entries(dimensions); return entries.length ? entries.map(([key, value]) => `${labels?.[key] ?? key}=${formatValue(value)}`).join(' · ') : '全部数据' }
function EmptyResult() { return <p className="cwgsyw-tasks-cell-meta">暂无符合条件的数据。</p> }
