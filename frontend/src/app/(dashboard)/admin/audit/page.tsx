'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { PageHeader, FilterBar, DataTable, type ColumnDef } from '@/components/shared'
import { usePermission } from '@/hooks/usePermission'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AuditLogVO {
  id: number
  module: string
  action: string
  targetId: number
  targetType: string
  operatorId: number
  operatorName: string
  operatorIp: string
  remark: string
  createdAt: string
}

interface PageResult {
  records: AuditLogVO[]
  total: number
}

const MODULE_LABELS: Record<string, string> = {
  device: '设备密码库',
  change_doc: '变更文档',
  daily_report: '工作日报',
  sys_config: '系统配置',
  user: '用户管理',
  group: '组管理',
}

type StatusVariant = 'ok' | 'warn' | 'danger' | 'neutral'

const ACTION_VARIANT: Record<string, StatusVariant> = {
  create: 'ok',
  update: 'warn',
  delete: 'danger',
  approve: 'ok',
  reject: 'danger',
  view_password: 'neutral',
  submit: 'ok',
  ai_generate: 'neutral',
}

export default function AuditLogPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('audit', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const [module, setModule] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const size = 20

  const { data, isLoading } = useQuery<PageResult>({
    queryKey: ['audit-logs', module, startDate, endDate, page],
    queryFn: () => {
      const params: Record<string, string | number> = { page, size }
      if (module) params.module = module
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      return api.get('/audit-logs', { params }).then((r) => r.data.data)
    },
    enabled: hasPermission('audit', 'read'),
  })

  const records = data?.records ?? []
  const hasMore = records.length === size

  const columns: ColumnDef<AuditLogVO>[] = [
    {
      key: 'createdAt',
      title: '时间',
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-v2-muted">
          {new Date(r.createdAt).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'module',
      title: '模块',
      render: (r) => <span className="text-xs text-v2-fg">{MODULE_LABELS[r.module] ?? r.module}</span>,
    },
    {
      key: 'action',
      title: '操作',
      render: (r) => (
        <StatusBadge status={ACTION_VARIANT[r.action] ?? 'neutral'}>{r.action}</StatusBadge>
      ),
    },
    {
      key: 'operatorName',
      title: '操作人',
      render: (r) => <span className="text-xs text-v2-fg">{r.operatorName}</span>,
    },
    {
      key: 'target',
      title: '目标',
      render: (r) => (
        <span className="text-xs text-v2-muted">
          {r.targetType}
          {r.targetId ? ` #${r.targetId}` : ''}
        </span>
      ),
    },
    {
      key: 'remark',
      title: '备注',
      render: (r) => <span className="max-w-xs truncate text-xs text-v2-muted">{r.remark}</span>,
    },
    {
      key: 'operatorIp',
      title: 'IP',
      render: (r) => <span className="font-v2-mono text-xs text-v2-muted">{r.operatorIp}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="系统管理"
        title="审计日志"
        subtitle="记录所有写操作的模块、动作、操作人与目标对象，支持按模块与时间范围筛选。"
      />

      <FilterBar>
        <div className="space-y-1.5">
          <Label className="text-xs">模块</Label>
          <Select
            value={module || '__all__'}
            onValueChange={(v) => {
              setModule(v === '__all__' ? '' : v ?? '')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部模块</SelectItem>
              {Object.entries(MODULE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">开始日期</Label>
          <Input
            type="date"
            className="w-40"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">结束日期</Label>
          <Input
            type="date"
            className="w-40"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="self-end">
          <button
            type="button"
            onClick={() => {
              setModule('')
              setStartDate('')
              setEndDate('')
              setPage(1)
            }}
            className="inline-flex h-9 items-center rounded-md border border-v2-border bg-v2-surface px-3 text-sm text-v2-fg transition-colors hover:bg-v2-surface-hover"
          >
            重置
          </button>
        </div>
      </FilterBar>

      <DataTable
        columns={columns}
        data={records}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty={{ title: '暂无审计日志', description: '当前筛选条件下没有操作记录。' }}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-v2-muted">
          第 <span className="font-semibold text-v2-fg tabular-nums">{page}</span> 页，每页 {size} 条
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-v2-border bg-v2-surface px-2 text-v2-fg transition-colors hover:bg-v2-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-v2-border bg-v2-surface px-2 text-v2-fg transition-colors hover:bg-v2-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
