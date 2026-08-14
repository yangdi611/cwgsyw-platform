'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { wikiApi } from '@/lib/wiki-api'
import type { WikiBacklink } from '@/types/wiki'
import '@/design-system/figma-neutral/index.css'
import { Button, Card } from '@/design-system/figma-neutral/components'

export function WikiBacklinksPanel({ pageId }: { pageId: number }) {
  const router = useRouter()
  const { data } = useQuery<WikiBacklink[]>({
    queryKey: ['wiki-backlinks', pageId],
    queryFn: () => wikiApi.getBacklinks(pageId),
  })
  const links = data ?? []

  return (
    <Card title="反向链接">
      {links.length === 0 ? (
        <p>暂无其他页面引用本文。</p>
      ) : (
        <div className="cwgsyw-form">
          <p>{links.length} 个页面引用了本文</p>
          {links.map((link) => (
            <Button key={link.pageId} type="button" variant="ghost" onClick={() => router.push(`/wiki/${link.spaceId}/${link.pageId}`)}>
              {link.title}
            </Button>
          ))}
        </div>
      )}
    </Card>
  )
}
