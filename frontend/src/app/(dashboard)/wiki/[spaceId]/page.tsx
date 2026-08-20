'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { wikiApi } from '@/lib/wiki-api'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import { WikiShellHeader } from '@/components/wiki/WikiShellChrome'
import type { WikiPageTree, WikiStatus } from '@/types/wiki'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DataManagementPage,
  EmptyState,
  PageHeader,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

const STATUS_META: Record<WikiStatus, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  draft: { label: '草稿', tone: 'neutral' },
  review: { label: '审核中', tone: 'warning' },
  published: { label: '已发布', tone: 'success' },
  archived: { label: '已归档', tone: 'neutral' },
}

function flatten(nodes: WikiPageTree[]): WikiPageTree[] {
  const out: WikiPageTree[] = []
  const walk = (list: WikiPageTree[]) => {
    for (const node of list) {
      out.push(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return out
}

export default function WikiSpaceHomePage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const router = useRouter()
  const sid = Number(spaceId)

  const { data: spaces, isError: spaceError } = useQuery({ queryKey: ['wiki-spaces'], queryFn: wikiApi.listSpaces })
  const space = spaces?.find((item) => item.id === sid)
  const { data: tree, isError: treeError } = useQuery<WikiPageTree[]>({
    queryKey: ['wiki-tree', sid],
    queryFn: () => wikiApi.getTree(sid),
    enabled: Boolean(space),
  })

  const pages = useMemo(() => flatten(tree ?? []), [tree])
  useBreadcrumbLabel(space?.name)

  if (spaceError || treeError || (spaces && !space)) {
    return <EmptyState title="知识空间不存在或无权访问" description="请返回知识库列表选择可访问的空间。" />
  }

  return (
    <>
    <WikiShellHeader>
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title={space?.name ?? '知识空间'}
          subtitle={space?.description || '欢迎来到知识空间，从左侧目录开始浏览或创建页面。'}
          actions={
            <Button className="cwgsyw-wiki__header-actions" type="button" variant="secondary" size="sm" onClick={() => router.push(`/wiki/${sid}/graph`)}>
              知识图谱
            </Button>
          }
        />
    </WikiShellHeader>
    <DataManagementPage
      embedded
      className="cwgsyw-wiki cwgsyw-wiki-space-home"
      content={
        <section className="cwgsyw-devices-panel">
          <header className="cwgsyw-devices-panel__head">最近更新</header>
          <div className="cwgsyw-devices-panel__body">
          {pages.length === 0 ? (
            <div className="cwgsyw-neutral-empty">
              {/* Official Figma book glyph; image optimization adds no value here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/figma-icons/wiki-book.svg" width={22} height={22} alt="" data-figma-node="6:23850" />
              <EmptyState showIcon={false} title="暂无页面" description="从左侧目录新建第一个页面开始记录。" />
            </div>
          ) : (
            <div className="cwgsyw-wiki-space__list">
              {pages.slice(0, 30).map((page) => {
                const meta = STATUS_META[page.status]
                return (
                  <Button
                    key={page.id}
                    type="button"
                    variant="ghost"
                    className="cwgsyw-wiki-space__row"
                    onClick={() => router.push(`/wiki/${sid}/${page.id}`)}
                  >
                    <span>{page.title || '无标题'}</span>
                    <StatusBadge size="sm" label={meta.label} status={meta.tone} />
                  </Button>
                )
              })}
            </div>
          )}
          </div>
        </section>
      }
    />
    </>
  )
}
