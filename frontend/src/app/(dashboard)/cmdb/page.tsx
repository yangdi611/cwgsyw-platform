'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Search, Box, Server, Database } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { useColumnConfig } from '@/hooks/useColumnConfig'
import { ColumnPicker, ColumnDef } from '@/components/cmdb/ColumnPicker'
import { cn } from '@/lib/utils'

interface CiInstanceSearchVO {
  id: number
  name: string
  model_id: string
  model_name: string
  attrs: Record<string, unknown>
  updated_at: string
}

interface CiInstanceSearchResult {
  records: CiInstanceSearchVO[]
  total: number
  page: number
  size: number
  model_counts: Record<string, number>
}

interface CiModelVO {
  id: number
  model_id: string
  name: string
  icon: string
  group_code: string
}

const ICON_MAP: Record<string, React.ElementType> = {
  server: Server,
  database: Database,
}

const SEARCH_COL_DEFS: ColumnDef[] = [
  { key: '_name',       name: '名称',     required: true },
  { key: '_model',      name: '模型类型', required: true },
  { key: '_updated_at', name: '更新时间' },
]
const DEFAULT_SEARCH_COLS = ['_name', '_model', '_updated_at']

export default function CmdbSearchPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  const [keyword, setKeyword]               = useState('')
  const [debouncedKeyword, setDebouncedKw]  = useState('')
  const [filterModel, setFilterModel]       = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKw(keyword), 300)
    return () => clearTimeout(t)
  }, [keyword])

  const isSearching = debouncedKeyword.length > 0 || filterModel.length > 0

  const { data: searchResult, isLoading: searchLoading } = useQuery<CiInstanceSearchResult>({
    queryKey: ['cmdb-search', debouncedKeyword, filterModel],
    queryFn: () => api.get('/cmdb/instances/search', {
      params: { keyword: debouncedKeyword, modelId: filterModel, page: 1, size: 20 },
    }).then(r => r.data.data),
    enabled: isSearching,
  })

  const { data: models = [] } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models'],
    queryFn: () => api.get('/cmdb/meta/models').then(r => r.data.data),
  })

  const { visible, toggle } = useColumnConfig('all', DEFAULT_SEARCH_COLS)

  const modelCounts = searchResult?.model_counts ?? {}
  const totalCount  = searchResult?.total ?? 0

  return (
    <div className="max-w-5xl">
      {/* 标题 + 搜索框 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">配置管理数据库</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-11 text-base"
            placeholder="搜索 CI 名称、IP、主机名..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {isSearching ? (
        <>
          {/* 模型筛选标签 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFilterModel('')}
              className={cn(
                'px-3 py-1 rounded-full text-sm transition-colors',
                filterModel === ''
                  ? 'bg-primary text-primary-foreground'
                  : 'border hover:bg-muted text-muted-foreground'
              )}
            >
              全部 ({totalCount})
            </button>
            {Object.entries(modelCounts).map(([mid, cnt]) => {
              const m = models.find(x => x.model_id === mid)
              return (
                <button
                  key={mid}
                  onClick={() => setFilterModel(filterModel === mid ? '' : mid)}
                  className={cn(
                    'px-3 py-1 rounded-full text-sm transition-colors',
                    filterModel === mid
                      ? 'bg-primary text-primary-foreground'
                      : 'border hover:bg-muted text-muted-foreground'
                  )}
                >
                  {m?.name ?? mid} ({cnt})
                </button>
              )
            })}
          </div>

          {/* 搜索结果表格 */}
          {searchLoading ? (
            <p className="text-muted-foreground text-sm">搜索中...</p>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">找到 {totalCount} 条结果</p>
                <ColumnPicker
                  allColumns={SEARCH_COL_DEFS}
                  visibleKeys={visible}
                  onToggle={toggle}
                />
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {SEARCH_COL_DEFS.filter(c => visible.includes(c.key)).map(col => (
                        <th
                          key={col.key}
                          className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium group"
                        >
                          <span className="flex items-center gap-1">
                            {col.name}
                            {!col.required && (
                              <button
                                onClick={() => toggle(col.key)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                              >×</button>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(searchResult?.records ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={visible.length} className="text-center py-12 text-muted-foreground text-sm">
                          未找到匹配的 CI
                        </td>
                      </tr>
                    ) : (searchResult?.records ?? []).map(inst => (
                      <tr key={inst.id} className="hover:bg-muted/30">
                        {SEARCH_COL_DEFS.filter(c => visible.includes(c.key)).map(col => (
                          <td key={col.key} className="px-4 py-3">
                            {col.key === '_name' && (
                              <Link
                                href={`/cmdb/instances/${inst.model_id}/${inst.id}`}
                                className="font-medium hover:underline"
                              >
                                {inst.name}
                              </Link>
                            )}
                            {col.key === '_model' && (
                              <Badge variant="secondary" className="text-xs">{inst.model_name}</Badge>
                            )}
                            {col.key === '_updated_at' && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(inst.updated_at).toLocaleDateString('zh-CN')}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* 空状态：模型卡片快速入口 */
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            输入关键词搜索，或点击下方模型快速浏览 CI 资源
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {models.map(m => {
              const Icon = ICON_MAP[m.icon] ?? Box
              return (
                <Link
                  key={m.model_id}
                  href={`/cmdb/instances?model=${m.model_id}`}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors flex items-center gap-3"
                >
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{m.model_id}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
