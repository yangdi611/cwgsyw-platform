'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { CmdbInstancePreview } from '@/components/cmdb/CmdbInstancePreview'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  NeutralDrawer,
  PageHeader,
  SearchInput,
  Table,
  Tabs,
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
      name: <span className="cwgsyw-devices__name">{device.name}</span>,
      ip: device.ip || '-',
      deviceType: typeLabel[device.deviceType] ?? typeLabel.other,
      modelGroupName: device.modelGroupName || '未分类',
      category: device.category || '-',
      groupName: device.groupName || '-',
    },
  }))

  const tableState = isLoading ? 'loading' : filtered.length === 0 ? 'empty' : 'data'
  const emptyTitle = search || groupFilter !== 'all' ? `未找到包含“${search || '当前筛选'}”的设备` : '暂无设备'
  const emptyDescription =
    search || groupFilter !== 'all' ? '请调整搜索关键词或类型筛选。' : '点击右上角“新增设备”添加第一条设备记录。'

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-devices"
        layout="default"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="设备密码库"
            subtitle="集中管理服务器、网络、安全设备和云资源的访问凭证，点击设备查看详情与密码。"
            actions={
              <PermissionGuard resource="device" action="create">
                <Button className="cwgsyw-devices__create" type="button" size="sm" onClick={() => router.push('/devices/new')}>
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
                size="sm"
                value={search}
                placeholder="搜索名称、IP、分类、组…"
                aria-label="搜索设备名称、IP、分类或组"
                onChange={(event) => setSearch(event.target.value)}
                onClear={() => setSearch('')}
              />
            }
            filterItems={
              <Tabs
                style="cmdb"
                size="sm"
                value={groupFilter}
                onChange={setGroupFilter}
                items={[
                  { id: 'all', label: '全部', panel: null },
                  ...groupOptions.map((group) => ({ id: group.code, label: group.name, panel: null })),
                ]}
              />
            }
          />
        }
        content={
          isError ? (
            <ErrorState
              title="设备加载失败"
              description="无法读取设备列表，请稍后重试。"
              retry={
                <Button type="button" variant="secondary" size="sm" onClick={() => refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <Table
              className="cwgsyw-cmdb-table cwgsyw-devices__table"
              columns={columns}
              rows={rows}
              density="compact"
              showSearch={false}
              state={tableState}
              onRowClick={setSelectedId}
              loading={<LoadingState label="正在加载设备…" />}
              empty={
                <div className="cwgsyw-neutral-empty">
                  {/* Official 22px Figma key glyph; image optimization adds no value here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/figma-icons/cmdb-resource-key.svg" width={22} height={22} alt="" data-figma-node="6:27336" />
                  <EmptyState showIcon={false} title={emptyTitle} description={emptyDescription} />
                </div>
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
        className="cwgsyw-cmdb-preview-drawer"
        showClose
        title={selected?.name ?? '设备详情'}
        description={selected ? typeLabel[selected.deviceType] ?? typeLabel.other : undefined}
      >
        {selected ? (
          <CmdbInstancePreview
            description={selected.description}
            fields={[
              { label: 'IP 地址', value: selected.ip || '-' },
              { label: '类型', value: typeLabel[selected.deviceType] ?? typeLabel.other },
              { label: '分类', value: selected.category || '-' },
              { label: '所属组', value: selected.groupName || '-' },
              { label: '模型分组', value: selected.modelGroupName || '未分类' },
              { label: '设备 ID', value: selected.id },
            ]}
            actions={
              <Button type="button" size="sm" onClick={() => router.push(`/devices/${selected.id}`)}>
                查看凭证与详情
              </Button>
            }
          />
        ) : null}
      </NeutralDrawer>
    </>
  )
}
