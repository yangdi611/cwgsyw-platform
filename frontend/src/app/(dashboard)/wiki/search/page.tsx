'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { wikiApi } from '@/lib/wiki-api'
import { Card, Input } from '@/components/design-system'
import { PageHeader, EmptyState, Pagination } from '@/components/shared'
import { Search, FileText } from 'lucide-react'
import type { WikiSearchResult } from '@/types/wiki'

function SearchResults({ urlKeyword, urlPage }: { urlKeyword: string; urlPage: number }) {
  const router = useRouter()
  const [keyword, setKeyword] = useState(urlKeyword)
  const [debouncedKw, setDebouncedKw] = useState(urlKeyword)
  const [page, setPage] = useState(urlPage)
  const lastUrl = useRef({ keyword: urlKeyword, page: urlPage })
  const pageSize = 20

  useEffect(() => {
    if (urlKeyword === lastUrl.current.keyword && urlPage === lastUrl.current.page) return
    lastUrl.current = { keyword: urlKeyword, page: urlPage }
    setKeyword(urlKeyword)
    setDebouncedKw(urlKeyword)
    setPage(urlPage)
  }, [urlKeyword, urlPage])

  const pushSearchUrl = useCallback((nextKeyword: string, nextPage: number) => {
    const params = new URLSearchParams()
    if (nextKeyword) params.set('keyword', nextKeyword)
    if (nextKeyword && nextPage > 1) params.set('page', String(nextPage))
    const nextUrl = params.size ? `/wiki/search?${params.toString()}` : '/wiki/search'
    lastUrl.current = { keyword: nextKeyword, page: nextPage }
    router.push(nextUrl, { scroll: false })
  }, [router])

  // Debounce typed input
  useEffect(() => {
    const t = setTimeout(() => {
      if (keyword === urlKeyword) return
      setDebouncedKw(keyword)
      pushSearchUrl(keyword, 1)
    }, 400)
    return () => clearTimeout(t)
  }, [keyword, pushSearchUrl, urlKeyword])

  const { data, isLoading } = useQuery({
    queryKey: ['wiki-search', debouncedKw, page],
    queryFn: () => wikiApi.search({ keyword: debouncedKw, page, size: pageSize }),
    enabled: !!debouncedKw,
  })

  const handleSearch = useCallback((nextKeyword: string) => {
    setKeyword(nextKeyword)
    setPage(1)
  }, [])

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage)
    pushSearchUrl(debouncedKw, nextPage)
  }, [debouncedKw, pushSearchUrl])

  const records: WikiSearchResult[] = data?.records ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="知识库" title="全文搜索" />

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-v2-muted" />
        <Input
          className="pl-9"
          placeholder="搜索知识库…"
          autoFocus
          value={keyword}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {!debouncedKw ? null : isLoading ? (
        <p className="text-sm text-v2-muted">搜索中…</p>
      ) : records.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-5 w-5 text-v2-muted" />}
            title="未找到相关页面"
            description={`没有找到与「${debouncedKw}」相关的内容。`}
          />
        </Card>
      ) : (
        <>
          <p className="text-sm text-v2-muted">
            找到 <span className="font-semibold text-v2-fg">{total}</span> 条结果
          </p>
          <div className="space-y-2">
            {records.map((r) => (
              <Card
                key={r.pageId}
                hover
                className="cursor-pointer p-4"
                onClick={() => router.push(`/wiki/${r.spaceId}/${r.pageId}`)}
              >
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-v2-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-v2-fg">{r.title}</p>
                    {r.highlight && (
                      <p className="mt-1 line-clamp-2 text-sm text-v2-muted">{r.highlight}</p>
                    )}
                    <p className="mt-1 text-xs text-v2-subtle">
                      {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('zh-CN') : ''}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  )
}

function WikiSearchContent() {
  const searchParams = useSearchParams()
  const urlKeyword = searchParams.get('keyword') ?? ''
  const parsedPage = Number(searchParams.get('page') ?? '1')
  const urlPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1

  return <SearchResults urlKeyword={urlKeyword} urlPage={urlPage} />
}

export default function WikiSearchPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-v2-muted">加载中…</div>}>
      <WikiSearchContent />
    </Suspense>
  )
}
