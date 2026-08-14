'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { wikiApi } from '@/lib/wiki-api'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import type { WikiPageTree, WikiStatus } from '@/types/wiki'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Card,
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
    <DataManagementPage
      embedded
      header={
        <PageHeader
          eyebrow="知识空间"
          title={space?.name ?? '知识空间'}
          subtitle={space?.description || '欢迎来到知识空间，从左侧目录开始浏览或创建页面。'}
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/wiki', label: '知识空间' },
                { label: space?.name ?? '知识空间' },
              ]}
            />
          }
          actions={
            <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/wiki/${sid}/graph`)}>
              知识图谱
            </Button>
          }
        />
      }
      content={
        <Card title="最近更新">
          {pages.length === 0 ? (
            <EmptyState title="暂无页面" description="从左侧目录新建第一个页面开始记录。" />
          ) : (
            <div className="cwgsyw-form">
              {pages.slice(0, 30).map((page) => {
                const meta = STATUS_META[page.status]
                return (
                  <Button
                    key={page.id}
                    type="button"
                    variant="ghost"
                    onClick={() => router.push(`/wiki/${sid}/${page.id}`)}
                  >
                    {page.title || '无标题'}
                    <StatusBadge label={meta.label} status={meta.tone} />
                  </Button>
                )
              })}
            </div>
          )}
        </Card>
      }
    />
  )
}
