'use client'
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardHeader, CardContent } from '@/components/v2/Card'
import InstanceBrowserSection from '@/components/cmdb/InstanceBrowserSection'
import type { CiModelSummary } from '@/types/cmdb-model'

// 单接口失败不白屏
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

interface GroupPalette {
  tone: string
  toneSoft: string
  tint: string
  glow: string
  modelColors: string[]
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
  palette: GroupPalette
}

// 模型组色系定义
const GROUP_PALETTES: GroupPalette[] = [
  {
    tone: '#2563eb',
    toneSoft: '#60a5fa',
    tint: 'rgba(37, 99, 235, 0.08)',
    glow: 'rgba(37, 99, 235, 0.22)',
    modelColors: ['#1d4ed8', '#2563eb', '#0284c7', '#4338ca'],
  },
  {
    tone: '#16a34a',
    toneSoft: '#4ade80',
    tint: 'rgba(22, 163, 74, 0.08)',
    glow: 'rgba(22, 163, 74, 0.22)',
    modelColors: ['#15803d', '#16a34a', '#059669', '#0d9488'],
  },
  {
    tone: '#dc2626',
    toneSoft: '#f87171',
    tint: 'rgba(220, 38, 38, 0.08)',
    glow: 'rgba(220, 38, 38, 0.22)',
    modelColors: ['#b91c1c', '#dc2626', '#e11d48', '#c026d3'],
  },
  {
    tone: '#ea580c',
    toneSoft: '#fb923c',
    tint: 'rgba(234, 88, 12, 0.08)',
    glow: 'rgba(234, 88, 12, 0.22)',
    modelColors: ['#c2410c', '#ea580c', '#d97706', '#ca8a04'],
  },
  {
    tone: '#7c3aed',
    toneSoft: '#a78bfa',
    tint: 'rgba(124, 58, 237, 0.08)',
    glow: 'rgba(124, 58, 237, 0.22)',
    modelColors: ['#6d28d9', '#7c3aed', '#8b5cf6', '#a855f7'],
  },
  {
    tone: '#0891b2',
    toneSoft: '#22d3ee',
    tint: 'rgba(8, 145, 178, 0.08)',
    glow: 'rgba(8, 145, 178, 0.22)',
    modelColors: ['#0e7490', '#0891b2', '#06b6d4', '#14b8a6'],
  },
]

