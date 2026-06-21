'use client'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Input } from '@/components/v2/Input'
import { Button } from '@/components/v2/Button'
import { PageHeader, DataTable, Pagination, type ColumnDef } from '@/components/shared'
import { Search, Grid3x3, Settings, Boxes } from 'lucide-react'

// AC10 (Issue #64): 本页为纯浏览目录（只读）。模型/属性的管理操作统一走 /cmdb/admin。
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

const MODEL_GROUPS = [
  { code: 'infra', name: '基础设施' },
  { code: 'biz', name: '业务应用' },
  { code: 'network', name: '网络设备' },
  { code: 'security', name: '安全设备' },
  { code: 'cloud', name: '云资源' },
]

function Chip({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'primary' }) {
  const cls =
    tone === 'primary'
      ? 'border-v2-primary-border bg-v2-primary-soft text-v2-primary'
      : 'border-v2-border bg-v2-surface-soft text-v2-fg'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${cls}`}>
      {children}
    </span>
  )
}

export default function CmdbModelsPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()

  const [groupFilter, setGroupFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const size = 20

  useEffect(() => {
    if (!hasPermission('cmdb_model', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data, isLoading } = useQuery({
    queryKey: ['cmdb-models', search, groupFilter, page],
    queryFn: () =>
      api
        .get('/cmdb/models', {
          params: { keyword: search || undefined, group: groupFilter || undefined, page, size },
        })
        .then((r) => r.data.data),
    enabled: hasPermission('cmdb_model', 'read'),
  })

  const models = (data?.records ?? []) as CiModelVO[]
  const total = data?.total ?? 0

  const columns: ColumnDef<CiModelVO>[] = [
    {
      key: 'name',
      title: '标识',
      render: (r) => (
        <Link
          href={`/cmdb/instances/by-model/${r.name}`}
          className="font-v2-mono text-sm font-semibold text-v2-primary hover:text-v2-primary-hover"
        >
          {r.name}
        </Link>
      ),
    },
    {
      key: 'displayName',
      title: '显示名',
      render: (r) => <span className="font-medium text-v2-fg">{r.displayName}</span>,
    },
    {
      key: 'groupName',
      title: '分组',
      render: (r) => (r.groupName ? <Chip>{r.groupName}</Chip> : <span className="text-v2-subtle">-</span>),
    },
    {
      key: 'isBuiltIn',
      title: '内置',
      render: (r) => (r.isBuiltIn ? <Chip tone="primary">内置</Chip> : <span className="text-v2-subtle">-</span>),
    },
    {
      key: 'instanceCount',
      title: '实例数',
      render: (r) => <span className="font-v2-mono tabular-nums text-v2-fg">{r.instanceCount}</span>,
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (r) => (
        <Link
          href={`/cmdb/instances/by-model/${r.name}`}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-v2-sm border border-v2-border bg-v2-surface text-v2-fg transition-colors hover:bg-v2-surface-hover"
        >
          <Boxes className="h-3.5 w-3.5" />
          查看实例
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CMDB"
        title="模型管理"
        subtitle="浏览 CMDB 模型目录与内置属性，点击模型查看其实例列表。模型与属性的编辑在配置管理中完成。"
        actions={
          <>
            <Link
              href="/cmdb/instances/2d-view"
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold rounded-v2-md border border-v2-border bg-v2-surface text-v2-fg shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
            >
              <Grid3x3 className="h-4 w-4" />
              2D 视图
            </Link>
            <PermissionGuard resource="cmdb_model" action="update">
              <Link
                href="/cmdb/admin"
                className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold rounded-v2-md border border-v2-border bg-v2-surface text-v2-fg shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
              >
                <Settings className="h-4 w-4" />
                配置管理
              </Link>
            </PermissionGuard>
          </>
        }
      />

      <div className="flex gap-6">
        {/* Left: group filter */}
        <div className="w-44 shrink-0">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-v2-muted">模型分组</h3>
          <div className="space-y-1">
            <button
              onClick={() => {
                setGroupFilter('')
                setPage(1)
              }}
              className={cn(
                'block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                !groupFilter
                  ? 'bg-v2-primary-soft font-semibold text-v2-primary'
                  : 'text-v2-fg hover:bg-v2-surface-hover',
              )}
            >
              全部
            </button>
            {MODEL_GROUPS.map((g) => (
              <button
                key={g.code}
                onClick={() => {
                  setGroupFilter(g.code)
                  setPage(1)
                }}
                className={cn(
                  'block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                  groupFilter === g.code
                    ? 'bg-v2-primary-soft font-semibold text-v2-primary'
                    : 'text-v2-fg hover:bg-v2-surface-hover',
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right: model table */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-v2-muted" />
            <Input
              className="pl-8"
              placeholder="搜索模型名称…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <DataTable
            columns={columns}
            data={models}
            rowKey={(r) => r.id}
            loading={isLoading}
            empty={{ title: '暂无模型', description: '当前分组下没有模型，请调整筛选或切换分组。' }}
          />

          <Pagination page={page} pageSize={size} total={total} onPageChange={setPage} />
        </div>
      </div>
    </div>
  )
}
