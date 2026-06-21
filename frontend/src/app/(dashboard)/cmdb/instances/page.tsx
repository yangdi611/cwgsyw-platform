'use client'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Input } from '@/components/v2/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import {
  PageHeader,
  FilterBar,
  DataTable,
  DetailDrawer,
  Pagination,
  type ColumnDef,
} from '@/components/shared'
import { Search, Grid3x3, ArrowRight, GitBranch, FileText } from 'lucide-react'

// AC10 (Issue #64): 本页为纯浏览页（跨模型实例检索）。实例新建/删除/导入走各模型的
// 浏览页 /cmdb/instances/by-model/[modelCode]。
interface CiModelVO {
  id: number
  name: string
  displayName: string
  group: string
  groupName: string
  isBuiltIn: boolean
  instanceCount: number
  attributes: any[]
  createdAt: string
  updatedAt: string
}

interface CiInstanceVO {
  id: number
  name: string
  modelId: string
  modelName: string
  status: string
  owner: string
  description: string
  fieldsData: Record<string, any>
  createdAt: string
  updatedAt: string
}

type StatusVariant = 'ok' | 'warn' | 'danger' | 'neutral'

function statusMeta(status: string): { variant: StatusVariant; label: string } {
  const s = (status || '').toLowerCase()
  if (['running', 'active', 'online', 'up', 'healthy', 'ok', 'in_service', 'inservice', 'running中'].includes(s))
    return { variant: 'ok', label: '运行中' }
  if (['stopped', 'offline', 'down', 'inactive', 'fault', 'error', 'out_of_service', 'failed'].includes(s))
    return { variant: 'danger', label: '已停用' }
  if (['maintenance', 'pending', 'warning', 'degraded', 'standby', 'paused'].includes(s))
    return { variant: 'warn', label: '维护中' }
  return { variant: 'neutral', label: status || '未知' }
}

function formatTime(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN')
}

function formatValue(v: any): string {
  if (v === null || v === undefined || v === '') return '-'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function ModelChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-v2-border bg-v2-surface-soft text-xs font-medium text-v2-fg">
      {name}
    </span>
  )
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-v2-muted">{label}</dt>
      <dd className={cn('mt-0.5 text-sm text-v2-fg break-all', mono && 'font-v2-mono')}>{value}</dd>
    </div>
  )
}

