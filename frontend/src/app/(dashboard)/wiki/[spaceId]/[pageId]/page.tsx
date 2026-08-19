'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import { useTheme } from 'next-themes'
import '@uiw/react-markdown-preview/markdown.css'
import 'highlight.js/styles/github.css'
import { wikiApi } from '@/lib/wiki-api'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import { WikiBacklinksPanel } from '@/components/wiki/WikiBacklinksPanel'
import { WikiVersionsPanel } from '@/components/wiki/WikiVersionsPanel'
import { ResourceAccessDialog } from '@/components/authorization/ResourceAccessDialog'
import { WikiCommentsDrawer } from '@/components/wiki/WikiCommentsDrawer'
import { WikiMarkdown } from '@/components/wiki/WikiMarkdown'
import { WikiShellHeader } from '@/components/wiki/WikiShellChrome'
import type { PageResult, WikiComment, WikiPage, WikiPageTree, WikiSpace, WikiStatus } from '@/types/wiki'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DetailDrawerPage,
  EmptyState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

const STATUS_META: Record<WikiStatus, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  draft: { label: '草稿', tone: 'neutral' },
  review: { label: '审核中', tone: 'warning' },
  published: { label: '已发布', tone: 'success' },
  archived: { label: '已归档', tone: 'neutral' },
}

function buildTitleMap(nodes: WikiPageTree[]): Map<string, { id: number; spaceId: number }> {
  const map = new Map<string, { id: number; spaceId: number }>()
  const walk = (list: WikiPageTree[]) => {
    for (const node of list) {
      if (!map.has(node.title)) map.set(node.title, { id: node.id, spaceId: node.spaceId })
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return map
}

function preprocessWikiLinks(
  content: string,
  titleMap: Map<string, { id: number; spaceId: number }>,
): string {
  return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, rawTitle: string, alias?: string) => {
    const title = rawTitle.trim()
    const display = (alias ?? title).trim()
    const target = titleMap.get(title)
    if (target) return `[${display}](/wiki/${target.spaceId}/${target.id})`
    return `[${display}](#wiki-pending-link)`
  })
}

