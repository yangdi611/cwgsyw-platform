'use client'

import { useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'
import '@uiw/react-markdown-preview/markdown.css'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { wikiApi } from '@/lib/wiki-api'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { WikiBacklinksPanel } from '@/components/wiki/WikiBacklinksPanel'
import { WikiVersionsPanel } from '@/components/wiki/WikiVersionsPanel'
import { WikiAclDialog } from '@/components/wiki/WikiAclDialog'
import { WikiImage } from '@/components/wiki/WikiImage'
import { Pencil, FileDown, Send, CheckCircle2, Lock, User, Clock } from 'lucide-react'
import { useState } from 'react'
import type { WikiPage, WikiPageTree, WikiStatus, WikiSpace } from '@/types/wiki'
import { canWriteSpace } from '@/types/wiki'
import 'highlight.js/styles/github.css'

const STATUS_META: Record<WikiStatus, { label: string; variant: 'ok' | 'warn' | 'neutral' }> = {
  draft: { label: '草稿', variant: 'neutral' },
  review: { label: '审核中', variant: 'warn' },
  published: { label: '已发布', variant: 'ok' },
  archived: { label: '已归档', variant: 'neutral' },
}

/** 扁平化目录，建立 title → {id, space_id} 映射，用于解析 [[wiki link]] */
function buildTitleMap(nodes: WikiPageTree[]): Map<string, { id: number; space_id: number }> {
  const map = new Map<string, { id: number; space_id: number }>()
  const walk = (list: WikiPageTree[]) => {
    for (const n of list) {
      if (!map.has(n.title)) map.set(n.title, { id: n.id, space_id: n.space_id })
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return map
}

/**
 * 把 [[标题]] / [[标题|别名]] 转换为 markdown 链接。
 * 已知标题 → 真实路由链接；未知标题 → 行内代码 + 「待创建」提示。
 */
function preprocessWikiLinks(
  content: string,
  titleMap: Map<string, { id: number; space_id: number }>,
): string {
  return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, rawTitle: string, alias?: string) => {
    const title = rawTitle.trim()
    const display = (alias ?? title).trim()
    const target = titleMap.get(title)
    if (target) {
      return `[${display}](/wiki/${target.space_id}/${target.id})`
    }
    return `\`${display}\`<sup title="该页面尚未创建">待创建</sup>`
  })
}

export default function WikiPageReader() {
  const { spaceId, pageId } = useParams<{ spaceId: string; pageId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const { resolvedTheme } = useTheme()

  const sid = Number(spaceId)
  const pid = Number(pageId)

  const [aclOpen, setAclOpen] = useState(false)

  const { data: page, isLoading } = useQuery<WikiPage>({
    queryKey: ['wiki-page', pid],
    queryFn: () => wikiApi.getPage(pid),
  })

  const { data: tree } = useQuery<WikiPageTree[]>({
    queryKey: ['wiki-tree', sid],
    queryFn: () => wikiApi.getTree(sid),
  })

  const { data: spaces } = useQuery<WikiSpace[]>({
    queryKey: ['wiki-spaces'],
    queryFn: () => wikiApi.listSpaces(),
  })

  const currentSpace = useMemo(() => spaces?.find((s) => s.id === sid), [spaces, sid])
  const readOnly = currentSpace?.read_only ?? false

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
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '提交失败'
      toast.error(msg)
    },
  })

  const publishMutation = useMutation({
    mutationFn: () => wikiApi.publishPage(pid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-page', pid] })
      queryClient.invalidateQueries({ queryKey: ['wiki-tree', sid] })
      toast.success('已发布')
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '发布失败'
      toast.error(msg)
    },
  })

  const groupScope = useAuthStore((s) => s.groupScope)
  const isAdmin = groupScope === 'tenant' || groupScope === 'platform'
  // 手册空间（read_only）对非 admin 隐藏一切写操作；admin 仍可改（后端 ACL 同步放行）
  const writable = !readOnly || isAdmin
  const canWrite = hasPermission('wiki', 'update') && writable
  const canPublish = hasPermission('wiki', 'publish') && writable
  const canManageAcl = hasPermission('wiki', 'manage_acl') && writable

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-v2-muted">加载中…</div>
  }
  if (!page) {
    return <div className="py-12 text-center text-sm text-v2-muted">页面不存在或已删除</div>
  }

  const meta = STATUS_META[page.status]

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <article className="min-w-0 flex-1">
        {/* 标题不在此渲染：阅读页正文 Markdown 内已含一级标题，避免重复 */}
        <div className="mb-4 flex items-start justify-end gap-4">
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {canWrite && (
              <Button variant="secondary" size="sm" onClick={() => router.push(`/wiki/${sid}/${pid}/edit`)}>
                <Pencil className="h-3.5 w-3.5" />
                编辑
              </Button>
            )}
            {canPublish ? (
              <Button
                variant="primary"
                size="sm"
                disabled={publishMutation.isPending || page.status === 'published'}
                onClick={() => publishMutation.mutate()}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                发布
              </Button>
            ) : (
              canWrite && !readOnly && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={submitMutation.isPending || page.status === 'review'}
                  onClick={() => submitMutation.mutate()}
                >
                  <Send className="h-3.5 w-3.5" />
                  提交审批
                </Button>
              )
            )}
            <Button variant="ghost" size="sm" onClick={() => { wikiApi.exportPage(pid).catch(() => toast.error('导出失败')) }}>
              <FileDown className="h-3.5 w-3.5" />
              导出
            </Button>
          </div>
        </div>

        <div className="rounded-v2-lg border border-v2-border bg-v2-surface p-6 shadow-v2-sm sm:p-8">
          <div
            data-color-mode={resolvedTheme === 'dark' ? 'dark' : 'light'}
            className="wmde-markdown max-w-none !bg-transparent"
          >
            {page.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
                components={{ img: ({ src, alt }) => <WikiImage src={typeof src === 'string' ? src : undefined} alt={alt} /> }}
              >
                {rendered}
              </ReactMarkdown>
            ) : (
              <p className="text-v2-muted">本页暂无内容。</p>
            )}
          </div>
        </div>
      </article>

      {/* Right sidebar */}
      <aside className="hidden w-72 shrink-0 space-y-4 lg:block">
        <div className="rounded-v2-md border border-v2-border bg-v2-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-v2-fg">页面信息</h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-v2-muted">状态</span>
              <StatusBadge status={meta.variant}>{meta.label}</StatusBadge>
            </div>
            <div className="flex items-center gap-1.5 text-v2-muted">
              <User className="h-3.5 w-3.5" />
              <span>{page.updated_by_name || '—'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-v2-muted">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {page.updated_at ? new Date(page.updated_at).toLocaleString('zh-CN') : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-v2-muted">
              <span>版本</span>
              <span className="font-mono">v{page.current_version}</span>
            </div>
            {canManageAcl && (
              <Button variant="secondary" size="sm" className="w-full" onClick={() => setAclOpen(true)}>
                <Lock className="h-3.5 w-3.5" />
                权限设置
                {page.acl_custom && <span className="text-v2-warn">（自定义）</span>}
              </Button>
            )}
          </div>
        </div>

        <WikiBacklinksPanel pageId={pid} />
        <WikiVersionsPanel pageId={pid} />
      </aside>

      {canManageAcl && (
        <WikiAclDialog pageId={pid} pageTitle={page.title} open={aclOpen} onOpenChange={setAclOpen} />
      )}
    </div>
  )
}
