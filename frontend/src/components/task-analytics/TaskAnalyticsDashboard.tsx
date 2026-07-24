'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  BarChart3, ChevronRight, Download, Eye, FileDown, FileText, ImageIcon,
  List, Save, Trash2, X,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/v2/Button'
import { PageHeader } from '@/components/shared'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { DashboardSubscriptions } from '@/components/task-analytics/DashboardSubscriptions'
import { listDirectoryGroups } from '@/lib/task-plan-api'
import {
  deleteAnalyticsDashboard, deleteAnalyticsWidget, downloadAnalyticsAttachment,
  drilldownTaskAnalytics, exportTaskAnalytics, fetchAnalyticsAttachment,
  getAnalyticsDashboard, queryTaskAnalytics, shareAnalyticsDashboard,
  type AnalyticsQueryRequest, type AnalyticsWidget,
} from '@/lib/task-analytics-api'

interface Props { dashboardId: number }
interface DrilldownState { widget: AnalyticsWidget; query: AnalyticsQueryRequest; dimensions: Record<string, unknown> }

const CHART_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="统一任务平台 / 任务统计"
        title={detail?.name ?? '统计看板'}
        subtitle={detail?.description || '按当前查看人的任务权限实时计算组件数据。'}
        actions={detail?.canManage ? <div className="flex flex-wrap items-center gap-2">
          <select aria-label="共享范围" className="h-9 rounded-v2-sm border border-v2-border bg-v2-surface px-2 text-sm" value={shareScope} onChange={(event) => setSelectedScope(event.target.value)}>
            <option value="private">私有</option>
            <option value="group">组内共享</option>
            {canShareTenant && <option value="tenant">租户共享</option>}
          </select>
          {shareScope === 'group' && <select aria-label="共享用户组" className="h-9 rounded-v2-sm border border-v2-border bg-v2-surface px-2 text-sm" value={shareGroupId ?? ''} disabled={groupScope === 'group'} onChange={(event) => setSelectedGroupId(Number(event.target.value))}>
            <option value="">选择用户组</option>
            {groupScope === 'group' && sessionGroupId && <option value={sessionGroupId}>当前用户组</option>}
            {(groups.data ?? []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>}
          <Button size="sm" onClick={() => void share()} disabled={shareScope === 'group' && !shareGroupId}><Save className="h-4 w-4" />保存共享</Button>
          <Button size="sm" variant="danger" onClick={() => void deleteDashboard()}><Trash2 className="h-4 w-4" />删除看板</Button>
        </div> : undefined}
      />
      <section className="flex items-center gap-2 border border-v2-border bg-v2-surface px-4 py-3 text-sm">
        <Eye className="h-4 w-4 text-v2-primary" />
        <span>共享范围：{scopeLabel(detail?.scopeType)}</span>
        <span className="text-v2-muted">所有组件按当前查看人的租户、组、参与关系和字段权限重新查询。</span>
      </section>
      {dashboard.isError && <section className="border border-v2-danger bg-v2-danger-soft p-4 text-sm text-v2-danger">无法读取看板，请检查访问权限或稍后重试。</section>}
      {widgets.length === 0 && !dashboard.isLoading && <section className="border border-dashed border-v2-border bg-v2-surface p-12 text-center">
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-v2-muted" />
        <p className="font-medium">看板暂无组件</p>
        <p className="mt-1 text-sm text-v2-muted">返回任务统计运行查询后保存组件。</p>
        <Button className="mt-4" onClick={() => router.push('/tasks/analytics')}><ChevronRight className="h-4 w-4" />返回统计工作台</Button>
      </section>}
      <div className="grid gap-4 lg:grid-cols-2">{queries.map(({ widget, query }) => <AnalyticsWidgetCard
        key={widget.id}
        widget={widget}
        query={query}
        canExport={hasPermission('task_analytics', 'export')}
        canManage={Boolean(detail?.canManage)}
        busy={busyWidget === widget.id}
        onDelete={() => void removeWidget(widget)}
        onDrilldown={(dimensions) => setDrilldown({ widget, query, dimensions })}
      />)}</div>
      {queries.length < widgets.length && <p className="text-sm text-v2-danger">部分组件配置无法读取，已隐藏以避免执行未校验的统计请求。</p>}
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
  return <article className="overflow-hidden border border-v2-border bg-v2-surface">
    <header className="flex items-center justify-between border-b border-v2-border px-4 py-3">
      <div className="flex items-center gap-2"><WidgetIcon type={widget.widgetType} /><div><h2 className="font-semibold">{widget.title}</h2><p className="text-xs text-v2-muted">{result.data ? `扫描 ${result.data.scannedFacts} 条事实 · ${new Date(result.data.generatedAt).toLocaleString('zh-CN')}` : '加载中'}</p></div></div>
      <div className="flex gap-1">{canExport && <><Button size="sm" variant="ghost" title="导出 CSV" onClick={() => void exportTaskAnalytics(query, 'csv')}><Download className="h-4 w-4" /></Button><Button size="sm" variant="ghost" title="导出 Excel" onClick={() => void exportTaskAnalytics(query, 'xlsx')}><FileDown className="h-4 w-4" /></Button></>}{canManage && <Button size="sm" variant="ghost" title="删除组件" disabled={busy} onClick={onDelete}><Trash2 className="h-4 w-4 text-v2-danger" /></Button>}</div>
    </header>
    <div className="min-h-48 overflow-x-auto p-4">
      {result.isError && <p className="text-sm text-v2-danger">组件查询失败，请检查模板版本、口径或权限。</p>}
      {result.isLoading && <p className="text-sm text-v2-muted">正在计算...</p>}
      {!result.isLoading && !result.isError && <WidgetResult type={widget.widgetType} rows={rows} columns={columns} columnLabels={columnLabels} query={query} onDrilldown={onDrilldown} />}
    </div>
  </article>
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
  const metric = metricColumns.at(-1)
  if (type === 'kpi') return <button type="button" className="w-full text-left" onClick={() => onDrilldown({})}><span className="block text-3xl font-semibold text-v2-primary">{formatValue(metric ? rows[0]?.[metric] : undefined)}</span><span className="mt-2 block text-xs text-v2-muted">点击查看来源任务</span></button>
  if ((type === 'line_chart' || type === 'bar_chart') && dimensionColumns[0] && metric) {
    const dimension = dimensionColumns[0]
    const chartData = rows.map((row) => ({ ...row, [metric]: numberValue(row[metric]) }))
    const open = (event: unknown) => { const payload = chartEventPayload(event); if (payload) onDrilldown(pickDimensions(payload, dimensionColumns)) }
    return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%">{type === 'line_chart' ? <LineChart data={chartData} onClick={open}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={dimension} /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey={metric} name={columnLabels[metric] ?? metric} stroke={CHART_COLORS[0]} strokeWidth={2} activeDot={{ r: 5 }} /></LineChart> : <BarChart data={chartData} onClick={open}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={dimension} /><YAxis /><Tooltip /><Legend /><Bar dataKey={metric} name={columnLabels[metric] ?? metric} fill={CHART_COLORS[0]} /></BarChart>}</ResponsiveContainer></div>
  }
  if (type === 'pie_chart' && dimensionColumns[0] && metric) {
    const dimension = dimensionColumns[0]
    const data = rows.map((row) => ({ name: String(row[dimension] ?? '未分类'), value: numberValue(row[metric]), dimensions: pickDimensions(row, dimensionColumns) }))
    return <div className="h-72 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip /><Legend /><Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88} onClick={(entry: unknown) => { const payload = chartEventPayload(entry); if (payload?.dimensions && typeof payload.dimensions === 'object') onDrilldown(payload.dimensions as Record<string, unknown>) }}>{data.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie></PieChart></ResponsiveContainer></div>
  }
  if (type === 'image_gallery') return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{rows.slice(0, 18).map((row) => <AttachmentImage key={String(row.attachmentId)} row={row} />)}</div>
  if (type === 'attachment_list') return <div className="divide-y divide-v2-border">{rows.slice(0, 50).map((row) => <AttachmentRow key={String(row.attachmentId)} row={row} />)}</div>
  if (type === 'text_list') return <div className="divide-y divide-v2-border">{rows.slice(0, 50).map((row, index) => <button type="button" key={index} className="block w-full px-1 py-3 text-left hover:bg-v2-surface-hover" onClick={() => onDrilldown(pickDimensions(row, dimensionColumns))}>{columns.filter((column) => !TRACE_COLUMNS.has(column)).map((column) => <p key={column} className="whitespace-pre-wrap text-sm"><span className="mr-2 text-xs font-semibold text-v2-muted">{columnLabels[column] ?? column}</span>{formatValue(row[column])}</p>)}</button>)}</div>
  return <table className="min-w-full text-sm"><thead><tr>{columns.map((column) => <th key={column} className="border-b border-v2-border px-2 py-2 text-left text-xs font-semibold">{columnLabels[column] ?? column}</th>)}</tr></thead><tbody>{rows.slice(0, 50).map((row, index) => <tr key={index} className="cursor-pointer hover:bg-v2-surface-hover" onClick={() => onDrilldown(pickDimensions(row, dimensionColumns))}>{columns.map((column) => <td key={column} className="border-b border-v2-border px-2 py-2">{formatValue(row[column])}</td>)}</tr>)}</tbody></table>
}

function DrilldownPanel({ state, onClose }: { state: DrilldownState; onClose: () => void }) {
  const result = useQuery({
    queryKey: ['task-analytics-drilldown', state.widget.id, state.dimensions],
    queryFn: () => drilldownTaskAnalytics({ query: state.query, dimensions: state.dimensions, page: 1, size: 100 }),
  })
  const records = result.data?.records ?? []
  return <section className="border border-v2-border bg-v2-surface">
    <header className="flex items-center justify-between border-b border-v2-border px-4 py-3"><div><h2 className="font-semibold">{state.widget.title} · 来源明细</h2><p className="text-xs text-v2-muted">{dimensionSummary(state.dimensions, result.data?.columnLabels)}{result.data ? ` · 共 ${result.data.total} 条` : ''}</p></div><Button size="sm" variant="ghost" title="关闭下钻" onClick={onClose}><X className="h-4 w-4" /></Button></header>
    {result.isLoading && <p className="p-4 text-sm text-v2-muted">正在加载来源任务...</p>}
    {result.isError && <p className="p-4 text-sm text-v2-danger">无法加载下钻明细，请检查权限或查询口径。</p>}
    <div className="divide-y divide-v2-border">{records.map((record) => <div key={`${record.taskId}:${record.submissionId}`} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"><div><Link className="font-medium text-v2-primary hover:underline" href={`/tasks/${record.taskId}`}>{formatValue(record.taskTitle)}</Link><p className="mt-1 text-xs text-v2-muted">任务 #{formatValue(record.taskId)} · 提交 #{formatValue(record.submissionId)} v{formatValue(record.submissionVersion)} · 业务日期 {formatValue(record.businessDate)}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">{Object.entries(record).filter(([key]) => !TRACE_COLUMNS.has(key)).map(([key, value]) => <span key={key}><strong className="mr-1 text-xs text-v2-muted">{result.data?.columnLabels?.[key] ?? key}</strong>{formatValue(value)}</span>)}</div></div><Link href={`/tasks/${record.taskId}`} className="inline-flex h-9 items-center gap-1 border border-v2-border px-3 text-sm hover:border-v2-primary">查看提交<ChevronRight className="h-4 w-4" /></Link></div>)}</div>
    {!result.isLoading && records.length === 0 && <p className="p-8 text-center text-sm text-v2-muted">该数据点没有当前用户可查看的来源任务。</p>}
  </section>
}

function AttachmentRow({ row }: { row: Record<string, unknown> }) {
  const path = String(row.downloadPath ?? '')
  const fileName = String(row.fileName ?? '附件')
  return <div className="flex items-center gap-3 py-3"><FileText className="h-5 w-5 text-v2-muted" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{fileName}</p><p className="text-xs text-v2-muted">{formatBytes(row.sizeBytes)} · 任务 #{formatValue(row.taskId)}</p></div><Button size="sm" variant="ghost" title="下载附件" disabled={!path} onClick={() => void downloadAnalyticsAttachment(path, fileName)}><Download className="h-4 w-4" /></Button></div>
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
  return <button type="button" className="overflow-hidden border border-v2-border text-left" onClick={() => void downloadAnalyticsAttachment(path, fileName)}>{url ? <span className="relative block aspect-square w-full"><Image src={url} alt={fileName} fill unoptimized className="object-cover" /></span> : <span className="flex aspect-square items-center justify-center bg-v2-surface-soft"><ImageIcon className="h-8 w-8 text-v2-muted" /></span>}<span className="block truncate px-2 py-2 text-xs">{fileName}</span></button>
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
function WidgetIcon({ type }: { type: string }) { return type === 'image_gallery' ? <ImageIcon className="h-4 w-4 text-v2-primary" /> : type === 'text_list' || type === 'attachment_list' ? <List className="h-4 w-4 text-v2-primary" /> : <BarChart3 className="h-4 w-4 text-v2-primary" /> }
function EmptyResult() { return <p className="text-sm text-v2-muted">暂无符合条件的数据。</p> }