export default function WikiPageReader() {
  const { spaceId, pageId } = useParams<{ spaceId: string; pageId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { resolvedTheme } = useTheme()

  const sid = Number(spaceId)
  const pid = Number(pageId)

  const [aclOpen, setAclOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const { data: spaces } = useQuery<WikiSpace[]>({
    queryKey: ['wiki-spaces'],
    queryFn: () => wikiApi.listSpaces(),
  })

  const currentSpace = useMemo(() => spaces?.find((space) => space.id === sid), [spaces, sid])
  const spaceExists = Boolean(currentSpace)

  const { data: tree, isLoading: treeLoading } = useQuery<WikiPageTree[]>({
    queryKey: ['wiki-tree', sid],
    queryFn: () => wikiApi.getTree(sid),
    enabled: spaceExists,
  })

  const pageExists = useMemo(() => {
    const hasPage = (nodes: WikiPageTree[]): boolean =>
      nodes.some((node) => node.id === pid || (node.children?.length ? hasPage(node.children) : false))
    return tree ? hasPage(tree) : false
  }, [pid, tree])

  const { data: page, isLoading: pageLoading, isError: pageError } = useQuery<WikiPage>({
    queryKey: ['wiki-page', pid],
    queryFn: () => wikiApi.getPage(pid),
    enabled: spaceExists && pageExists,
  })

  const { data: commentsFirstPage } = useQuery<PageResult<WikiComment>>({
    queryKey: ['wiki-comments-count', pid],
    queryFn: () => wikiApi.listComments(pid, { page: 1, size: 1 }),
    enabled: spaceExists && pageExists,
  })

  const readOnly = currentSpace?.readOnly ?? false
  useBreadcrumbLabel([currentSpace?.name, page?.title])

  const titleMap = useMemo(() => buildTitleMap(tree ?? []), [tree])
  const rendered = useMemo(
    () => preprocessWikiLinks(page?.content ?? '', titleMap),
    [page?.content, titleMap],
  )

  const submitMutation = useMutation({
    mutationFn: () => wikiApi.submitPage(pid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-page', pid] })
      queryClient.invalidateQueries({ queryKey: ['wiki-tree', sid] })
      toast.success('已提交审批')
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '提交失败'
      toast.error(message)
    },
  })

  const publishMutation = useMutation({
    mutationFn: () => wikiApi.publishPage(pid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-page', pid] })
      queryClient.invalidateQueries({ queryKey: ['wiki-tree', sid] })
      toast.success('已发布')
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '发布失败'
      toast.error(message)
    },
  })

  const canWrite = page?.canWrite ?? false
  const canPublish = page?.canPublish ?? false
  const canManageAcl = page?.canManageAcl ?? false

  if (spaces === undefined || (spaceExists && treeLoading) || (pageExists && pageLoading)) {
    return <LoadingState label="正在加载页面…" />
  }
  if (!spaceExists || !pageExists || pageError || !page) {
    return <EmptyState title="页面不存在或已删除" description="请返回知识空间选择其他页面。" />
  }

  const meta = STATUS_META[page.status]

  return (
    <>
      <WikiShellHeader>
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title={page.title || currentSpace?.name || '知识页面'}
            subtitle={currentSpace?.name}
            status={<StatusBadge size="sm" label={meta.label} status={meta.tone} />}
            actions={
              <div className="cwgsyw-inline-controls cwgsyw-wiki__header-actions">
                {canWrite ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/wiki/${sid}/${pid}/edit`)}>
                    编辑
                  </Button>
                ) : null}
                {canPublish ? (
                  <Button type="button" size="sm" disabled={publishMutation.isPending || page.status === 'published'} onClick={() => publishMutation.mutate()}>
                    发布
                  </Button>
                ) : canWrite && !readOnly ? (
                  <Button type="button" size="sm" disabled={submitMutation.isPending || page.status === 'review'} onClick={() => submitMutation.mutate()}>
                    提交审批
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    wikiApi.exportPage(pid, `${page.title}.md`).catch(() => toast.error('导出失败'))
                  }}
                >
                  导出
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setCommentsOpen(true)}>
                  评论 {commentsFirstPage?.total ?? 0}
                </Button>
              </div>
            }
          />
      </WikiShellHeader>
      <DetailDrawerPage
        embedded
        className="cwgsyw-wiki cwgsyw-wiki-page"
        content={
          <section className="cwgsyw-devices-panel">
            <header className="cwgsyw-devices-panel__head">正文</header>
            <div className="cwgsyw-devices-panel__body">
            <div data-color-mode={resolvedTheme === 'dark' ? 'dark' : 'light'} className="wmde-markdown cwgsyw-wiki-page__markdown max-w-none !bg-transparent">
              {page.content ? (
                <WikiMarkdown
                  content={rendered}
                  imageLightbox
                  mermaidRenderMode="read"
                  mermaidLazy={false}
                  mermaidDebounceMs={180}
                />
              ) : (
                <p className="cwgsyw-wiki-page__empty">本页暂无内容。</p>
              )}
            </div>
            </div>
          </section>
        }
        drawer={
          <div className="cwgsyw-wiki-page__aside">
            <section className="cwgsyw-devices-panel">
              <header className="cwgsyw-devices-panel__head">页面信息</header>
              <div className="cwgsyw-devices-panel__body">
              <dl className="cwgsyw-devices-defs">
                <div>
                  <dt>状态</dt>
                  <dd><StatusBadge label={meta.label} status={meta.tone} /></dd>
                </div>
                <div>
                  <dt>更新人</dt>
                  <dd>{page.updatedByName || '—'}</dd>
                </div>
                <div>
                  <dt>更新时间</dt>
                  <dd>{page.updatedAt ? new Date(page.updatedAt).toLocaleString('zh-CN') : '—'}</dd>
                </div>
                <div>
                  <dt>版本</dt>
                  <dd>v{page.currentVersion}</dd>
                </div>
              </dl>
              {canManageAcl ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => setAclOpen(true)}>
                  权限设置{page.aclCustom ? '（自定义）' : ''}
                </Button>
              ) : null}
              </div>
            </section>
            <WikiBacklinksPanel pageId={pid} />
            <WikiVersionsPanel pageId={pid} />
          </div>
        }
      />

      {canManageAcl ? (
        <ResourceAccessDialog
          resourceType="wiki_page"
          resourceId={pid}
          title={page.title}
          container
          open={aclOpen}
          onOpenChange={setAclOpen}
        />
      ) : null}

      <WikiCommentsDrawer key={pid} pageId={pid} open={commentsOpen} onOpenChange={setCommentsOpen} />
    </>
  )
}
