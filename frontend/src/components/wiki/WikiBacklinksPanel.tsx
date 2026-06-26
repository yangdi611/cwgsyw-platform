'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { wikiApi } from '@/lib/wiki-api'
import { Link2 } from 'lucide-react'
import type { WikiBacklink } from '@/types/wiki'

export function WikiBacklinksPanel({ pageId }: { pageId: number }) {
  const router = useRouter()
  const { data } = useQuery<WikiBacklink[]>({
    queryKey: ['wiki-backlinks', pageId],
    queryFn: () => wikiApi.getBacklinks(pageId),
  })

  const links = data ?? []

  return (
    <div className="rounded-v2-md border border-v2-border bg-v2-surface p-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-v2-fg">
        <Link2 className="h-4 w-4 text-v2-muted" />
        反向链接
      </h3>
      {links.length === 0 ? (
        <p className="text-xs text-v2-muted">暂无其他页面引用本文。</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-v2-muted">{links.length} 个页面引用了本文</p>
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.page_id}>
                <button
                  onClick={() => router.push(`/wiki/${l.space_id}/${l.page_id}`)}
                  className="w-full truncate text-left text-sm text-v2-primary hover:underline"
                >
                  {l.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
