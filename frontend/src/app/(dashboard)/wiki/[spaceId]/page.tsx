'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { wikiApi } from '@/lib/wiki-api'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import { Card } from '@/components/v2/Card'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { EmptyState } from '@/components/shared'
import { BookOpen, FileText, Network } from 'lucide-react'
import type { WikiPageTree, WikiStatus } from '@/types/wiki'

const STATUS_META: Record<WikiStatus, { label: string; variant: 'ok' | 'warn' | 'neutral' }> = {
  draft: { label: '草稿', variant: 'neutral' },
  review: { label: '审核中', variant: 'warn' },
  published: { label: '已发布', variant: 'ok' },
  archived: { label: '已归档', variant: 'neutral' },
}

function flatten(nodes: WikiPageTree[]): WikiPageTree[] {
  const out: WikiPageTree[] = []
  const walk = (list: WikiPageTree[]) => {
    for (const n of list) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

export default function WikiSpaceHomePage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const router = useRouter()
  const sid = Number(spaceId)

  const { data: spaces } = useQuery({ queryKey: ['wiki-spaces'], queryFn: wikiApi.listSpaces })
  const { data: tree } = useQuery<WikiPageTree[]>({
    queryKey: ['wiki-tree', sid],
    queryFn: () => wikiApi.getTree(sid),
  })

  const space = spaces?.find((s) => s.id === sid)
  const pages = useMemo(() => flatten(tree ?? []), [tree])

  useBreadcrumbLabel(space?.name)

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-v2-lg bg-v2-primary-soft text-v2-primary">
          <BookOpen className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-v2-fg">{space?.name ?? '知识空间'}</h1>
          <p className="mt-1 text-sm text-v2-muted">{space?.description || '欢迎来到知识空间，从左侧目录开始浏览或创建页面。'}</p>
        </div>
        <button
          onClick={() => router.push(`/wiki/${sid}/graph`)}
          className="flex shrink-0 items-center gap-1.5 rounded-v2-md border border-v2-border bg-v2-surface px-3 py-2 text-sm text-v2-fg hover:bg-v2-surface-hover"
        >
          <Network className="h-4 w-4" />
          知识图谱
        </button>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-v2-muted">最近更新</h2>
        {pages.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5 text-v2-muted" />}
            title="暂无页面"
            description="从左侧目录新建第一个页面开始记录。"
          />
        ) : (
          <ul className="divide-y divide-v2-border/60">
            {pages.slice(0, 30).map((p) => {
              const meta = STATUS_META[p.status]
              return (
                <li key={p.id}>
                  <button
                    onClick={() => router.push(`/wiki/${sid}/${p.id}`)}
                    className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-v2-surface-hover"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-v2-muted" />
                    <span className="min-w-0 flex-1 truncate text-sm text-v2-fg">{p.title || '无标题'}</span>
                    <StatusBadge status={meta.variant}>{meta.label}</StatusBadge>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
