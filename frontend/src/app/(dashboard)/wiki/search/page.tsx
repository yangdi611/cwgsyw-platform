'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { wikiApi } from '@/lib/wiki-api'
import type { WikiSearchResult } from '@/types/wiki'
import '@/design-system/figma-neutral/index.css'
import {
  DataManagementPage,
  EmptyState,
  LoadingState,
  PageHeader,
  Pagination,
  SearchInput,
} from '@/design-system/figma-neutral/components'

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (keyword === urlKeyword) return
      setDebouncedKw(keyword)
      pushSearchUrl(keyword, 1)
    }, 400)
    return () => clearTimeout(timer)
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
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <DataManagementPage
      embedded
      className="cwgsyw-wiki cwgsyw-wiki-search"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title="全文搜索"
          subtitle="按标题和正文检索知识空间中的页面。"
        />
      }
      filter={
        <SearchInput
          size="sm"
          autoFocus
          value={keyword}
          placeholder="搜索知识库…"
          onChange={(event) => handleSearch(event.target.value)}
          onClear={() => handleSearch('')}
        />
      }
      content={
        !debouncedKw ? (
          <div className="cwgsyw-neutral-empty">
            {/* Official Figma search glyph; image optimization adds no value here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/figma-icons/cmdb-search.svg" width={22} height={22} alt="" data-figma-node="6:29270" />
            <EmptyState showIcon={false} title="输入关键词开始搜索" description="支持按页面标题和正文检索。" />
          </div>
        ) : isLoading ? (
          <LoadingState label="搜索中…" />
        ) : records.length === 0 ? (
          <div className="cwgsyw-neutral-empty">
            {/* Official Figma package-search glyph; image optimization adds no value here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/figma-icons/cmdb-package-search.svg" width={22} height={22} alt="" data-figma-node="6:28469" />
            <EmptyState showIcon={false} title="未找到相关页面" description={`没有找到与「${debouncedKw}」相关的内容。`} />
          </div>
        ) : (
          <div className="cwgsyw-wiki-search__results">
            <p className="cwgsyw-wiki-search__count">找到 {total} 条结果</p>
            {records.map((result) => (
              <button
                key={result.pageId}
                type="button"
                className="cwgsyw-wiki-search__row"
                onClick={() => router.push(`/wiki/${result.spaceId}/${result.pageId}`)}
              >
                <span>{result.title}</span>
                {result.highlight ? <span className="cwgsyw-wiki-search__hit">{result.highlight}</span> : null}
              </button>
            ))}
            <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={handlePageChange} />
          </div>
        )
      }
    />
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
    <Suspense fallback={<LoadingState label="正在加载搜索…" />}>
      <WikiSearchContent />
    </Suspense>
  )
}
