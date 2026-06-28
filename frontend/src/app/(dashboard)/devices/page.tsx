'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Input } from '@/components/v2/Input'
import { Button } from '@/components/v2/Button'
import {
  PageHeader,
  FilterBar,
  FilterChip,
  DataTable,
  DetailDrawer,
  type ColumnDef,
} from '@/components/shared'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Plus, Search, Server, Network, Shield, Cloud, HardDrive, KeyRound, ArrowRight } from 'lucide-react'

interface Device {
  id: number
  name: string
  ip: string
  deviceType: string
  category: string
  groupName: string
  description: string
}

const typeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  server: { label: '服务器', icon: Server },
  network: { label: '网络设备', icon: Network },
  security: { label: '安全设备', icon: Shield },
  cloud: { label: '云资源', icon: Cloud },
  other: { label: '其他', icon: HardDrive },
}

function TypeBadge({ type }: { type: string }) {
  const tc = typeConfig[type] ?? typeConfig.other
  const Icon = tc.icon
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-v2-fg">
      <Icon className="h-3.5 w-3.5 text-v2-muted" />
      {tc.label}
    </span>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-v2-border bg-v2-surface-soft text-xs font-medium text-v2-fg">
      {children}
    </span>
  )
}

export default function DevicesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selected, setSelected] = useState<Device | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get('/devices').then((r) => r.data.data.records as Device[]),
  })

  const filtered = (data ?? []).filter((d) => {
    if (typeFilter !== 'all' && d.deviceType !== typeFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      d.name?.toLowerCase().includes(q) ||
      d.ip?.toLowerCase().includes(q) ||
      d.category?.toLowerCase().includes(q) ||
      d.groupName?.toLowerCase().includes(q) ||
      (typeConfig[d.deviceType]?.label ?? '').includes(q)
    )
  })

  const columns: ColumnDef<Device>[] = [
    {
      key: 'name',
      title: '设备名称',
      render: (r) => <span className="font-semibold text-v2-fg">{r.name}</span>,
    },
    {
      key: 'ip',
      title: 'IP 地址',
      render: (r) =>
        r.ip ? <span className="font-v2-mono text-sm text-v2-fg">{r.ip}</span> : <span className="text-v2-subtle">-</span>,
    },
    {
      key: 'deviceType',
      title: '类型',
      render: (r) => <TypeBadge type={r.deviceType} />,
    },
    {
      key: 'category',
      title: '分类',
      render: (r) => (r.category ? <Chip>{r.category}</Chip> : <span className="text-v2-subtle">-</span>),
    },
    {
      key: 'groupName',
      title: '所属组',
      render: (r) => <span className="text-v2-fg">{r.groupName || '-'}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="资源管理"
        title="设备密码库"
        subtitle="集中管理服务器、网络、安全设备和云资源的访问凭证，点击设备查看详情与密码。"
        actions={
          <PermissionGuard resource="device" action="create">
            <Button variant="primary" onClick={() => router.push('/devices/new')}>
              <Plus className="h-4 w-4" />
              新增设备
            </Button>
          </PermissionGuard>
        }
      />

      <FilterBar>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-v2-muted" />
          <Input
            className="pl-8"
            placeholder="搜索名称、IP、分类、组…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <FilterChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
          全部
        </FilterChip>
        <FilterChip active={typeFilter === 'server'} onClick={() => setTypeFilter('server')}>
          服务器
        </FilterChip>
        <FilterChip active={typeFilter === 'network'} onClick={() => setTypeFilter('network')}>
          网络设备
        </FilterChip>
        <FilterChip active={typeFilter === 'security'} onClick={() => setTypeFilter('security')}>
          安全设备
        </FilterChip>
        <FilterChip active={typeFilter === 'cloud'} onClick={() => setTypeFilter('cloud')}>
          云资源
        </FilterChip>
      </FilterBar>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(r) => r.id}
        loading={isLoading}
        onRowClick={(r) => setSelected(r)}
        empty={{
          title: search ? `未找到包含"${search}"的设备` : '暂无设备',
          description: search
            ? '请调整搜索关键词或类型筛选。'
            : '点击右上角"新增设备"添加第一条设备记录。',
        }}
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name}
        subtitle={selected ? <TypeBadge type={selected.deviceType} /> : undefined}
        footer={
          selected ? (
            <div className="flex items-center justify-end">
              <Button variant="primary" size="sm" onClick={() => router.push(`/devices/${selected.id}`)}>
                <KeyRound className="h-4 w-4" />
                查看凭证与详情
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
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-v2-muted">基本信息</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="text-xs text-v2-muted">IP 地址</dt>
                  <dd className="mt-0.5 font-v2-mono text-sm text-v2-fg">{selected.ip || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-v2-muted">类型</dt>
                  <dd className="mt-0.5">
                    <TypeBadge type={selected.deviceType} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-v2-muted">分类</dt>
                  <dd className="mt-0.5 text-sm text-v2-fg">{selected.category || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-v2-muted">所属组</dt>
                  <dd className="mt-0.5 text-sm text-v2-fg">{selected.groupName || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-v2-muted">设备 ID</dt>
                  <dd className="mt-0.5 font-v2-mono text-sm text-v2-fg">{selected.id}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  )
}
