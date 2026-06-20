'use client'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { JsonDiffView } from '@/components/cmdb/JsonDiffView'
import { actionMeta, ChangeHistoryV2VO } from '@/components/cmdb/ChangeRecordItem'
import { ChevronLeft, ChevronRight, ChevronDown, Filter, X, BarChart3 } from 'lucide-react'
import Link from 'next/link'

interface CiModelVO {
  id: number
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

/** `YYYY-MM-DD` (local) → ISO timestamp string accepted by the backend. */
function toIso(date: string, endOfDay = false): string | undefined {
  if (!date) return undefined
  return endOfDay ? `${date}T23:59:59` : `${date}T00:00:00`
}

export default function CmdbChangesPage() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()

  // ── filter state ──
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
        .then(r => r.data.data),
    enabled: canRead,
  })

  const changes = data?.records ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / size))

  const resetPage = () => setPage(1)

  const toggleExpand = (id: number) =>
    setExpanded(prev => {
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">CMDB 变更历史</h1>
          <p className="text-sm text-muted-foreground mt-1">CI 实例变更审计与字段级 diff 追溯</p>
        </div>
        <Link
          href="/cmdb/changes/stats"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <BarChart3 className="h-4 w-4 mr-1" />变更统计
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 border rounded-lg bg-card/50">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={model || '__all__'}
          onValueChange={v => {
            setModel(v === '__all__' ? '' : (v ?? ''))
            resetPage()
          }}
        >
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="全部模型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部模型</SelectItem>
            {(models ?? []).map(m => (
              <SelectItem key={m.name} value={m.name}>
                {m.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={startDate}
          onChange={e => {
            setStartDate(e.target.value)
            resetPage()
          }}
          className="w-40 h-9"
        />
        <span className="text-sm text-muted-foreground">至</span>
        <Input
          type="date"
          value={endDate}
          onChange={e => {
            setEndDate(e.target.value)
            resetPage()
          }}
          className="w-40 h-9"
        />

        <Input
          type="number"
          inputMode="numeric"
          placeholder="操作人 ID"
          value={operatorId}
          onChange={e => {
            setOperatorId(e.target.value)
            resetPage()
          }}
          className="w-32 h-9"
        />

        <Select
          value={action || '__all__'}
          onValueChange={v => {
            setAction(v === '__all__' ? '' : (v ?? ''))
            resetPage()
          }}
        >
          <SelectTrigger className="w-32 h-9">
            <SelectValue placeholder="全部动作" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            <X className="h-3.5 w-3.5 mr-1" />清除
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">每页</span>
          <Select value={String(size)} onValueChange={v => { setSize(Number(v)); resetPage() }}>
            <SelectTrigger className="w-20 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIZE_OPTIONS.map(s => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm py-12 text-center">加载中...</p>
      ) : changes.length === 0 ? (
        <p className="text-muted-foreground text-sm py-12 text-center">暂无变更记录</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-24">操作类型</TableHead>
                <TableHead className="w-32">操作人</TableHead>
                <TableHead>变更摘要</TableHead>
                <TableHead className="w-44">时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map(ch => {
                const meta = actionMeta(ch.action)
                const isOpen = expanded.has(ch.id)
                const changedFields = ch.changedFields ?? []
                const hasDiff = ch.beforeJson != null || ch.afterJson != null
                return (
                  <Fragment key={ch.id}>
                    <TableRow
                      className={cn('cursor-pointer hover:bg-muted/40', isOpen && 'border-b-0')}
                      onClick={() => hasDiff && toggleExpand(ch.id)}
                    >
                      <TableCell className="w-10">
                        {hasDiff ? (
                          isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{ch.operatorName ?? '系统'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {ch.summary ?? (ch.afterJson ? JSON.stringify(ch.afterJson).slice(0, 80) : '—')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(ch.createdAt).toLocaleString('zh-CN')}
                      </TableCell>
                    </TableRow>
                    {isOpen && hasDiff && (
                      <TableRow className="border-b">
                        <TableCell colSpan={5} className="bg-muted/20 pt-4 pb-4">
                          {changedFields.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              <span className="text-xs text-muted-foreground self-center mr-1">变更字段:</span>
                              {changedFields.map(f => (
                                <code
                                  key={f}
                                  className="text-[11px] px-1.5 py-0.5 rounded bg-background border text-foreground font-mono"
                                >
                                  {f}
                                </code>
                              ))}
                            </div>
                          )}
                          <JsonDiffView before={ch.beforeJson} after={ch.afterJson} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-muted-foreground">
          共 {total} 条{isFetching && !isLoading ? '（刷新中…）' : ''}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{page} / {totalPages}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
