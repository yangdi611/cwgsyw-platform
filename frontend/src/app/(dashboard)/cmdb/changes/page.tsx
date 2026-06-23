'use client'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { Input } from '@/components/v2/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/v2/Select'
import { PageHeader, FilterBar } from '@/components/shared'
import { JsonDiffView } from '@/components/cmdb/JsonDiffView'
import { actionMeta, ChangeHistoryV2VO } from '@/components/cmdb/ChangeRecordItem'
import { ChevronLeft, ChevronRight, ChevronDown, X, BarChart3 } from 'lucide-react'
import Link from 'next/link'

type StatusVariant = 'ok' | 'warn' | 'danger' | 'neutral'

interface CiModelVO {
  id: number
  modelId: string
  name: string
  displayName: string
}

interface PageData {
  records: ChangeHistoryV2VO[]
  total: number
  page: number
  size: number
}

const ACTION_OPTIONS = [
  { value: '__all__', label: '全部动作' },
  { value: 'create_instance', label: '创建' },
  { value: 'update_instance', label: '更新' },
  { value: 'delete_instance', label: '删除' },
]

const SIZE_OPTIONS = [20, 50, 100]

function actionVariant(a: string): StatusVariant {
  if (a?.includes('create')) return 'ok'
  if (a?.includes('delete')) return 'danger'
  if (a?.includes('update')) return 'warn'
  return 'neutral'
}

function toIso(date: string, endOfDay = false): string | undefined {
  if (!date) return undefined
  return endOfDay ? `${date}T23:59:59` : `${date}T00:00:00`
}

export default function CmdbChangesPage() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()

  const [model, setModel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [operatorId, setOperatorId] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_change', 'read') && !hasPermission('cmdb_instance', 'read')) {
      router.replace('/')
    }
  }, [isHydrated, hasPermission, router])

  const { data: models } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models-all'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models', { params: { size: 100 } })
        return r.data.data.records
      } catch {
        return []
      }
    },
    enabled: typeof window !== 'undefined',
  })

  const canRead = hasPermission('cmdb_change', 'read') || hasPermission('cmdb_instance', 'read')

  const { data, isLoading, isFetching } = useQuery<PageData>({
    queryKey: ['cmdb-changes-v2', model, startDate, endDate, operatorId, action, page, size],
    queryFn: () =>
      api
        .get('/cmdb/changes', {
          params: {
            entityType: 'ci_instance',
            modelId: model || undefined,
            from: toIso(startDate, false),
            to: toIso(endDate, true),
            operatorId: operatorId || undefined,
            action: action || undefined,
            page,
            size,
          },
        })
        .then((r) => r.data.data),
    enabled: canRead,
  })

  const changes = data?.records ?? []
  const total = data?.total ?? 0

  const resetPage = () => setPage(1)

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const clearFilters = () => {
    setModel('')
    setStartDate('')
    setEndDate('')
    setOperatorId('')
    setAction('')
    resetPage()
  }

  const hasFilters = !!(model || startDate || endDate || operatorId || action)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CMDB"
        title="变更历史"
        subtitle="CI 实例变更审计与字段级 diff 追溯，点击行展开查看变更前后对比。"
        actions={
          <Link
            href="/cmdb/changes/stats"
            className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold rounded-v2-md border border-v2-border bg-v2-surface text-v2-fg shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
          >
            <BarChart3 className="h-4 w-4" />
            变更统计
          </Link>
        }
      />

      <FilterBar>
        <Select
          value={model || '__all__'}
          onValueChange={(v) => {
            setModel(v === '__all__' ? '' : v ?? '')
            resetPage()
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部模型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部模型</SelectItem>
            {(models ?? []).map((m) => (
              <SelectItem key={m.modelId} value={m.modelId}>
                {m.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value)
            resetPage()
          }}
          className="w-40"
        />
        <span className="text-sm text-v2-muted">至</span>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value)
            resetPage()
          }}
          className="w-40"
        />

        <Input
          type="number"
          inputMode="numeric"
          placeholder="操作人 ID"
          value={operatorId}
          onChange={(e) => {
            setOperatorId(e.target.value)
            resetPage()
          }}
          className="w-32"
        />

        <Select
          value={action || '__all__'}
          onValueChange={(v) => {
            setAction(v === '__all__' ? '' : v ?? '')
            resetPage()
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="全部动作" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" />
            清除
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-v2-muted">每页</span>
          <Select
            value={String(size)}
            onValueChange={(v) => {
              setSize(Number(v))
              resetPage()
            }}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZE_OPTIONS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterBar>

      {/* Table */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-v2-muted">加载中…</p>
      ) : changes.length === 0 ? (
        <p className="py-12 text-center text-sm text-v2-muted">暂无变更记录</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-v2-border bg-v2-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-v2-border bg-v2-surface-soft">
                <tr>
                  <th className="w-10 px-3 py-2.5" />
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">
                    操作类型
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">
                    操作人
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">
                    变更摘要
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">
                    时间
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-v2-border">
                {changes.map((ch) => {
                  const meta = actionMeta(ch.action)
                  const isOpen = expanded.has(ch.id)
                  const changedFields = ch.changedFields ?? []
                  const hasDiff = ch.beforeJson != null || ch.afterJson != null
                  return (
                    <Fragment key={ch.id}>
                      <tr
                        className={cn(
                          'cursor-pointer hover:bg-v2-surface-hover',
                          isOpen && 'border-b-0',
                        )}
                        onClick={() => hasDiff && toggleExpand(ch.id)}
                      >
                        <td className="w-10 px-3 py-2.5">
                          {hasDiff ? (
                            isOpen ? (
                              <ChevronDown className="h-4 w-4 text-v2-muted" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-v2-muted" />
                            )
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={actionVariant(ch.action)}>{meta.label}</StatusBadge>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-v2-fg">
                          {ch.operatorName ?? '系统'}
                        </td>
                        <td className="px-3 py-2.5 text-v2-muted">
                          {ch.summary ??
                            (ch.afterJson ? JSON.stringify(ch.afterJson).slice(0, 80) : '-')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-v2-muted">
                          {new Date(ch.createdAt).toLocaleString('zh-CN')}
                        </td>
                      </tr>
                      {isOpen && hasDiff && (
                        <tr className="border-b border-v2-border">
                          <td colSpan={5} className="bg-v2-surface-soft pb-4 pt-4">
                            {changedFields.length > 0 && (
                              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                                <span className="mr-1 text-xs text-v2-muted">变更字段:</span>
                                {changedFields.map((f) => (
                                  <code
                                    key={f}
                                    className="rounded border border-v2-border bg-v2-surface px-1.5 py-0.5 font-v2-mono text-[11px] text-v2-fg"
                                  >
                                    {f}
                                  </code>
                                ))}
                              </div>
                            )}
                            <JsonDiffView before={ch.beforeJson} after={ch.afterJson} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-v2-muted">
          共 <span className="font-semibold text-v2-fg tabular-nums">{total}</span> 条
          {isFetching && !isLoading ? '（刷新中…）' : ''}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-v2-border bg-v2-surface px-2 text-v2-fg transition-colors hover:bg-v2-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="tabular-nums text-sm text-v2-fg">
            {page} / {Math.max(1, Math.ceil(total / size))}
          </span>
          <button
            type="button"
            disabled={page >= Math.ceil(total / size)}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-v2-border bg-v2-surface px-2 text-v2-fg transition-colors hover:bg-v2-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
