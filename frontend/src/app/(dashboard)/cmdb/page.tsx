'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { MotionConfig, motion } from 'motion/react'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import InstanceBrowserSection from '@/components/cmdb/InstanceBrowserSection'
import type { CiModelSummary } from '@/types/cmdb-model'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  EmptyState,
  Icon,
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
  const activeGroupIndex = Math.max(0, groupSections.findIndex((group) => group.code === activeGroup?.code))

  const totalModels = groupSections.reduce((sum, group) => sum + group.modelCount, 0)
  const totalInstances = groupSections.reduce((sum, group) => sum + group.instanceCount, 0)

  return (
    <div className="cwgsyw-page cwgsyw-cmdb-overview cwgsyw-cmdb-page">
      <h1 className="sr-only">CMDB</h1>
      <section className="cwgsyw-cmdb-overview__catalog" aria-labelledby="cmdb-model-catalog-title">
        <div className="cwgsyw-cmdb-overview__section-heading">
          <div className="cwgsyw-cmdb-overview__catalog-title">
            <h2 id="cmdb-model-catalog-title" className="cwgsyw-type-title-sm">各类模型</h2>
            <span className="cwgsyw-cmdb-overview__catalog-note">
              <Icon name="chevron-next" size="sm" aria-hidden="true" />
              <span>按模型组分类浏览资产目录。</span>
              <Icon name="chevron-previous" size="sm" aria-hidden="true" />
            </span>
          </div>
          <span className="cwgsyw-cmdb-overview__summary" aria-label={`${groupSections.length} 个分类，${totalModels} 个模型，${totalInstances} 个实例`}>
            {groupSections.length} 分类 · {totalModels} 模型 · {totalInstances} 实例
          </span>
        </div>

        {groupSections.length === 0 ? (
          <EmptyState title="暂无模型" description="还没有可浏览的 CI 模型组。" />
        ) : (
          <MotionConfig reducedMotion="user">
            <div
              className="cwgsyw-cmdb-overview__groups"
              role="tablist"
              aria-label="CMDB 模型组"
            >
              {groupSections.map((group) => (
                <Button
                  key={group.code}
                  id={`cmdb-model-group-tab-${group.code}`}
                  type="button"
                  variant="ghost"
                  size="sm"
                  role="tab"
                  className={`cwgsyw-cmdb-overview__group-tab${activeGroup?.code === group.code ? ' is-active' : ''}`}
                  aria-selected={activeGroup?.code === group.code}
                  aria-controls={`cmdb-model-group-panel-${group.code}`}
                  onClick={() => setActiveGroupCode(group.code)}
                >
                  {activeGroup?.code === group.code ? (
                    <motion.span
                      layoutId="cmdb-model-group-indicator"
                      aria-hidden="true"
                      className="cwgsyw-cmdb-overview__group-motion-indicator"
                      transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.6 }}
                    />
                  ) : null}
                  <span className="cwgsyw-cmdb-overview__group-tab-label">{group.name}</span>
                </Button>
              ))}
            </div>

            {activeGroup ? (
              <div className="cwgsyw-cmdb-overview__model-panels">
                <motion.div
                  className="cwgsyw-cmdb-overview__model-track"
                  animate={{ x: `${activeGroupIndex * -100}%` }}
                  transition={{ type: 'spring', stiffness: 180, damping: 26, bounce: 0, restDelta: 0.01 }}
                >
                  {groupSections.map((group) => (
                    <div
                      key={group.code}
                      id={`cmdb-model-group-panel-${group.code}`}
                      role="tabpanel"
                      aria-labelledby={`cmdb-model-group-tab-${group.code}`}
                      className="cwgsyw-cmdb-overview__model-grid"
                    >
                      {group.models.map((model) => (
                        <Link
                          key={model.modelId}
                          href={`/cmdb/instances/by-model/${model.modelId}`}
                          className="cwgsyw-cmdb-overview__model-tile"
                        >
                          <h3 className="cwgsyw-type-title-sm">{model.displayName || model.name}</h3>
                          <span className="cwgsyw-type-label-sm">
                            {model.instanceCount ?? 0} 实例 · {getAttributeCount(model)} 字段
                          </span>
                        </Link>
                      ))}
                    </div>
                  ))}
                </motion.div>
              </div>
            ) : null}
          </MotionConfig>
        )}
      </section>
      <InstanceBrowserSection />
    </div>
  )
}
