'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import { wikiApi } from '@/lib/wiki-api'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import {
  Button,
  IconButton,
  Input,
  NeutralAlertDialog,
  NeutralDialog,
  NeutralTooltip,
} from '@/design-system/figma-neutral/components'
import type { WikiPageTree, WikiStatus, WikiSpace } from '@/types/wiki'
import { canDeleteInSpace } from '@/types/wiki'

const STATUS_DOT: Record<WikiStatus, string> = {
  draft: 'bg-[var(--cwgsyw-text-tertiary)]',
  review: 'bg-[var(--cwgsyw-status-warning-fg)]',
  published: 'bg-[var(--cwgsyw-status-success-fg)]',
  archived: 'bg-[var(--cwgsyw-text-secondary)]',
}
const STATUS_LABEL: Record<WikiStatus, string> = {
  draft: '草稿',
  review: '审核中',
  published: '已发布',
  archived: '已归档',
}
const WIKI_PAGE_TITLE_MAX_LENGTH = 255

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
        className={`cwgsyw-wiki-tree__row${activeId === node.id ? ' is-active' : ''}`}
      >
        {hasChildren ? (
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            icon={<span aria-hidden="true" className={`cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-files-tree__chevron${expanded ? ' is-open' : ''}`} />}
            aria-label={expanded ? '折叠子页面' : '展开子页面'}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          />
        ) : (
          <span className="w-7 shrink-0" />
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="cwgsyw-wiki-tree__title"
          style={{ paddingLeft: `${4 + depth * 14}px` }}
          onClick={() => router.push(`/wiki/${spaceId}/${node.id}`)}
        >
          <span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--file" />
          <span
            className={`cwgsyw-wiki-tree__dot ${STATUS_DOT[node.status]}`}
            aria-label={STATUS_LABEL[node.status]}
          />
          <span className="truncate">{node.title || '无标题'}</span>
        </Button>

        <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions cwgsyw-wiki-tree__row-actions">
          {canWrite && (
            <>
              <NeutralTooltip content="新建" className="cwgsyw-tooltip--pill" side="right">
                <IconButton type="button" variant="ghost" size="sm" icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--plus" />} aria-label={`新建 ${node.title || '页面'} 的子页面`} onClick={() => handlers.onAddChild(node)} />
              </NeutralTooltip>
              <NeutralTooltip content="重命名" className="cwgsyw-tooltip--pill" side="right">
                <IconButton type="button" variant="ghost" size="sm" icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--edit" />} aria-label={`重命名 ${node.title || '页面'}`} onClick={() => handlers.onRename(node)} />
              </NeutralTooltip>
              <NeutralTooltip content="上移" className="cwgsyw-tooltip--pill" side="right">
                <IconButton type="button" variant="ghost" size="sm" icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-wiki-space-card__chevron cwgsyw-wiki-space-card__chevron--up" />} aria-label={`上移 ${node.title || '页面'}`} onClick={() => handlers.onMove(node, siblings, parentId, -1)} />
              </NeutralTooltip>
              <NeutralTooltip content="下移" className="cwgsyw-tooltip--pill" side="right">
                <IconButton type="button" variant="ghost" size="sm" icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-wiki-space-card__chevron" />} aria-label={`下移 ${node.title || '页面'}`} onClick={() => handlers.onMove(node, siblings, parentId, 1)} />
              </NeutralTooltip>
            </>
          )}
          {canDelete && (
            <NeutralTooltip content="删除" className="cwgsyw-tooltip--pill" side="right">
              <IconButton type="button" variant="ghost" size="sm" className="cwgsyw-cmdb-admin__delete-action" icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--trash" />} aria-label={`删除 ${node.title || '页面'}`} onClick={() => handlers.onDelete(node)} />
            </NeutralTooltip>
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
  const groupScope = useAuthStore((s) => s.groupScope)

  const { data: spaces } = useQuery<WikiSpace[]>({
    queryKey: ['wiki-spaces'],
    queryFn: () => wikiApi.listSpaces(),
  })
  const currentSpace = spaces?.find((s) => s.id === spaceId)

  const canWrite = currentSpace?.canCreatePage ?? false // 侧栏"新建"按钮：本质是空间级 create 权限
  const canDelete = hasPermission('wiki', 'delete') && canDeleteInSpace(currentSpace, groupScope)

  const [renameTarget, setRenameTarget] = useState<WikiPageTree | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WikiPageTree | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newParent, setNewParent] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const { data: tree } = useQuery<WikiPageTree[]>({
    queryKey: ['wiki-tree', spaceId],
    queryFn: () => wikiApi.getTree(spaceId),
    enabled: Boolean(currentSpace),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['wiki-tree', spaceId] })

  const createMutation = useMutation({
    mutationFn: () =>
      wikiApi.createPage({ spaceId: spaceId, parentId: newParent, title: newTitle.trim() }),
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
      setDeleteTarget(null)
      toast.success('页面已删除')
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '删除失败'
      toast.error(msg)
    },
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, sortOrder, parentId }: { id: number; sortOrder: number; parentId: number | null }) =>
      wikiApi.movePage(id, { parentId, sortOrder }),
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
      setDeleteTarget(node)
    },
    onMove: (node, siblings, parentId, dir) => {
      const idx = siblings.findIndex((s) => s.id === node.id)
      const swapIdx = idx + dir
      if (swapIdx < 0 || swapIdx >= siblings.length) return
      const target = siblings[swapIdx]
      moveMutation.mutate({ id: node.id, parentId: parentId, sortOrder: target.sortOrder })
    },
  }

  const roots = tree ?? []

  return (
    <div className="cwgsyw-wiki-tree">
      <div className="cwgsyw-wiki-tree__head">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/wiki/${spaceId}`)}
        >
          空间首页
        </Button>
        {canWrite && (
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--plus" />}
            aria-label="新建页面"
            onClick={() => {
              setNewParent(null)
              setNewTitle('')
              setCreateOpen(true)
            }}
          />
        )}
      </div>

      <div className="cwgsyw-wiki-tree__list">
        {roots.length === 0 ? (
          <p className="cwgsyw-wiki-tree__empty">
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
      <NeutralDialog open={createOpen} onOpenChange={setCreateOpen} title="新建页面" size="sm">
        <div>
          <div>
            <h2 className="cwgsyw-type-title-sm">{newParent ? '新建子页面' : '新建页面'}</h2>
          </div>
          <div className="py-2">
            <Input
              size="sm"
              placeholder="页面标题"
              value={newTitle}
              maxLength={WIKI_PAGE_TITLE_MAX_LENGTH}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim()) createMutation.mutate()
              }}
            />
          </div>
          <p className="text-right text-xs text-[var(--cwgsyw-text-secondary)]">{newTitle.length}/{WIKI_PAGE_TITLE_MAX_LENGTH}</p>
          <div className="cwgsyw-inline-controls">
            <Button type="button" variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!newTitle.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              创建并编辑
            </Button>
          </div>
        </div>
      </NeutralDialog>

      {/* Rename dialog */}
      <NeutralDialog open={!!renameTarget} onOpenChange={(v) => !v && setRenameTarget(null)} title="重命名页面" size="sm">
        <div>
          <div>
            <h2 className="cwgsyw-type-title-sm">重命名页面</h2>
          </div>
          <div className="py-2">
            <Input
              size="sm"
              value={renameValue}
              maxLength={WIKI_PAGE_TITLE_MAX_LENGTH}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameValue.trim() && renameTarget)
                  renameMutation.mutate(renameTarget)
              }}
            />
          </div>
          <p className="text-right text-xs text-[var(--cwgsyw-text-secondary)]">{renameValue.length}/{WIKI_PAGE_TITLE_MAX_LENGTH}</p>
          <div className="cwgsyw-inline-controls">
            <Button type="button" variant="secondary" size="sm" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!renameValue.trim() || renameMutation.isPending}
              onClick={() => renameTarget && renameMutation.mutate(renameTarget)}
            >
              保存
            </Button>
          </div>
        </div>
      </NeutralDialog>

      <NeutralAlertDialog
        open={!!deleteTarget}
        title="确认删除"
        description={
          deleteTarget && countDescendants(deleteTarget) > 0
            ? `确定要删除页面「${deleteTarget.title}」吗？包含 ${countDescendants(deleteTarget)} 个子页面，将一并删除。`
            : `确定要删除页面「${deleteTarget?.title ?? ''}」吗？`
        }
        intent="destructive"
        confirmLabel={deleteMutation.isPending ? '删除中…' : '确认删除'}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
    </div>
  )
}
