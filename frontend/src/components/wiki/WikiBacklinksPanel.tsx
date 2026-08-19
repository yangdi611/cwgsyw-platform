'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { wikiApi } from '@/lib/wiki-api'
import type { WikiBacklink } from '@/types/wiki'
import '@/design-system/figma-neutral/index.css'
import { Button } from '@/design-system/figma-neutral/components'

export function WikiBacklinksPanel({ pageId }: { pageId: number }) {
  const router = useRouter()
  const { data } = useQuery<WikiBacklink[]>({
    queryKey: ['wiki-backlinks', pageId],
    queryFn: () => wikiApi.getBacklinks(pageId),
  })
  const links = data ?? []

  return (
    <section className="cwgsyw-devices-panel">
      <header className="cwgsyw-devices-panel__head">反向链接</header>
      <div className="cwgsyw-devices-panel__body">
      {links.length === 0 ? (
        <p className="cwgsyw-wiki-tree__empty">暂无其他页面引用本文。</p>
      ) : (
        <div className="cwgsyw-wiki-space__list">
          <p className="cwgsyw-wiki-search__count">{links.length} 个页面引用了本文</p>
          {links.map((link) => (
            <button key={link.pageId} type="button" className="cwgsyw-wiki-space__row" onClick={() => router.push(`/wiki/${link.spaceId}/${link.pageId}`)}>
              <span>{link.title}</span>
            </button>
          ))}
        </div>
      )}
      </div>
    </section>
  )
}
