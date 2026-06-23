'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { Search, ArrowRight } from 'lucide-react'

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
  groupName: string
  instanceCount: number
}
interface SearchHitVO {
  id: number
  name: string
  model_id: string
  model_name: string
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

  const { data: modelsData } = useQuery<{ records: CiModelVO[]; total: number } | undefined>({
    queryKey: ['cmdb-models-overview'],
    queryFn: () => safe(api.get('/cmdb/models', { params: { size: 100 } })),
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
                      href={`/cmdb/instances/by-model/${hit.model_id}/${hit.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-v2-surface-hover transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-v2-fg">{hit.name}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-xs text-v2-muted">{hit.model_name}</span>
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

      {/* 各类模型统计 */}
      <div>
        <h2 className="mb-3 text-base font-bold text-v2-fg">各类模型</h2>
        {modelList.length === 0 ? (
          <p className="rounded-v2-md border border-v2-border bg-v2-surface px-4 py-8 text-center text-sm text-v2-muted">
            暂无模型
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {modelList.map((m) => (
              <Link
                key={m.modelId}
                href={`/cmdb/instances/by-model/${m.modelId}`}
                className="group rounded-v2-md border border-v2-border bg-v2-surface p-4 hover:border-v2-primary-border hover:shadow-v2-md transition-all"
              >
                <div className="text-3xl font-bold tabular-nums text-v2-fg font-v2-mono">
                  {m.instanceCount ?? 0}
                </div>
                <div className="mt-1 text-sm font-semibold text-v2-fg">
                  {m.displayName || m.name}
                </div>
                <div className="mt-0.5 text-xs text-v2-muted">{m.groupName || '未分类'}</div>
              </Link>
            ))}
          </div>
        )}
      </div>

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
