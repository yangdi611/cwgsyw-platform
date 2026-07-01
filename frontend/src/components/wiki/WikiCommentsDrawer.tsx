'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { wikiApi } from '@/lib/wiki-api'
import { Button } from '@/components/v2/Button'
import { cn } from '@/lib/utils'
import { X, Send, Trash2, MessageCircle } from 'lucide-react'
import type { WikiComment, PageResult } from '@/types/wiki'
import { WIKI_COMMENT_MAX_LENGTH } from '@/types/wiki'

interface WikiCommentsDrawerProps {
  pageId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PAGE_SIZE = 20

export function WikiCommentsDrawer({ pageId, open, onOpenChange }: WikiCommentsDrawerProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [page, setPage] = useState(1)
  const [records, setRecords] = useState<WikiComment[]>([])
  const [total, setTotal] = useState(0)

  // 抽屉打开时（或翻页时）拉取评论；page 变化驱动加载更多。
  // 切换 pageId 时由父组件通过 key 重挂本组件，本地状态自然重置，无需 effect。
  const { isFetching } = useQuery<PageResult<WikiComment>>({
    queryKey: ['wiki-comments', pageId, page],
    queryFn: async () => {
      const res = await wikiApi.listComments(pageId, { page, size: PAGE_SIZE })
      setTotal(res.total)
      setRecords((prev) => {
        // 第一页替换，后续页追加；按 id 去重防止并发/失效重复
        const merged = page === 1 ? res.records : [...prev, ...res.records]
        const seen = new Set<number>()
        return merged.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
      })
      return res
    },
    enabled: open && Boolean(pageId),
  })

  const trimmedLen = draft.trim().length
  const overLimit = draft.length > WIKI_COMMENT_MAX_LENGTH
  const hasMore = records.length < total

  const createMutation = useMutation({
    mutationFn: () => wikiApi.createComment(pageId, { content: draft.trim() }),
    onSuccess: () => {
      setDraft('')
      setPage(1)
      queryClient.invalidateQueries({ queryKey: ['wiki-comments', pageId] })
      queryClient.invalidateQueries({ queryKey: ['wiki-comments-count', pageId] })
      toast.success('已发送评论')
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '评论发送失败'
      toast.error(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => wikiApi.deleteComment(pageId, commentId),
    onSuccess: () => {
      setPage(1)
      queryClient.invalidateQueries({ queryKey: ['wiki-comments', pageId] })
      queryClient.invalidateQueries({ queryKey: ['wiki-comments-count', pageId] })
      toast.success('已删除评论')
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '删除失败'
      toast.error(msg)
    },
  })

  const submitting = createMutation.isPending
  const canSend = trimmedLen > 0 && !overLimit && !submitting

  // __RENDER__
  if (!open) return null

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />

      {/* 抽屉：桌面右侧 400px 全高；移动端底部最高 85vh */}
      <div
        role="dialog"
        aria-label="页面评论"
        className={cn(
          'fixed z-50 flex flex-col bg-v2-surface shadow-v2-lg',
          'inset-x-0 bottom-0 max-h-[85vh] rounded-t-v2-lg',
          'sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[400px] sm:max-h-none sm:rounded-none sm:border-l sm:border-v2-border',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-v2-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-v2-fg">
            <MessageCircle className="h-4 w-4 text-v2-muted" />
            评论 {total}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Composer：输入区放列表上方，提交后新评论紧跟其下 */}
        <div className="border-b border-v2-border px-4 py-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={submitting}
            rows={3}
            placeholder="写下你的评论…"
            className={cn(
              'w-full resize-none rounded-v2-sm border bg-v2-bg px-3 py-2 text-sm text-v2-fg',
              'placeholder:text-v2-subtle focus:outline-none focus:ring-2 focus:ring-v2-primary/40',
              'disabled:opacity-50',
              overLimit ? 'border-v2-danger' : 'border-v2-border',
            )}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className={cn('text-xs', overLimit ? 'text-v2-danger' : 'text-v2-muted')}>
              {draft.length}/{WIKI_COMMENT_MAX_LENGTH}
            </span>
            <Button
              variant="primary"
              size="sm"
              disabled={!canSend}
              onClick={() => createMutation.mutate()}
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? '发送中…' : '发送'}
            </Button>
          </div>
        </div>


        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {records.length === 0 && !isFetching ? (
            <p className="py-8 text-center text-sm text-v2-muted">暂无评论</p>
          ) : (
            <ul className="space-y-3">
              {records.map((c) => (
                <li key={c.id} className="rounded-v2-sm border border-v2-border bg-v2-bg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-v2-muted">
                        <span className="font-medium text-v2-fg">{c.createdByName || '—'}</span>
                        <span>{new Date(c.createdAt).toLocaleString('zh-CN')}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-v2-fg">
                        {c.content}
                      </p>
                    </div>
                    {c.canDelete && (
                      <button
                        title="删除评论"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm('确定删除这条评论吗？')) deleteMutation.mutate(c.id)
                        }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-v2-muted hover:bg-v2-surface-hover hover:text-v2-danger disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isFetching && (
            <p className="py-3 text-center text-xs text-v2-muted">加载中…</p>
          )}

          {hasMore && !isFetching && (
            <div className="pt-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setPage((p) => p + 1)}>
                加载更多
              </Button>
            </div>
          )}

          {!hasMore && records.length > 0 && (
            <p className="pt-3 text-center text-xs text-v2-subtle">没有更多评论了</p>
          )}
        </div>

      </div>
    </>
  )
}