export default function CmdbInstancesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission } = usePermission()

  const [model, setModel] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<CiInstanceVO | null>(null)
  const size = 20

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  // Auto-set model from URL param
  useEffect(() => {
    const m = searchParams.get('model')
    if (m) setModel(m)
  }, [searchParams])

  // Fetch models for filter + attribute label translation
  const { data: models = [] } = useQuery<CiModelVO[]>({
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

  // Fetch instances
  const { data, isLoading } = useQuery({
    queryKey: ['cmdb-instances', model, keyword, status, page],
    queryFn: () =>
      api
        .get('/cmdb/instances', {
          params: {
            model: model || undefined,
            keyword: keyword || undefined,
            status: status || undefined,
            page,
            size,
          },
        })
        .then((r) => r.data.data),
    enabled: hasPermission('cmdb_instance', 'read'),
  })

  const instances = (data?.records ?? []) as CiInstanceVO[]
  const total = data?.total ?? 0

  // Translate field key → label via model attributes
  const getAttrLabel = (modelId: string, key: string): string => {
    const m = models.find((x) => x.name === modelId)
    const attr = m?.attributes?.find((a: any) => (a.property ?? a.id) === key)
    return attr?.displayName ?? attr?.name ?? key
  }

  const columns = useMemo<ColumnDef<CiInstanceVO>[]>(
    () => [
      {
        key: 'name',
        title: '实例名称',
        render: (r) => <span className="font-semibold text-v2-fg">{r.name}</span>,
      },
      {
        key: 'modelName',
        title: '模型',
        render: (r) => <ModelChip name={r.modelName} />,
      },
      {
        key: 'status',
        title: '状态',
        render: (r) =>
          r.status ? (
            <StatusBadge status={statusMeta(r.status).variant}>{statusMeta(r.status).label}</StatusBadge>
          ) : (
            <span className="text-v2-subtle">-</span>
          ),
      },
      {
        key: 'owner',
        title: '负责人',
        render: (r) => <span className="text-v2-fg">{r.owner || '-'}</span>,
      },
      {
        key: 'updatedAt',
        title: '更新时间',
        render: (r) => (
          <span className="whitespace-nowrap text-sm text-v2-muted">{formatTime(r.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const selectedFields = selected ? Object.entries(selected.fieldsData ?? {}).slice(0, 8) : []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CMDB"
        title="实例管理"
        subtitle="跨模型检索实例，从详情抽屉查看关键属性、负责人、拓扑与关联，需要完整编辑时进入实例详情页。"
        actions={
          <Link
            href="/cmdb/instances/2d-view"
            className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold rounded-v2-md border border-v2-border bg-v2-surface text-v2-fg shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
          >
            <Grid3x3 className="h-4 w-4" />
            2D 视图
          </Link>
        }
      />

      {/* Filters */}
      <FilterBar>
        <Select
          value={model || '__all__'}
          onValueChange={(v) => {
            setModel(v === '__all__' ? '' : v ?? '')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部模型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部模型</SelectItem>
            {models.map((m) => (
              <SelectItem key={m.name} value={m.name}>
                {m.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-v2-muted" />
          <Input
            className="pl-8"
            placeholder="搜索实例名称…"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <Select
          value={status || '__all__'}
          onValueChange={(v) => {
            setStatus(v === '__all__' ? '' : v ?? '')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部状态</SelectItem>
            <SelectItem value="running">运行中</SelectItem>
            <SelectItem value="stopped">已停用</SelectItem>
            <SelectItem value="maintenance">维护中</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {/* Table */}
      <DataTable
        columns={columns}
        data={instances}
        rowKey={(r) => r.id}
        loading={isLoading}
        onRowClick={(r) => setSelected(r)}
        empty={{
          title: '暂无实例',
          description: '当前筛选条件下没有匹配的实例，请调整模型 / 关键词 / 状态筛选。',
        }}
      />

      <Pagination page={page} pageSize={size} total={total} onPageChange={setPage} />

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name}
        subtitle={
          selected ? (
            <div className="flex items-center gap-2">
              <ModelChip name={selected.modelName} />
              {selected.status && (
                <StatusBadge status={statusMeta(selected.status).variant}>
                  {statusMeta(selected.status).label}
                </StatusBadge>
              )}
            </div>
          ) : undefined
        }
        footer={
          selected ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(`/cmdb/topology/${selected.id}`)}
              >
                <GitBranch className="h-4 w-4" />
                查看拓扑
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  router.push(`/cmdb/instances/by-model/${selected.modelId}/${selected.id}`)
                }
              >
                <FileText className="h-4 w-4" />
                完整详情
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-5">
            {selected.description && (
              <div className="rounded-v2-md border border-v2-border bg-v2-surface-soft p-3">
                <div className="text-xs font-semibold text-v2-muted mb-1">描述</div>
                <p className="text-sm text-v2-fg leading-relaxed">{selected.description}</p>
              </div>
            )}

            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-v2-muted">
                基本信息
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <InfoItem label="模型" value={selected.modelName} />
                <InfoItem
                  label="状态"
                  value={selected.status ? statusMeta(selected.status).label : '-'}
                />
                <InfoItem label="负责人" value={selected.owner || '-'} />
                <InfoItem label="实例 ID" value={String(selected.id)} mono />
                <InfoItem label="创建时间" value={formatTime(selected.createdAt)} />
                <InfoItem label="更新时间" value={formatTime(selected.updatedAt)} />
              </dl>
            </div>

            {selectedFields.length > 0 && (
              <div>
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-v2-muted">
                  关键属性
                </div>
                <dl className="space-y-2.5">
                  {selectedFields.map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-3 text-sm">
                      <dt className="shrink-0 text-v2-muted">{getAttrLabel(selected.modelId, k)}</dt>
                      <dd className="text-right break-all text-v2-fg">{formatValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  )
}
