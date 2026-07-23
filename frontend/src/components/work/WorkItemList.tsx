'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, ClipboardCheck, Search } from 'lucide-react'
import { ApprovalTaskDrawer } from '@/components/work/ApprovalTaskDrawer'
import { DataTable, ErrorState, FilterBar, PageHeader, Pagination, type ColumnDef } from '@/components/shared'
import { Input } from '@/components/v2/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { usePermission } from '@/hooks/usePermission'
import { listDirectoryGroups, listPublishedTemplates } from '@/lib/task-plan-api'
import { getWorkItemCounts, listWorkItems, type WorkItem, type WorkItemTab } from '@/lib/work-item-api'

const TABS: Array<{ key: WorkItemTab; label: string }> = [
  { key: 'execute', label: '待执行' },
  { key: 'approve', label: '待审批' },
  { key: 'initiated', label: '我发起的' },
  { key: 'copied', label: '抄送我的' },
  { key: 'completed', label: '已完成' },
]

export function WorkItemList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission } = usePermission()
  const tab = parseTab(searchParams.get('tab'))
  const approvalTaskId = searchParams.get('approvalTaskId') ?? undefined
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState(() => searchParams.get('keyword') ?? '')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [overdue, setOverdue] = useState('all')
  const [templateId, setTemplateId] = useState('all')
  const [groupId, setGroupId] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const pageSize = 20

  const counts = useQuery({ queryKey: ['work-item-counts'], queryFn: getWorkItemCounts })
  const templates = useQuery({ queryKey: ['work-item-template-options'], queryFn: listPublishedTemplates })
  const groups = useQuery({ queryKey: ['work-item-group-options'], queryFn: listDirectoryGroups, enabled: hasPermission('group', 'read') })
  const items = useQuery({
    queryKey: ['work-items', { tab, keyword, status, priority, overdue, templateId, groupId, from, to, page }],
    queryFn: () => listWorkItems({
      tab,
      keyword: keyword.trim() || undefined,
      status: status === 'all' ? undefined : status,
      priority: priority === 'all' ? undefined : priority,
      overdue: overdue === 'all' ? undefined : overdue === 'yes',
      templateId: templateId === 'all' ? undefined : Number(templateId),
      groupId: groupId === 'all' ? undefined : Number(groupId),
      from: from || undefined,
      to: to || undefined,
      page,
      size: pageSize,
    }),
  })

  const setQuery = (nextTab: WorkItemTab, nextApprovalTaskId?: string) => {
    const next = new URLSearchParams(searchParams.toString())
    next.set('tab', nextTab)
    if (nextApprovalTaskId) next.set('approvalTaskId', nextApprovalTaskId)
    else next.delete('approvalTaskId')
    window.history.pushState(null, '', `/work?${next.toString()}`)
  }
  const resetPage = () => setPage(1)
  const columns: ColumnDef<WorkItem>[] = [
    { key: 'title', title: '工作项', render: (item) => <div><div className="flex items-center gap-2"><p className="font-semibold text-v2-fg">{item.title}</p>{item.actionRequired && <StatusBadge status="warn">需要处理</StatusBadge>}</div><p className="mt-1 text-xs text-v2-muted">{item.subtitle}</p></div> },
    { key: 'status', title: '状态', render: (item) => <div className="flex flex-wrap gap-1"><StatusBadge status={item.overdue ? 'danger' : item.status === 'completed' ? 'ok' : item.status === 'changes_requested' ? 'warn' : 'neutral'}>{statusLabel(item.status)}</StatusBadge>{item.nodeName && <StatusBadge status="neutral">{item.nodeName}</StatusBadge>}</div> },
    { key: 'date', title: '业务日期', render: (item) => <span className="text-v2-muted">{item.businessDate ?? '-'}</span> },
    { key: 'dueAt', title: '截止时间', render: (item) => <span className={item.overdue ? 'font-semibold text-v2-danger' : 'text-v2-muted'}>{item.dueAt ? new Date(item.dueAt).toLocaleString('zh-CN') : '-'}</span> },
    { key: 'priority', title: '优先级', render: (item) => <StatusBadge status={item.priority === 'critical' ? 'danger' : item.priority === 'high' ? 'warn' : 'neutral'}>{priorityLabel(item.priority)}</StatusBadge> },
  ]

  return <div className="space-y-6">
    <PageHeader eyebrow="统一任务平台" title="我的工作" subtitle="待执行、待审批、我发起、抄送和已完成事项统一在这里处理。" />
    <div className="flex overflow-x-auto border-b border-v2-border" role="tablist" aria-label="工作项分类">
      {TABS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => { resetPage(); setQuery(item.key) }} className={`flex min-w-28 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${tab === item.key ? 'border-v2-primary text-v2-primary' : 'border-transparent text-v2-muted hover:text-v2-fg'}`}><span>{item.label}</span><span className={`min-w-6 rounded-full px-1.5 py-0.5 font-v2-mono text-[11px] ${tab === item.key ? 'bg-v2-primary-soft' : 'bg-v2-surface-soft'}`}>{counts.data?.[item.key] ?? 0}</span></button>)}
    </div>
    <FilterBar>
      <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-v2-muted" /><Input className="pl-9" value={keyword} onChange={(event) => { setKeyword(event.target.value); resetPage() }} placeholder="搜索任务、审批节点或说明" /></div>
      <Select value={status} onValueChange={(value) => { setStatus(value ?? 'all'); resetPage() }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="not_started">未开始</SelectItem><SelectItem value="in_progress">进行中</SelectItem><SelectItem value="changes_requested">待修改</SelectItem><SelectItem value="in_review">审批中</SelectItem><SelectItem value="completed">已完成</SelectItem><SelectItem value="cancelled">已取消</SelectItem></SelectContent></Select>
      <Select value={priority} onValueChange={(value) => { setPriority(value ?? 'all'); resetPage() }}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部优先级</SelectItem><SelectItem value="low">低</SelectItem><SelectItem value="normal">普通</SelectItem><SelectItem value="high">高</SelectItem><SelectItem value="critical">紧急</SelectItem></SelectContent></Select>
      <Select value={overdue} onValueChange={(value) => { setOverdue(value ?? 'all'); resetPage() }}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部时效</SelectItem><SelectItem value="yes">已逾期</SelectItem><SelectItem value="no">未逾期</SelectItem></SelectContent></Select>
      <Select value={templateId} onValueChange={(value) => { setTemplateId(value ?? 'all'); resetPage() }}><SelectTrigger className="w-44"><SelectValue placeholder="全部模板" /></SelectTrigger><SelectContent><SelectItem value="all">全部模板</SelectItem>{templates.data?.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.name}</SelectItem>)}</SelectContent></Select>
      {hasPermission('group', 'read') && <Select value={groupId} onValueChange={(value) => { setGroupId(value ?? 'all'); resetPage() }}><SelectTrigger className="w-40"><SelectValue placeholder="全部组" /></SelectTrigger><SelectContent><SelectItem value="all">全部组</SelectItem>{groups.data?.map((group) => <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>)}</SelectContent></Select>}
      <Input className="w-36" type="date" value={from} aria-label="开始日期" onChange={(event) => { setFrom(event.target.value); resetPage() }} />
      <Input className="w-36" type="date" value={to} aria-label="结束日期" onChange={(event) => { setTo(event.target.value); resetPage() }} />
    </FilterBar>
    {items.isError ? <div className="rounded-v2-md border border-v2-border bg-v2-surface"><ErrorState title="工作项加载失败" onRetry={() => items.refetch()} /></div> : <DataTable data={items.data?.records ?? []} columns={columns} rowKey={(item) => `${item.itemType}:${item.itemId}`} loading={items.isLoading} onRowClick={(item) => item.itemType === 'approval' && item.approvalTaskId ? setQuery('approve', item.approvalTaskId) : router.push(item.href)} empty={{ title: emptyTitle(tab), description: emptyDescription(tab), action: tab === 'completed' ? <CheckCircle2 className="h-5 w-5" /> : tab === 'approve' ? <AlertCircle className="h-5 w-5" /> : <ClipboardCheck className="h-5 w-5" /> }} />}
    <Pagination page={page} pageSize={pageSize} total={items.data?.total ?? 0} onPageChange={setPage} />
    <ApprovalTaskDrawer key={approvalTaskId ?? 'closed'} approvalTaskId={approvalTaskId} onClose={() => setQuery(tab)} />
  </div>
}

function parseTab(value: string | null): WorkItemTab { return TABS.some((item) => item.key === value) ? value as WorkItemTab : 'execute' }
function statusLabel(status: string) { return { not_started: '未开始', in_progress: '进行中', submitted: '已提交', changes_requested: '待修改', in_review: '审批中', completed: '已完成', cancelled: '已取消', exception_closed: '异常关闭' }[status] ?? status }
function priorityLabel(priority: string) { return { low: '低', normal: '普通', high: '高', critical: '紧急' }[priority] ?? priority }
function emptyTitle(tab: WorkItemTab) { return { execute: '暂无待执行任务', approve: '暂无待审批事项', initiated: '暂无我发起的任务', copied: '暂无抄送事项', completed: '暂无已完成事项' }[tab] }
function emptyDescription(tab: WorkItemTab) { return tab === 'approve' ? '有新的审批节点分配给你后会显示在这里。' : '符合当前分类和筛选条件的任务会显示在这里。' }
