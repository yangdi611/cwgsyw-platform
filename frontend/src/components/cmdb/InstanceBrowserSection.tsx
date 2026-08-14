'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import type { CiModelSummary } from '@/types/cmdb-model'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  FilterBar,
  LoadingState,
  NeutralDrawer,
  SearchInput,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

interface CiInstanceVO {
  id: number
  name: string
  modelId: string
  modelName: string
  status: string
  owner: string
  description: string
  fieldsData: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral'

function statusMeta(status: string): { tone: StatusTone; label: string } {
  const s = (status || '').toLowerCase()
  if (['running', 'active', 'online', 'up', 'healthy', 'ok', 'in_service', 'inservice', 'running中'].includes(s))
    return { tone: 'success', label: '运行中' }
  if (['stopped', 'offline', 'down', 'inactive', 'fault', 'error', 'out_of_service', 'failed'].includes(s))
    return { tone: 'danger', label: '已停用' }
  if (['maintenance', 'pending', 'warning', 'degraded', 'standby', 'paused'].includes(s))
    return { tone: 'warning', label: '维护中' }
  return { tone: 'neutral', label: status || '未知' }
}

function formatTime(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN')
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export default function InstanceBrowserSection() {
  const router = useRouter()
  const { hasPermission } = usePermission()

  const [model, setModel] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<CiInstanceVO | null>(null)

  const { data: models = [] } = useQuery<CiModelSummary[]>({
    queryKey: ['cmdb-models-all'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models', { params: { size: 100 } })
        return r.data.data.records
      } catch {
        return []
      }
    },
    enabled: hasPermission('cmdb_model', 'read'),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['cmdb-overview-instance-browser', model, keyword, status],
    queryFn: () =>
      api
        .get('/cmdb/instances', {
          params: {
            model: model || undefined,
            keyword: keyword || undefined,
            status: status || undefined,
            page: 1,
            size: 10,
          },
        })
        .then((r) => r.data.data),
    enabled: hasPermission('cmdb_instance', 'read'),
  })

  const instances = (data?.records ?? []) as CiInstanceVO[]

  const getAttrLabel = (modelId: string, key: string): string => {
    const current = models.find((item) => item.modelId === modelId)
    const attr = current?.attributes?.find((item) => (item.fieldKey ?? item.id.toString()) === key)
    return attr?.name ?? key
  }

  const selectedFields = selected ? Object.entries(selected.fieldsData ?? {}).slice(0, 8) : []
  const canExport = hasPermission('cmdb_instance', 'export')
  const isDefaultState = model === '' && keyword.trim() === '' && status === ''

  const downloadExport = async () => {
    const params = new URLSearchParams()
    if (model) params.set('model', model)
    if (keyword) params.set('keyword', keyword)
    if (status) params.set('status', status)
    const response = await api.get(`/cmdb/instances/export?${params.toString()}`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cmdb-instances.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const rows = instances.map((item) => ({
    id: String(item.id),
    selected: selected?.id === item.id,
    cells: {
      name: item.name,
      modelName: <Chip label={item.modelName} />,
      status: item.status ? (
        <StatusBadge label={statusMeta(item.status).label} status={statusMeta(item.status).tone} />
      ) : (
        '-'
      ),
      owner: item.owner || '-',
      updatedAt: formatTime(item.updatedAt),
    },
  }))

  return (
    <Card title="实例浏览" description="默认显示最近更新的 CI，可按模型、关键词和状态筛选。">
      <FilterBar
        search={
          <SearchInput
            value={keyword}
            placeholder="搜索实例名称..."
            onChange={(event) => setKeyword(event.target.value)}
            onClear={() => setKeyword('')}
          />
        }
        filterItems={
          <div className="cwgsyw-inline-controls">
            <Select
              value={model || '__all__'}
              placeholder="全部模型"
              options={[
                { value: '__all__', label: '全部模型' },
                ...models.map((item) => ({ value: item.modelId, label: item.displayName || item.name })),
              ]}
              onChange={(value) => setModel(value === '__all__' ? '' : value)}
            />
            <Select
              value={status || '__all__'}
              placeholder="全部状态"
              options={[
                { value: '__all__', label: '全部状态' },
                { value: 'running', label: '运行中' },
                { value: 'stopped', label: '已停用' },
                { value: 'maintenance', label: '维护中' },
              ]}
              onChange={(value) => setStatus(value === '__all__' ? '' : value)}
            />
          </div>
        }
        actions={
          canExport ? (
            <Button type="button" variant="secondary" size="sm" onClick={downloadExport}>
              导出 CSV
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingState label="加载实例" />
      ) : instances.length === 0 ? (
        <EmptyState
          title={isDefaultState ? '暂无实例' : '暂无匹配实例'}
          description={
            isDefaultState
              ? '请先从上方模型分类进入具体模型后新建 CI。'
              : '请调整模型、关键词或状态筛选。'
          }
        />
      ) : (
        <Table
          showSearch={false}
          columns={[
            { key: 'name', label: '实例名称' },
            { key: 'modelName', label: '模型' },
            { key: 'status', label: '状态' },
            { key: 'owner', label: '负责人' },
            { key: 'updatedAt', label: '更新时间' },
          ]}
          rows={rows}
          onRowClick={(id) => {
            const hit = instances.find((item) => String(item.id) === id)
            if (hit) setSelected(hit)
          }}
        />
      )}

      <NeutralDrawer
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.name ?? '实例详情'}
        description={selected ? `${selected.modelName}${selected.status ? ` · ${statusMeta(selected.status).label}` : ''}` : undefined}
      >
        {selected ? (
          <div className="cwgsyw-form">
            {selected.description ? (
              <Card showHeader={false} padding="sm">
                <div className="cwgsyw-type-label-xs">描述</div>
                <p className="cwgsyw-type-body-sm">{selected.description}</p>
              </Card>
            ) : null}

            <div className="cwgsyw-filter-grid">
              <div>
                <div className="cwgsyw-type-label-xs">模型</div>
                <div className="cwgsyw-type-body-sm">{selected.modelName}</div>
              </div>
              <div>
                <div className="cwgsyw-type-label-xs">状态</div>
                <div className="cwgsyw-type-body-sm">{selected.status ? statusMeta(selected.status).label : '-'}</div>
              </div>
              <div>
                <div className="cwgsyw-type-label-xs">负责人</div>
                <div className="cwgsyw-type-body-sm">{selected.owner || '-'}</div>
              </div>
              <div>
                <div className="cwgsyw-type-label-xs">实例 ID</div>
                <div className="cwgsyw-type-body-sm">{selected.id}</div>
              </div>
              <div>
                <div className="cwgsyw-type-label-xs">创建时间</div>
                <div className="cwgsyw-type-body-sm">{formatTime(selected.createdAt)}</div>
              </div>
              <div>
                <div className="cwgsyw-type-label-xs">更新时间</div>
                <div className="cwgsyw-type-body-sm">{formatTime(selected.updatedAt)}</div>
              </div>
            </div>

            {selectedFields.length > 0 ? (
              <div className="cwgsyw-form">
                <div className="cwgsyw-type-label-xs">关键属性</div>
                {selectedFields.map(([key, value]) => (
                  <div key={key} className="cwgsyw-inline-controls">
                    <span className="cwgsyw-type-label-sm">{getAttrLabel(selected.modelId, key)}</span>
                    <span className="cwgsyw-type-body-sm">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="cwgsyw-inline-controls">
              {hasPermission('cmdb_topology', 'read') ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/cmdb/topology/${selected.id}`)}>
                  查看拓扑
                </Button>
              ) : null}
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => router.push(`/cmdb/instances/by-model/${selected.modelId}/${selected.id}`)}
              >
                完整详情
              </Button>
            </div>
          </div>
        ) : null}
      </NeutralDrawer>
    </Card>
  )
}
