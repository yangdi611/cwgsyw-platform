'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import { wikiApi } from '@/lib/wiki-api'
import type { PageResult, WikiComment } from '@/types/wiki'
import { WIKI_COMMENT_MAX_LENGTH } from '@/types/wiki'
import '@/design-system/figma-neutral/index.css'
import { Button, IconButton, NeutralAlertDialog, NeutralDrawer, Textarea } from '@/design-system/figma-neutral/components'

interface WikiCommentsDrawerProps {
  pageId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PAGE_SIZE = 20

export function WikiCommentsDrawer({ pageId, open, onOpenChange }: WikiCommentsDrawerProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<WikiComment | null>(null)
  const [page, setPage] = useState(1)
  const [records, setRecords] = useState<WikiComment[]>([])
  const [total, setTotal] = useState(0)

  const { isFetching } = useQuery<PageResult<WikiComment>>({
    queryKey: ['wiki-comments', pageId, page],
    queryFn: async () => {
      const result = await wikiApi.listComments(pageId, { page, size: PAGE_SIZE })
      setTotal(result.total)
      setRecords((prev) => {
        const merged = page === 1 ? result.records : [...prev, ...result.records]
        const seen = new Set<number>()
        return merged.filter((comment) => (seen.has(comment.id) ? false : (seen.add(comment.id), true)))
      })
      return result
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
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '评论发送失败'
      toast.error(message)
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
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '删除失败'
      toast.error(message)
    },
  })

  const submitting = createMutation.isPending
  const canSend = trimmedLen > 0 && !overLimit && !submitting

  return (
    <NeutralDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={`评论 ${total}`}
      description="查看并发表当前页面的评论。"
      side="right"
    >
      <div className="cwgsyw-wiki-comments">
        <Textarea
          size="sm"
          value={draft}
          rows={3}
          placeholder="写下你的评论…"
          disabled={submitting}
          error={overLimit}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="cwgsyw-wiki-comments__composer">
          <span className="cwgsyw-wiki-comments__count">
            {draft.length}/{WIKI_COMMENT_MAX_LENGTH}
          </span>
          <Button type="button" size="sm" disabled={!canSend} onClick={() => createMutation.mutate()}>
            {submitting ? '发送中…' : '发送'}
          </Button>
        </div>
        {records.length === 0 && !isFetching ? <p className="cwgsyw-wiki-comments__empty">暂无评论</p> : null}
        {records.map((comment) => (
          <article key={comment.id} className="cwgsyw-wiki-comments__item">
            <div className="cwgsyw-wiki-comments__meta">
              <span className="cwgsyw-wiki-comments__author">{comment.createdByName || '—'}</span>
              <span className="cwgsyw-wiki-comments__time">{new Date(comment.createdAt).toLocaleString('zh-CN')}</span>
              {comment.canDelete ? (
                <IconButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="cwgsyw-cmdb-admin__delete-action"
                  icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--trash" />}
                  aria-label="删除评论"
                  disabled={deleteMutation.isPending}
                  onClick={() => setDeleteTarget(comment)}
                />
              ) : null}
            </div>
            <p className="cwgsyw-wiki-comments__body">{comment.content}</p>
          </article>
        ))}
        {isFetching ? <p className="cwgsyw-wiki-comments__empty">加载中…</p> : null}
        {hasMore && !isFetching ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setPage((current) => current + 1)}>
            加载更多
          </Button>
        ) : null}
        {!hasMore && records.length > 0 ? <p className="cwgsyw-wiki-comments__empty">没有更多评论了</p> : null}
      </div>
      {deleteTarget ? (
        <NeutralAlertDialog
          open
          onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setDeleteTarget(null) }}
          intent="destructive"
          title="确认删除评论？"
          description="删除后不可恢复。"
          confirmLabel={deleteMutation.isPending ? '正在删除' : '确认删除'}
          cancelLabel="取消"
          onConfirm={() => deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        />
      ) : null}
    </NeutralDrawer>
  )
}
