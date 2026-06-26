'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { wikiApi } from '@/lib/wiki-api'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/v2/Dialog'
import { Input } from '@/components/v2/Input'
import { Button } from '@/components/v2/Button'
import {
  ChevronRight,
  FileText,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Home,
} from 'lucide-react'
import type { WikiPageTree, WikiStatus } from '@/types/wiki'

const STATUS_DOT: Record<WikiStatus, string> = {
  draft: 'bg-v2-muted',
  review: 'bg-amber-500',
  published: 'bg-emerald-500',
  archived: 'bg-v2-subtle',
}
const STATUS_LABEL: Record<WikiStatus, string> = {
  draft: '草稿',
  review: '审核中',
  published: '已发布',
  archived: '已归档',
}

function countDescendants(node: WikiPageTree): number {
  let n = node.children?.length ?? 0
  for (const c of node.children ?? []) n += countDescendants(c)
  return n
}

interface NodeActionHandlers {
  onAddChild: (node: WikiPageTree) => void
  onRename: (node: WikiPageTree) => void
  onDelete: (node: WikiPageTree) => void
  onMove: (node: WikiPageTree, siblings: WikiPageTree[], parentId: number | null, dir: -1 | 1) => void
}

function TreeNode({
  node,
  siblings,
  parentId,
  depth,
  spaceId,
  activeId,
  canWrite,
  canDelete,
  handlers,
}: {
  node: WikiPageTree
  siblings: WikiPageTree[]
  parentId: number | null
  depth: number
  spaceId: number
  activeId: number | null
  canWrite: boolean
  canDelete: boolean
  handlers: NodeActionHandlers
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div>
      <div
        className={cn(
          'group flex w-full items-center gap-1 rounded-md pr-1 text-sm transition-colors',
          activeId === node.id
            ? 'bg-v2-primary-soft font-semibold text-v2-primary'
            : 'text-v2-fg hover:bg-v2-surface-hover',
        )}
      >
        <button
          onClick={() => router.push(`/wiki/${spaceId}/${node.id}`)}
          className="flex min-w-0 flex-1 items-center gap-1 px-1 py-1.5 text-left"
          style={{ paddingLeft: `${4 + depth * 14}px` }}
        >
          {hasChildren ? (
            <ChevronRight
              onClick={(e) => {
                e.stopPropagation()
                setExpanded((v) => !v)
              }}
              className={cn('h-3 w-3 shrink-0 transition-transform', expanded && 'rotate-90')}
            />
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span
            className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[node.status])}
            title={STATUS_LABEL[node.status]}
          />
          <span className="truncate">{node.title || '无标题'}</span>
        </button>

        <div className="hidden shrink-0 items-center group-hover:flex">
          {canWrite && (
            <>
              <button
                onClick={() => handlers.onAddChild(node)}
                title="新建子页面"
                className="flex h-6 w-6 items-center justify-center rounded text-v2-muted hover:bg-v2-surface hover:text-v2-fg"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handlers.onRename(node)}
                title="重命名"
                className="flex h-6 w-6 items-center justify-center rounded text-v2-muted hover:bg-v2-surface hover:text-v2-fg"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => handlers.onMove(node, siblings, parentId, -1)}
                title="上移"
                className="flex h-6 w-6 items-center justify-center rounded text-v2-muted hover:bg-v2-surface hover:text-v2-fg"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => handlers.onMove(node, siblings, parentId, 1)}
                title="下移"
                className="flex h-6 w-6 items-center justify-center rounded text-v2-muted hover:bg-v2-surface hover:text-v2-fg"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </>
          )}
          {canDelete && (
            <button
              onClick={() => handlers.onDelete(node)}
              title="删除"
              className="flex h-6 w-6 items-center justify-center rounded text-v2-muted hover:bg-v2-surface hover:text-v2-danger"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              siblings={node.children}
              parentId={node.id}
              depth={depth + 1}
              spaceId={spaceId}
              activeId={activeId}
              canWrite={canWrite}
              canDelete={canDelete}
              handlers={handlers}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function WikiTreeSidebar({ spaceId }: { spaceId: number }) {
  const router = useRouter()
  const params = useParams<{ pageId?: string }>()
  const activeId = params.pageId ? Number(params.pageId) : null
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()

  const canWrite = hasPermission('wiki', 'update')
  const canDelete = hasPermission('wiki', 'delete')

  const [renameTarget, setRenameTarget] = useState<WikiPageTree | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newParent, setNewParent] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const { data: tree } = useQuery<WikiPageTree[]>({
    queryKey: ['wiki-tree', spaceId],
    queryFn: () => wikiApi.getTree(spaceId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['wiki-tree', spaceId] })

  const createMutation = useMutation({
    mutationFn: () =>
      wikiApi.createPage({ space_id: spaceId, parent_id: newParent, title: newTitle.trim() }),
    onSuccess: (page) => {
      invalidate()
      setCreateOpen(false)
      setNewTitle('')
      setNewParent(null)
      router.push(`/wiki/${spaceId}/${page.id}/edit`)
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '创建失败'
      toast.error(msg)
    },
  })

  const renameMutation = useMutation({
    // 先拉取当前内容，避免重命名时把正文清空（PUT 需要带 content）
    mutationFn: async (node: WikiPageTree) => {
      const current = await wikiApi.getPage(node.id)
      return wikiApi.savePage(node.id, {
        title: renameValue.trim(),
        content: current.content ?? '',
        comment: '重命名',
      })
    },
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['wiki-page'] })
      setRenameTarget(null)
      toast.success('已重命名')
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败'
      toast.error(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => wikiApi.deletePage(id),
    onSuccess: () => {
      invalidate()
      toast.success('页面已删除')
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '删除失败'
      toast.error(msg)
    },
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, sort_order, parent_id }: { id: number; sort_order: number; parent_id: number | null }) =>
      wikiApi.movePage(id, { parent_id, sort_order }),
    onSuccess: invalidate,
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '移动失败'
      toast.error(msg)
    },
  })

  const handlers: NodeActionHandlers = {
    onAddChild: (node) => {
      setNewParent(node.id)
      setNewTitle('')
      setCreateOpen(true)
    },
    onRename: (node) => {
      setRenameTarget(node)
      setRenameValue(node.title)
    },
    onDelete: (node) => {
      const desc = countDescendants(node)
      const extra = desc > 0 ? `（包含 ${desc} 个子页面，将一并删除）` : ''
      if (confirm(`确认删除页面「${node.title}」？${extra}`)) deleteMutation.mutate(node.id)
    },
    onMove: (node, siblings, parentId, dir) => {
      const idx = siblings.findIndex((s) => s.id === node.id)
      const swapIdx = idx + dir
      if (swapIdx < 0 || swapIdx >= siblings.length) return
      const target = siblings[swapIdx]
      moveMutation.mutate({ id: node.id, parent_id: parentId, sort_order: target.sort_order })
    },
  }

  const roots = tree ?? []

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3">
        <button
          onClick={() => router.push(`/wiki/${spaceId}`)}
          className="flex items-center gap-1.5 text-sm font-bold text-v2-fg hover:text-v2-primary"
        >
          <Home className="h-4 w-4" />
          空间首页
        </button>
        {canWrite && (
          <button
            onClick={() => {
              setNewParent(null)
              setNewTitle('')
              setCreateOpen(true)
            }}
            title="新建页面"
            className="flex h-7 w-7 items-center justify-center rounded-md text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {roots.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-v2-muted">
            暂无页面{canWrite ? '，点击右上角 + 新建' : ''}
          </p>
        ) : (
          roots.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              siblings={roots}
              parentId={null}
              depth={0}
              spaceId={spaceId}
              activeId={activeId}
              canWrite={canWrite}
              canDelete={canDelete}
              handlers={handlers}
            />
          ))
        )}
      </div>

      {/* Create page dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newParent ? '新建子页面' : '新建页面'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="页面标题"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim()) createMutation.mutate()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={!newTitle.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              创建并编辑
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(v) => !v && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名页面</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameValue.trim() && renameTarget)
                  renameMutation.mutate(renameTarget)
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={!renameValue.trim() || renameMutation.isPending}
              onClick={() => renameTarget && renameMutation.mutate(renameTarget)}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
