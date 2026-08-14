'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { ApprovalTaskDrawer } from '@/components/work/ApprovalTaskDrawer'
import { usePermission } from '@/hooks/usePermission'
import { listDirectoryGroups, listPublishedTemplates } from '@/lib/task-plan-api'
import { getWorkItemCounts, listWorkItems, type WorkItem, type WorkItemTab } from '@/lib/work-item-api'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Chip,
  DataManagementPage,
  EmptyState,
  ErrorState,
  FilterBar,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  Table,
  Tabs,
} from '@/design-system/figma-neutral/components'

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
  const groups = useQuery({
    queryKey: ['work-item-group-options'],
    queryFn: listDirectoryGroups,
    enabled: hasPermission('group', 'read'),
  })
  const items = useQuery({
    queryKey: ['work-items', { tab, keyword, status, priority, overdue, templateId, groupId, from, to, page }],
    queryFn: () =>
      listWorkItems({
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
  const records = items.data?.records ?? []
  const total = items.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <DataManagementPage
      embedded
      header={
        <PageHeader
          eyebrow="统一任务平台"
          title="我的工作"
          subtitle="待执行、待审批、我发起、抄送和已完成事项统一在这里处理。"
          breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: '我的工作' }]} />}
        />
      }
      filter={
        <div className="cwgsyw-form">
          <Tabs
            style="underline"
            value={tab}
            onChange={(id) => {
              resetPage()
              setQuery(id as WorkItemTab)
            }}
            items={TABS.map((item) => ({
              id: item.key,
              label: item.label,
              badge: <Chip label={String(counts.data?.[item.key] ?? 0)} />,
              panel: null,
            }))}
          />
          <FilterBar
            search={
              <SearchInput
                value={keyword}
                placeholder="搜索任务、审批节点或说明"
                onChange={(event) => {
                  setKeyword(event.target.value)
                  resetPage()
                }}
              />
            }
            filterItems={
              <div className="cwgsyw-inline-controls">
                <Select
                  value={status}
                  options={[
                    { value: 'all', label: '全部状态' },
                    { value: 'not_started', label: '未开始' },
                    { value: 'in_progress', label: '进行中' },
                    { value: 'changes_requested', label: '待修改' },
                    { value: 'in_review', label: '审批中' },
                    { value: 'completed', label: '已完成' },
                    { value: 'cancelled', label: '已取消' },
                  ]}
                  onChange={(value) => {
                    setStatus(value)
                    resetPage()
                  }}
                />
                <Select
                  value={priority}
                  options={[
                    { value: 'all', label: '全部优先级' },
                    { value: 'low', label: '低' },
                    { value: 'normal', label: '普通' },
                    { value: 'high', label: '高' },
                    { value: 'critical', label: '紧急' },
                  ]}
                  onChange={(value) => {
                    setPriority(value)
                    resetPage()
                  }}
                />
                <Select
                  value={overdue}
                  options={[
                    { value: 'all', label: '全部时效' },
                    { value: 'yes', label: '已逾期' },
                    { value: 'no', label: '未逾期' },
                  ]}
                  onChange={(value) => {
                    setOverdue(value)
                    resetPage()
                  }}
                />
                <Select
                  value={templateId}
                  options={[{ value: 'all', label: '全部模板' }, ...(templates.data ?? []).map((template) => ({ value: String(template.id), label: template.name }))]}
                  onChange={(value) => {
                    setTemplateId(value)
                    resetPage()
                  }}
                />
                {hasPermission('group', 'read') ? (
                  <Select
                    value={groupId}
                    options={[{ value: 'all', label: '全部组' }, ...(groups.data ?? []).map((group) => ({ value: String(group.id), label: group.name }))]}
                    onChange={(value) => {
                      setGroupId(value)
                      resetPage()
                    }}
                  />
                ) : null}
                <Input
                  type="date"
                  aria-label="开始日期"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value)
                    resetPage()
                  }}
                />
                <Input
                  type="date"
                  aria-label="结束日期"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value)
                    resetPage()
                  }}
                />
              </div>
            }
          />
        </div>
      }
      content={
        <>
          {items.isError ? (
            <ErrorState
              title="工作项加载失败"
              description="无法读取我的工作，请重试。"
              retry={
                <Button type="button" variant="secondary" onClick={() => void items.refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <Table
              showSearch={false}
              columns={[
                { key: 'title', label: '工作项' },
                { key: 'status', label: '状态' },
                { key: 'date', label: '业务日期' },
                { key: 'dueAt', label: '截止时间' },
                { key: 'priority', label: '优先级' },
              ]}
              rows={records.map((item) => ({
                id: `${item.itemType}:${item.itemId}`,
                cells: {
                  title: (
                    <div>
                      <div className="cwgsyw-inline-controls">
                        <strong>{item.title}</strong>
                        {item.actionRequired ? <StatusBadge label="需要处理" status="warning" /> : null}
                      </div>
                      <p className="cwgsyw-type-body-sm">{item.subtitle}</p>
                    </div>
                  ),
                  status: (
                    <div className="cwgsyw-inline-controls">
                      <StatusBadge
                        label={statusLabel(item.status)}
                        status={item.overdue ? 'danger' : item.status === 'completed' ? 'success' : item.status === 'changes_requested' ? 'warning' : 'neutral'}
                      />
                      {item.nodeName ? <StatusBadge label={item.nodeName} status="neutral" /> : null}
                    </div>
                  ),
                  date: item.businessDate ?? '-',
                  dueAt: item.dueAt ? new Date(item.dueAt).toLocaleString('zh-CN') : '-',
                  priority: (
                    <StatusBadge
                      label={priorityLabel(item.priority)}
                      status={item.priority === 'critical' ? 'danger' : item.priority === 'high' ? 'warning' : 'neutral'}
                    />
                  ),
                },
              }))}
              state={items.isLoading ? 'loading' : records.length === 0 ? 'empty' : 'data'}
              empty={<EmptyState title={emptyTitle(tab)} description={emptyDescription(tab)} showAction={false} />}
              onRowClick={(id) => {
                const item = records.find((entry) => `${entry.itemType}:${entry.itemId}` === id)
                if (!item) return
                if (item.itemType === 'approval' && item.approvalTaskId) setQuery('approve', item.approvalTaskId)
                else router.push(item.href)
              }}
            />
          )}
          <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={setPage} />
          <ApprovalTaskDrawer key={approvalTaskId ?? 'closed'} approvalTaskId={approvalTaskId} onClose={() => setQuery(tab)} />
        </>
      }
    />
  )
}

function parseTab(value: string | null): WorkItemTab {
  return TABS.some((item) => item.key === value) ? (value as WorkItemTab) : 'execute'
}
function statusLabel(status: string) {
  return {
    not_started: '未开始',
    in_progress: '进行中',
    submitted: '已提交',
    changes_requested: '待修改',
    in_review: '审批中',
    completed: '已完成',
    cancelled: '已取消',
    exception_closed: '异常关闭',
  }[status] ?? status
}
function priorityLabel(priority: string) {
  return { low: '低', normal: '普通', high: '高', critical: '紧急' }[priority] ?? priority
}
function emptyTitle(tab: WorkItemTab) {
  return {
    execute: '暂无待执行任务',
    approve: '暂无待审批事项',
    initiated: '暂无我发起的任务',
    copied: '暂无抄送事项',
    completed: '暂无已完成事项',
  }[tab]
}
function emptyDescription(tab: WorkItemTab) {
  return tab === 'approve' ? '有新的审批节点分配给你后会显示在这里。' : '符合当前分类和筛选条件的任务会显示在这里。'
}
