'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import type { CiModelSummary } from '@/types/cmdb-model'
import { CmdbInstancePreview } from '@/components/cmdb/CmdbInstancePreview'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Chip,
  EmptyState,
  Icon,
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
  const isDefaultState = model === '' && keyword.trim() === '' && status === ''

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
    <section className="cwgsyw-instance-browser" aria-labelledby="cmdb-instance-browser-title">
      <div className="cwgsyw-instance-browser__header">
        <div className="cwgsyw-cmdb-overview__catalog-title">
          <h2 id="cmdb-instance-browser-title" className="cwgsyw-type-title-sm">实例浏览</h2>
          <span className="cwgsyw-cmdb-overview__catalog-note">
            <Icon name="chevron-next" size="sm" aria-hidden="true" />
            <span>默认显示最近更新的 CI，可按模型、关键词和状态筛选。</span>
            <Icon name="chevron-previous" size="sm" aria-hidden="true" />
          </span>
        </div>
      </div>
      <div className="cwgsyw-instance-browser__filters" aria-label="实例筛选">
        <Select
          overlay
          size="sm"
          value={model || '__all__'}
          placeholder="全部模型"
          options={[
            { value: '__all__', label: '全部模型' },
            ...models.map((item) => ({ value: item.modelId, label: item.displayName || item.name })),
          ]}
          onChange={(value) => setModel(value === '__all__' ? '' : value)}
        />
        <div className="cwgsyw-instance-browser__search">
          <SearchInput
            size="sm"
            value={keyword}
            placeholder="搜索实例名称..."
            onChange={(event) => setKeyword(event.target.value)}
            onClear={() => setKeyword('')}
          />
        </div>
        <Select
          overlay
          size="sm"
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
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isDefaultState}
          onClick={() => {
            setModel('')
            setKeyword('')
            setStatus('')
          }}
        >
          重置筛选
        </Button>
      </div>

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
        <div className="cwgsyw-instance-browser__table cwgsyw-cmdb-table">
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
        </div>
      )}

      <NeutralDrawer
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        className="cwgsyw-cmdb-preview-drawer"
        showClose
        title={selected?.name ?? '实例详情'}
        description={selected ? `${selected.modelName}${selected.status ? ` · ${statusMeta(selected.status).label}` : ''}` : undefined}
      >
        {selected ? (
          <CmdbInstancePreview
            description={selected.description}
            fields={[
              { label: '模型', value: selected.modelName },
              { label: '状态', value: selected.status ? statusMeta(selected.status).label : '-' },
              { label: '负责人', value: selected.owner || '-' },
              { label: '实例 ID', value: selected.id },
              { label: '创建时间', value: formatTime(selected.createdAt) },
              { label: '更新时间', value: formatTime(selected.updatedAt) },
            ]}
            extraFields={selectedFields.map(([key, value]) => ({
              label: getAttrLabel(selected.modelId, key),
              value: formatValue(value),
            }))}
            actions={
              <>
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
              </>
            }
          />
        ) : null}
      </NeutralDrawer>
    </section>
  )
}
