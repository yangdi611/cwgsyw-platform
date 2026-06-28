'use client'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { Search, ArrowRight, X } from 'lucide-react'

// 单接口失败不白屏
async function safe<T>(p: Promise<{ data: { data: T } }>): Promise<T | undefined> {
  try {
    return (await p).data.data
  } catch {
    return undefined
  }
}

interface CiModelVO {
  modelId: string
  name: string
  displayName: string
  group: string
  groupName: string
  color: string | null
  instanceCount: number
}
interface ModelGroupVO {
  code: string
  name: string
  sortOrder: number
}
interface SearchHitVO {
  id: number
  name: string
  modelId: string
  modelName: string
  /** 后端返回的命中片段（属性值匹配时，如 "inner_ip: 10.0.0.1"）。 */
  snippet?: string | null
}
interface RecentInstanceVO {
  id: number
  name: string
  modelId: string
  modelName: string
  status: string
  updatedAt: string
}

function timeAgo(iso: string): string {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

export default function CmdbOverviewPage() {
  const [keyword, setKeyword] = useState('')
  // 当前打开的分类文件夹（group code），null 表示未打开
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  const { data: modelsData } = useQuery<{ records: CiModelVO[]; total: number } | undefined>({
    queryKey: ['cmdb-models-overview'],
    queryFn: () => safe(api.get('/cmdb/models', { params: { size: 100 } })),
  })
  const { data: groupsData } = useQuery<ModelGroupVO[] | undefined>({
    queryKey: ['cmdb-model-groups-overview'],
    queryFn: () => safe(api.get('/cmdb/model-groups')),
  })
  const { data: searchRes } = useQuery<{ records: SearchHitVO[] } | undefined>({
    queryKey: ['cmdb-instances-search-overview', keyword],
    queryFn: () => safe(api.get('/cmdb/instances/search', { params: { keyword, size: 10 } })),
    enabled: keyword.trim().length >= 1,
  })
  const { data: recentData } = useQuery<{ records: RecentInstanceVO[] } | undefined>({
    queryKey: ['cmdb-instances-recent'],
    queryFn: () => safe(api.get('/cmdb/instances', { params: { page: 1, size: 20 } })),
  })

  const modelList = modelsData?.records ?? []
  const searchHits = searchRes?.records ?? []
  const recent = (recentData?.records ?? [])
    .slice()
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 10)

  // 按分类聚合模型：分类顺序以 model-groups 的 sortOrder 为准，
  // 未在分类表中的（含无 group 的）兜底到「未分类」。
  const folders = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string; sortOrder: number; models: CiModelVO[] }>()
    for (const g of groupsData ?? []) {
      byCode.set(g.code, { code: g.code, name: g.name, sortOrder: g.sortOrder ?? 999, models: [] })
    }
    for (const m of modelList) {
      const code = m.group || '__ungrouped__'
      if (!byCode.has(code)) {
        byCode.set(code, { code, name: m.groupName || '未分类', sortOrder: 998, models: [] })
      }
      byCode.get(code)!.models.push(m)
    }
    return [...byCode.values()]
      .filter(f => f.models.length > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  }, [groupsData, modelList])

  const activeFolder = folders.find(f => f.code === openGroup) ?? null

  // Esc 关闭浮层
  useEffect(() => {
    if (!openGroup) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenGroup(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openGroup])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CMDB"
        title="概览"
        subtitle="跨模型搜索 CI、查看各类模型实例统计与近期更新的实例。"
      />

      {/* 搜索 */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-3 h-4 w-4 text-v2-muted" />
            <Input
              className="pl-9"
              placeholder="搜索 CI 名称、IP 或属性…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          {keyword.trim().length >= 1 && (
            <div className="mt-3 max-w-xl">
              {searchHits.length === 0 ? (
                <p className="px-2 py-3 text-sm text-v2-muted">无匹配的 CI</p>
              ) : (
                <div className="divide-y divide-v2-border rounded-v2-md border border-v2-border bg-v2-surface">
                  {searchHits.map((hit) => (
                    <Link
                      key={hit.id}
                      href={`/cmdb/instances/by-model/${hit.modelId}/${hit.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-v2-surface-hover transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-v2-fg">{hit.name}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-xs text-v2-muted">{hit.modelName}</span>
                          {hit.snippet && (
                            <span className="shrink-0 truncate rounded bg-v2-primary/10 px-1.5 py-0.5 text-[11px] font-mono text-v2-primary font-v2-mono">
                              {hit.snippet}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-v2-muted" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 各类模型 —— 分类文件夹，点开看该类下的模型 */}
      <div>
        <h2 className="mb-3 text-base font-bold text-v2-fg">各类模型</h2>
        {folders.length === 0 ? (
          <p className="rounded-v2-md border border-v2-border bg-v2-surface px-4 py-8 text-center text-sm text-v2-muted">
            暂无模型
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {folders.map((f) => {
              const instTotal = f.models.reduce((s, m) => s + (m.instanceCount ?? 0), 0)
              return (
                <button
                  key={f.code}
                  type="button"
                  onClick={() => setOpenGroup(f.code)}
                  className="group flex flex-col rounded-v2-md border border-v2-border bg-v2-surface p-4 text-left transition-all hover:border-v2-primary-border hover:shadow-v2-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary"
                  aria-label={`打开分类 ${f.name}，含 ${f.models.length} 个模型`}
                >
                  <FolderMosaic models={f.models} />
                  <div className="mt-3 truncate text-sm font-semibold text-v2-fg">{f.name}</div>
                  <div className="mt-0.5 text-xs text-v2-muted">
                    {f.models.length} 个模型
                    <span className="mx-1 text-v2-border-strong">·</span>
                    <span className="tabular-nums font-v2-mono">{instTotal}</span> 实例
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 打开的文件夹浮层 */}
      {activeFolder && (
        <FolderOverlay folder={activeFolder} onClose={() => setOpenGroup(null)} />
      )}


      {/* 近期更新的 CI */}
      <Card>
        <CardHeader>
          <CardTitle>近期更新的 CI</CardTitle>
          <p className="mt-1 text-sm text-v2-muted">最近被修改的实例（前 10 条）。</p>
        </CardHeader>
        <div className="overflow-x-auto">
          {recent.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-v2-muted">暂无实例</p>
          ) : (
            <table className="w-full">
              <thead className="bg-v2-surface-soft">
                <tr>
                  {['实例', '模型', '更新时间'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-v2-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-v2-border hover:bg-v2-surface-hover transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/cmdb/instances/by-model/${r.modelId}/${r.id}`}
                        className="text-sm font-semibold text-v2-primary hover:text-v2-primary-hover"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-v2-fg">{r.modelName}</td>
                    <td className="px-4 py-3 text-sm text-v2-muted whitespace-nowrap">
                      {timeAgo(r.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  )
}

const FALLBACK_COLOR = '#94a3b8'

/**
 * 文件夹色块马赛克：取该分类前 4 个模型的品牌色拼成 2×2 网格（iOS 文件夹隐喻）。
 * 不足 4 个用占位空格补满；缺色的模型用中性灰兜底。
 */
function FolderMosaic({ models }: { models: CiModelVO[] }) {
  const cells = Array.from({ length: 4 }, (_, i) => models[i])
  return (
    <div className="grid h-14 w-14 grid-cols-2 grid-rows-2 gap-1 rounded-[10px] bg-v2-surface-soft p-1 ring-1 ring-v2-border">
      {cells.map((m, i) => (
        <span
          key={m?.modelId ?? `empty-${i}`}
          className="rounded-[3px]"
          style={{ backgroundColor: m ? (m.color || FALLBACK_COLOR) : 'transparent' }}
        />
      ))}
    </div>
  )
}

/**
 * 打开的分类文件夹浮层：背景模糊变暗，中间浮出该类所有模型的磁贴。
 * 点磁贴进实例列表；点背景 / 关闭按钮 / Esc 关闭。
 */
function FolderOverlay({
  folder, onClose,
}: {
  folder: { code: string; name: string; models: CiModelVO[] }
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`分类 ${folder.name}`}
    >
      <div className="absolute inset-0 bg-v2-fg/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl rounded-v2-lg border border-v2-border bg-v2-surface p-6 shadow-v2-md motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-v2-fg">{folder.name}</h3>
            <p className="mt-0.5 text-xs text-v2-muted">{folder.models.length} 个模型</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="inline-flex h-8 w-8 items-center justify-center rounded-v2-md text-v2-muted transition-colors hover:bg-v2-surface-hover hover:text-v2-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {folder.models.map((m) => (
            <Link
              key={m.modelId}
              href={`/cmdb/instances/by-model/${m.modelId}`}
              className="group flex items-center gap-3 rounded-v2-md border border-v2-border bg-v2-surface-soft p-3 transition-all hover:border-v2-primary-border hover:bg-v2-surface-hover"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-v2-md text-sm font-bold text-white"
                style={{ backgroundColor: m.color || FALLBACK_COLOR }}
              >
                {(m.displayName || m.name).slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-v2-fg">{m.displayName || m.name}</div>
                <div className="text-xs text-v2-muted">
                  <span className="tabular-nums font-v2-mono">{m.instanceCount ?? 0}</span> 实例
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
