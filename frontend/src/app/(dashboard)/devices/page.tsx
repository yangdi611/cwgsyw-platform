'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Chip,
  DataManagementPage,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  NeutralDrawer,
  PageHeader,
  SearchInput,
  Table,
} from '@/design-system/figma-neutral/components'

interface Device {
  id: number
  name: string
  ip: string
  deviceType: string
  category: string
  groupName: string
  description: string
  modelGroupCode: string | null
  modelGroupName: string | null
}

const UNGROUPED = '__ungrouped__'

const typeLabel: Record<string, string> = {
  server: '服务器',
  network: '网络设备',
  security: '安全设备',
  cloud: '云资源',
  other: '其他',
}

export default function DevicesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get('/devices').then((r) => r.data.data.records as Device[]),
  })

  const groupOptions = (() => {
    const seen = new Map<string, string>()
    let hasUngrouped = false
    for (const device of data ?? []) {
      if (device.modelGroupCode) {
        if (!seen.has(device.modelGroupCode)) seen.set(device.modelGroupCode, device.modelGroupName || device.modelGroupCode)
      } else {
        hasUngrouped = true
      }
    }
    const opts = [...seen.entries()].map(([code, name]) => ({ code, name }))
    opts.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
    if (hasUngrouped) opts.push({ code: UNGROUPED, name: '未分类' })
    return opts
  })()

  const filtered = (data ?? []).filter((device) => {
    if (groupFilter !== 'all') {
      const code = device.modelGroupCode ?? UNGROUPED
      if (code !== groupFilter) return false
    }
    if (!search.trim()) return true
    const query = search.toLowerCase()
    return (
      device.name?.toLowerCase().includes(query) ||
      device.ip?.toLowerCase().includes(query) ||
      device.category?.toLowerCase().includes(query) ||
      device.groupName?.toLowerCase().includes(query) ||
      device.modelGroupName?.toLowerCase().includes(query) ||
      (typeLabel[device.deviceType] ?? '').includes(query)
    )
  })

  const selected = filtered.find((device) => String(device.id) === selectedId) ?? null

  const columns = useMemo(
    () => [
      { key: 'name', label: '设备名称' },
      { key: 'ip', label: 'IP 地址' },
      { key: 'deviceType', label: '类型' },
      { key: 'modelGroupName', label: '模型分组' },
      { key: 'category', label: '分类' },
      { key: 'groupName', label: '所属组' },
    ],
    [],
  )

  const rows = filtered.map((device) => ({
    id: String(device.id),
    selected: String(device.id) === selectedId,
    cells: {
      name: device.name,
      ip: device.ip || '-',
      deviceType: typeLabel[device.deviceType] ?? typeLabel.other,
      modelGroupName: device.modelGroupName ? <Chip label={device.modelGroupName} /> : '未分类',
      category: device.category ? <Chip label={device.category} /> : '-',
      groupName: device.groupName || '-',
    },
  }))

  const tableState = isLoading ? 'loading' : filtered.length === 0 ? 'empty' : 'data'

  return (
    <>
      <DataManagementPage
        embedded
        layout="default"
        header={
          <PageHeader
            eyebrow="资源管理"
            title="设备密码库"
            subtitle="集中管理服务器、网络、安全设备和云资源的访问凭证，点击设备查看详情与密码。"
            breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: '设备密码库' }]} />}
            actions={
              <PermissionGuard resource="device" action="create">
                <Button type="button" variant="primary" onClick={() => router.push('/devices/new')}>
                  新增设备
                </Button>
              </PermissionGuard>
            }
          />
        }
        filter={
          <FilterBar
            search={
              <SearchInput
                value={search}
                placeholder="搜索名称、IP、分类、组…"
                onChange={(event) => setSearch(event.target.value)}
                onClear={() => setSearch('')}
              />
            }
            filterItems={
              <div className="cwgsyw-inline-controls">
                <Chip label="全部" selected={groupFilter === 'all'} onClick={() => setGroupFilter('all')} />
                {groupOptions.map((group) => (
                  <Chip
                    key={group.code}
                    label={group.name}
                    selected={groupFilter === group.code}
                    onClick={() => setGroupFilter(group.code)}
                  />
                ))}
              </div>
            }
          />
        }
        content={
          isError ? (
            <ErrorState
              title="设备加载失败"
              description="无法读取设备列表，请稍后重试。"
              retry={
                <Button type="button" variant="secondary" onClick={() => refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <Table
              columns={columns}
              rows={rows}
              showSearch={false}
              state={tableState}
              onRowClick={setSelectedId}
              loading={<LoadingState label="正在加载设备…" />}
              empty={
                <EmptyState
                  title={search ? `未找到包含“${search}”的设备` : '暂无设备'}
                  description={search ? '请调整搜索关键词或类型筛选。' : '点击右上角“新增设备”添加第一条设备记录。'}
                />
              }
            />
          )
        }
      />

      <NeutralDrawer
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
        title={selected?.name ?? '设备详情'}
        description={selected ? typeLabel[selected.deviceType] ?? typeLabel.other : undefined}
      >
        {selected ? (
          <div className="cwgsyw-form">
            {selected.description ? (
              <div>
                <div className="cwgsyw-type-label-xs">描述</div>
                <p className="cwgsyw-type-body-sm">{selected.description}</p>
              </div>
            ) : null}
            <dl className="cwgsyw-permission-grid">
              <div>
                <dt className="cwgsyw-type-label-xs">IP 地址</dt>
                <dd className="cwgsyw-type-body-sm">{selected.ip || '-'}</dd>
              </div>
              <div>
                <dt className="cwgsyw-type-label-xs">类型</dt>
                <dd className="cwgsyw-type-body-sm">{typeLabel[selected.deviceType] ?? typeLabel.other}</dd>
              </div>
              <div>
                <dt className="cwgsyw-type-label-xs">分类</dt>
                <dd className="cwgsyw-type-body-sm">{selected.category || '-'}</dd>
              </div>
              <div>
                <dt className="cwgsyw-type-label-xs">所属组</dt>
                <dd className="cwgsyw-type-body-sm">{selected.groupName || '-'}</dd>
              </div>
              <div>
                <dt className="cwgsyw-type-label-xs">设备 ID</dt>
                <dd className="cwgsyw-type-body-sm">{selected.id}</dd>
              </div>
            </dl>
            <Button type="button" variant="primary" onClick={() => router.push(`/devices/${selected.id}`)}>
              查看凭证与详情
            </Button>
          </div>
        ) : null}
      </NeutralDrawer>
    </>
  )
}