const GROUP_PALETTE_BY_CODE: Record<string, GroupPalette> = {
  hardware: GROUP_PALETTES[0],
  middleware: GROUP_PALETTES[1],
  datacenter: GROUP_PALETTES[2],
  cloud: GROUP_PALETTES[3],
  database: GROUP_PALETTES[4],
  apps: GROUP_PALETTES[5],
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

function getGroupPalette(code: string, index: number): GroupPalette {
  return GROUP_PALETTE_BY_CODE[code] || GROUP_PALETTES[index % GROUP_PALETTES.length]
}

function getModelColor(group: ModelGroupSection, modelIndex: number): string {
  return group.palette.modelColors[modelIndex % group.palette.modelColors.length] || group.palette.tone
}

function getModelInitial(model: CiModelSummary): string {
  const text = (model.displayName || model.name || model.modelId || '?').trim()
  return text.slice(0, 1).toUpperCase()
}

function getPaletteVars(palette: GroupPalette): React.CSSProperties {
  return {
    '--cmdb-tone': palette.tone,
    '--cmdb-tone-soft': palette.toneSoft,
    '--cmdb-tint': palette.tint,
    '--cmdb-glow': palette.glow,
  } as React.CSSProperties
}

export default function CmdbOverviewPage() {
  const [activeGroupCode, setActiveGroupCode] = useState<string | null>(null)

  const { data: modelsData } = useQuery<{ records: CiModelSummary[]; total: number } | undefined>({
    queryKey: ['cmdb-models-overview'],
    queryFn: () => safe(api.get('/cmdb/models', { params: { size: 100 } })),
  })
  const { data: groupsData } = useQuery<ModelGroupVO[] | undefined>({
    queryKey: ['cmdb-model-groups-overview'],
    queryFn: () => safe(api.get('/cmdb/model-groups')),
  })

  const modelList = useMemo(() => modelsData?.records ?? [], [modelsData?.records])

  // 聚合模型组
  const groupSections = useMemo(() => {
    const byCode = new Map<string, Omit<ModelGroupSection, 'palette' | 'description' | 'modelCount' | 'instanceCount' | 'attributeCount'>>()

    for (const g of groupsData ?? []) {
      byCode.set(g.code, {
        code: g.code,
        name: g.name,
        sortOrder: g.sortOrder ?? 999,
        models: []
      })
    }

    for (const m of modelList) {
      const code = m.group || '__ungrouped__'
      if (!byCode.has(code)) {
        byCode.set(code, {
          code,
          name: m.groupName || '未分类',
          sortOrder: 998,
          models: []
        })
      }
      byCode.get(code)!.models.push(m)
    }

    return [...byCode.values()]
      .filter(g => g.models.length > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((g, index): ModelGroupSection => {
        const modelCount = g.models.length
        const instanceCount = g.models.reduce((sum, m) => sum + (m.instanceCount ?? 0), 0)
        const attributeCount = g.models.reduce((sum, m) => sum + getAttributeCount(m), 0)
        return {
          ...g,
          modelCount,
          instanceCount,
          attributeCount,
          description: getGroupDescription(g.code, g.name),
          palette: getGroupPalette(g.code, index),
        }
      })
  }, [groupsData, modelList])

  // 派生当前选中组
  const activeGroup = useMemo(() => {
    if (groupSections.length === 0) return null
    return groupSections.find(g => g.code === activeGroupCode) ?? groupSections[0]
  }, [groupSections, activeGroupCode])

  const totalModels = groupSections.reduce((sum, g) => sum + g.modelCount, 0)
  const totalInstances = groupSections.reduce((sum, g) => sum + g.instanceCount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CMDB"
        title="概览"
        subtitle="统一查看 CMDB 模型分类、实例浏览与近期 CI 动态。"
      />

      <ModelGroupCatalog
        groups={groupSections}
        activeGroup={activeGroup}
        totalModels={totalModels}
        totalInstances={totalInstances}
        onActiveGroupChange={setActiveGroupCode}
      />

      <InstanceBrowserSection />
    </div>
  )
}

function ModelGroupCatalog({
  groups,
  activeGroup,
  totalModels,
  totalInstances,
  onActiveGroupChange,
}: {
  groups: ModelGroupSection[]
  activeGroup: ModelGroupSection | null
  totalModels: number
  totalInstances: number
  onActiveGroupChange: (code: string) => void
}) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-v2-fg">各类模型</h2>
              <p className="mt-1 text-xs text-v2-muted">按模型组浏览资产目录；颜色只表达分类归属。</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="px-6 py-10 text-center text-sm text-v2-muted">
            暂无模型
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <style jsx>{`
        @keyframes cmdbModelGroupFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 220% 50%; }
        }
        .cmdb-model-group-active-line {
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 0;
          height: 3px;
          border-radius: 999px 999px 0 0;
          background: linear-gradient(90deg, var(--cmdb-tone), var(--cmdb-tone-soft), var(--cmdb-tone));
          background-size: 220% 100%;
          animation: cmdbModelGroupFlow 5s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cmdb-model-group-active-line {
            animation: none;
          }
        }
      `}</style>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-v2-fg">各类模型</h2>
              <p className="mt-1 text-xs text-v2-muted">按模型组浏览资产目录；颜色只表达分类归属。</p>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-v2-border bg-v2-surface-soft px-3 py-1 text-xs font-medium text-v2-muted">
              <span>{groups.length} 分类</span>
              <span className="text-v2-border-strong">·</span>
              <span>{totalModels} 模型</span>
              <span className="text-v2-border-strong">·</span>
              <span>{totalInstances} 实例</span>
            </div>
          </div>
        </CardHeader>

        <div
          className="grid overflow-x-auto border-b border-v2-border bg-v2-surface-soft"
          style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(126px, 1fr))` }}
          role="tablist"
          aria-label="CMDB 模型组"
        >
          {groups.map((group) => {
            const isActive = activeGroup?.code === group.code
            return (
              <button
                key={group.code}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`cmdb-model-group-panel-${group.code}`}
                id={`cmdb-model-group-tab-${group.code}`}
                onClick={() => onActiveGroupChange(group.code)}
                className={cn(
                  'relative min-h-[58px] min-w-[126px] border-r border-v2-border px-3.5 py-3 text-left transition-colors last:border-r-0',
                  isActive ? 'bg-v2-surface' : 'bg-transparent hover:bg-v2-surface-hover',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary focus-visible:ring-inset'
                )}
                style={getPaletteVars(group.palette)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-4 w-8 shrink-0 rounded-full"
                    style={{ backgroundColor: group.palette.tone }}
                  />
                  <span className="truncate text-sm font-semibold text-v2-fg">{group.name}</span>
                </span>
                {isActive && <span className="cmdb-model-group-active-line" aria-hidden="true" />}
              </button>
            )
          })}
        </div>

        {activeGroup && (
          <div
            role="tabpanel"
            id={`cmdb-model-group-panel-${activeGroup.code}`}
            aria-labelledby={`cmdb-model-group-tab-${activeGroup.code}`}
            className="p-5"
          >
            <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div
                className="flex min-h-[76px] items-center rounded-v2-md border border-v2-border border-l-4 bg-v2-surface px-4 py-3"
                style={{
                  borderLeftColor: activeGroup.palette.tone,
                  background: `linear-gradient(90deg, ${activeGroup.palette.tint}, transparent)`
                }}
              >
                <p className="text-sm leading-relaxed text-v2-muted">{activeGroup.description}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Metric label="模型" value={activeGroup.modelCount} />
                <Metric label="实例" value={activeGroup.instanceCount} />
                <Metric label="字段" value={activeGroup.attributeCount} />
              </div>
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {activeGroup.models.map((model, index) => (
                <ModelCard
                  key={model.modelId}
                  model={model}
                  color={getModelColor(activeGroup, index)}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-[72px] flex-col items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface-soft px-3 py-2.5">
      <div className="text-xs text-v2-muted">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums text-v2-fg">{value}</div>
    </div>
  )
}

function ModelCard({
  model,
  color,
  index,
}: {
  model: CiModelSummary
  color: string
  index: number
}) {
  const attrCount = getAttributeCount(model)
  return (
    <Link
      href={`/cmdb/instances/by-model/${model.modelId}`}
      className="group grid min-h-[86px] grid-cols-[36px_minmax(0,1fr)] gap-2.5 rounded-v2-md border border-v2-border bg-v2-surface p-3 transition-all hover:-translate-y-0.5 hover:shadow-v2-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-v2-md text-base font-extrabold leading-none text-white"
        style={{ backgroundColor: color }}
      >
        {getModelInitial(model)}
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-v2-fg">
            {model.displayName || model.name}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-v2-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            可浏览
          </span>
        </span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-v2-border bg-v2-surface-soft px-2 py-0.5 text-[11px] text-v2-muted">
            {model.instanceCount ?? 0} 实例
          </span>
          <span className="rounded-full border border-v2-border bg-v2-surface-soft px-2 py-0.5 text-[11px] text-v2-muted">
            {attrCount} 字段
          </span>
        </span>
      </span>
    </Link>
  )
}
