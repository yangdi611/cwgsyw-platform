'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { EmptyState, NeutralDialog, SearchInput } from '@/design-system/figma-neutral/components'
import { globalSearch, type SearchResultItem } from '@/lib/search-api'
import { useCommandPalette } from '@/store/commandPaletteStore'

const GROUP_ORDER = ['配置项 (CI)', '共享文件', '变更单', '设备', '用户', '知识库']
const EMPTY_SEARCH_ICON = '/figma-icons/cmdb-search.svg'

function highlightAll(text: string, kw: string): React.ReactNode {
  const k = kw.trim()
  if (!text || !k) return text
  const lower = text.toLowerCase()
  const klower = k.toLowerCase()
  const parts: React.ReactNode[] = []
  let i = 0
  let n = 0
  for (;;) {
    const idx = lower.indexOf(klower, i)
    if (idx === -1) {
      parts.push(text.slice(i))
      break
    }
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(
      <mark key={n++} className="cwgsyw-global-search__hit">
        {text.slice(idx, idx + k.length)}
      </mark>
    )
    i = idx + k.length
  }
  return parts
}

function splitOnKeyword(
  text: string | null | undefined,
  kw: string
): { before: string; match: string; after: string } | null {
  const k = kw.trim()
  if (!text || !k) return null
  const idx = text.toLowerCase().indexOf(k.toLowerCase())
  if (idx === -1) return null
  return {
    before: text.slice(0, idx),
    match: text.slice(idx, idx + k.length),
    after: text.slice(idx + k.length),
  }
}

export function CommandPalette() {
  const router = useRouter()
  const open = useCommandPalette((s) => s.open)
  const setOpen = useCommandPalette((s) => s.setOpen)

  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const reqId = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useCommandPalette.getState().toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const kw = keyword.trim()
    if (!kw) return
    const id = ++reqId.current
    const timer = setTimeout(() => {
      globalSearch(kw, 5)
        .then((items) => {
          if (id === reqId.current) setResults(items)
        })
        .catch(() => {
          if (id === reqId.current) setResults([])
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [keyword])

  const handleKeywordChange = (nextKeyword: string) => {
    reqId.current += 1
    setKeyword(nextKeyword)
    if (nextKeyword.trim()) {
      setLoading(true)
    } else {
      setResults([])
      setLoading(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reqId.current += 1
      setKeyword('')
      setResults([])
      setLoading(false)
    }
    setOpen(nextOpen)
  }

  const handleSelect = (url: string) => {
    handleOpenChange(false)
    router.push(url)
  }

  const grouped = GROUP_ORDER.map((label) => ({
    label,
    items: results.filter((r) => r.groupLabel === label),
  })).filter((g) => g.items.length > 0)

  const hasQuery = keyword.trim().length > 0

  return (
    <NeutralDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="全局搜索"
      description="搜索配置项、共享文件、变更单、设备、用户和知识库。"
      size="md"
    >
      <div className="cwgsyw-global-search">
        <Command shouldFilter={false} className="cwgsyw-global-search__command">
          <SearchInput
            size="sm"
            value={keyword}
            onChange={(event) => handleKeywordChange(event.target.value)}
            placeholder="搜索 CI、共享文件、变更单、设备、用户、知识库…"
            aria-label="全局搜索关键词"
          />

          {hasQuery ? (
            <Command.List className="cwgsyw-global-search__list">
              {loading && results.length === 0 ? (
                <div className="cwgsyw-global-search__status">搜索中…</div>
              ) : null}
              {!loading && results.length === 0 ? (
                <Command.Empty className="cwgsyw-global-search__empty">
                  <div className="cwgsyw-global-search__empty-icon">
                    {/* The exact 22px Figma SVG should be served directly; image optimization adds no value here. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={EMPTY_SEARCH_ICON} width={22} height={22} alt="" data-figma-node="6:29270" />
                  </div>
                  <EmptyState showIcon={false} title="未找到匹配结果" description="换一个关键词再试一次。" />
                </Command.Empty>
              ) : null}
              {grouped.map((group) => (
                <Command.Group key={group.label} heading={<span className="cwgsyw-global-search__group">{group.label}</span>}>
                  {group.items.map((item) => {
                    const kw = keyword.trim()
                    const spot =
                      item.type === 'wiki' && item.subtitle && item.subtitle.length > 30
                        ? splitOnKeyword(item.subtitle, kw)
                        : null
                    return (
                      <Command.Item
                        key={`${item.type}-${item.id}`}
                        value={`${item.type}-${item.id}`}
                        onSelect={() => handleSelect(item.url)}
                        className="cwgsyw-global-search__item"
                      >
                        <span className="cwgsyw-global-search__title">{highlightAll(item.title, kw)}</span>
                        {item.subtitle ? (
                          spot ? (
                            <span className="cwgsyw-global-search__snippet">
                              <span className="cwgsyw-global-search__snippet-before">{spot.before}</span>
                              <span className="cwgsyw-global-search__hit">{spot.match}</span>
                              <span className="cwgsyw-global-search__snippet-after">{spot.after}</span>
                            </span>
                          ) : (
                            <span className="cwgsyw-global-search__meta">{highlightAll(item.subtitle, kw)}</span>
                          )
                        ) : null}
                      </Command.Item>
                    )
                  })}
                </Command.Group>
              ))}
            </Command.List>
          ) : null}
        </Command>
      </div>
    </NeutralDialog>
  )
}
