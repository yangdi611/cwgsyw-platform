'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import InstanceBrowserSection from '@/components/cmdb/InstanceBrowserSection'
import type { CiModelSummary } from '@/types/cmdb-model'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Card,
  Chip,
  DashboardFeedbackPage,
  EmptyState,
  MetricCard,
  PageHeader,
} from '@/design-system/figma-neutral/components'

async function safe<T>(p: Promise<{ data: { data: T } }>): Promise<T | undefined> {
  try {
    return (await p).data.data
  } catch {
    return undefined
  }
}

interface ModelGroupVO {
  code: string
  name: string
  sortOrder: number
}

interface ModelGroupSection {
  code: string
  name: string
  sortOrder: number
  models: CiModelSummary[]
  modelCount: number
  instanceCount: number
  attributeCount: number
  description: string
}

const GROUP_DESCRIPTION_BY_CODE: Record<string, string> = {
  hardware: '服务器、网络、安全与存储硬件资产。',
  middleware: '运行时、缓存、消息队列与网关组件。',
  datacenter: '机房、机柜、区域与链路等物理空间模型。',
  cloud: '虚拟资源、云主机与资源池入口。',
  database: '关系型与非关系型数据库模型。',
  apps: '业务应用与服务目录。',
}

function getAttributeCount(model: CiModelSummary): number {
  return Array.isArray(model.attributes) ? model.attributes.length : 0
}

function getGroupDescription(code: string, name: string): string {
  return GROUP_DESCRIPTION_BY_CODE[code] || `${name}下的 CI 模型与实例入口。`
}

export default function CmdbOverviewPage() {
  const { hasPermission } = usePermission()
  const [activeGroupCode, setActiveGroupCode] = useState<string | null>(null)

  const { data: modelsData } = useQuery<{ records: CiModelSummary[]; total: number } | undefined>({
    queryKey: ['cmdb-models-overview'],
    queryFn: () => safe(api.get('/cmdb/models', { params: { size: 100 } })),
    enabled: hasPermission('cmdb_model', 'read'),
  })
  const { data: groupsData } = useQuery<ModelGroupVO[] | undefined>({
    queryKey: ['cmdb-model-groups-overview'],
    queryFn: () => safe(api.get('/cmdb/model-groups')),
    enabled: hasPermission('cmdb_model', 'read'),
  })

  const modelList = useMemo(() => modelsData?.records ?? [], [modelsData?.records])

  const groupSections = useMemo(() => {
    const byCode = new Map<string, Omit<ModelGroupSection, 'description' | 'modelCount' | 'instanceCount' | 'attributeCount'>>()

    for (const g of groupsData ?? []) {
      byCode.set(g.code, {
        code: g.code,
        name: g.name,
        sortOrder: g.sortOrder ?? 999,
        models: [],
      })
    }

    for (const m of modelList) {
      const code = m.group || '__ungrouped__'
      if (!byCode.has(code)) {
        byCode.set(code, {
          code,
          name: m.groupName || '未分类',
          sortOrder: 998,
          models: [],
        })
      }
      byCode.get(code)!.models.push(m)
    }

    return [...byCode.values()]
      .filter((g) => g.models.length > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((g): ModelGroupSection => {
        const modelCount = g.models.length
        const instanceCount = g.models.reduce((sum, m) => sum + (m.instanceCount ?? 0), 0)
        const attributeCount = g.models.reduce((sum, m) => sum + getAttributeCount(m), 0)
        return {
          ...g,
          modelCount,
          instanceCount,
          attributeCount,
          description: getGroupDescription(g.code, g.name),
        }
      })
  }, [groupsData, modelList])

  const activeGroup = useMemo(() => {
    if (groupSections.length === 0) return null
    return groupSections.find((g) => g.code === activeGroupCode) ?? groupSections[0]
  }, [groupSections, activeGroupCode])

  const totalModels = groupSections.reduce((sum, g) => sum + g.modelCount, 0)
  const totalInstances = groupSections.reduce((sum, g) => sum + g.instanceCount, 0)

  return (
    <DashboardFeedbackPage
      header={
        <PageHeader
          eyebrow="CMDB"
          title="概览"
          subtitle="统一查看 CMDB 模型分类、实例浏览与近期 CI 动态。"
          breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: 'CMDB' }]} />}
        />
      }
      metrics={
        <div className="cwgsyw-filter-grid">
          <MetricCard label="分类" value={String(groupSections.length)} />
          <MetricCard label="模型" value={String(totalModels)} />
          <MetricCard label="实例" value={String(totalInstances)} />
        </div>
      }
      feedback={
        <Card title="各类模型" description="按模型组浏览资产目录。分类用结构区分，不再用彩色色块表达归属。">
          {groupSections.length === 0 ? (
            <EmptyState title="暂无模型" description="还没有可浏览的 CI 模型组。" />
          ) : (
            <div className="cwgsyw-form">
              <div className="cwgsyw-inline-controls" role="tablist" aria-label="CMDB 模型组">
                {groupSections.map((group) => (
                  <Chip
                    key={group.code}
                    label={group.name}
                    selected={activeGroup?.code === group.code}
                    onClick={() => setActiveGroupCode(group.code)}
                  />
                ))}
              </div>
              {activeGroup ? (
                <div role="tabpanel" aria-label={activeGroup.name} className="cwgsyw-form">
                  <p className="cwgsyw-type-body-sm">{activeGroup.description}</p>
                  <div className="cwgsyw-filter-grid">
                    <MetricCard label="模型" value={String(activeGroup.modelCount)} />
                    <MetricCard label="实例" value={String(activeGroup.instanceCount)} />
                    <MetricCard label="字段" value={String(activeGroup.attributeCount)} />
                  </div>
                  <div className="cwgsyw-filter-grid">
                    {activeGroup.models.map((model) => (
                      <Link
                        key={model.modelId}
                        href={`/cmdb/instances/by-model/${model.modelId}`}
                        className="cwgsyw-card cwgsyw-card--md"
                      >
                        <strong className="cwgsyw-type-title-sm">{model.displayName || model.name}</strong>
                        <span className="cwgsyw-type-body-sm">
                          {model.instanceCount ?? 0} 实例 · {getAttributeCount(model)} 字段
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      }
      supporting={<InstanceBrowserSection />}
    />
  )
}
