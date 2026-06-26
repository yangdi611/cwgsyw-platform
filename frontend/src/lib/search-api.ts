/**
 * 统一全局搜索 API 客户端（⌘K 命令面板）。
 *
 * 后端 R<T> 包裹不解包，沿用 wiki-api 的 `.then(r => r.data.data)` 取数。
 */
import api from './api'

/** 与后端 SearchResultVO 对齐（Jackson SNAKE_CASE）。 */
export interface SearchResultItem {
  type: 'ci' | 'shared_file' | 'change_doc' | 'device' | 'user' | 'wiki'
  id: number
  title: string
  subtitle: string | null
  url: string
  group_label: string
}

/** 调 /api/search，size 为每类返回上限。 */
export async function globalSearch(keyword: string, size = 5): Promise<SearchResultItem[]> {
  const kw = keyword.trim()
  if (!kw) return []
  return api
    .get<{ data: SearchResultItem[] }>('/search', { params: { keyword: kw, size } })
    .then((r) => r.data.data ?? [])
}
