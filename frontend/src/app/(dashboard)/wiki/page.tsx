'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { wikiApi } from '@/lib/wiki-api'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { ErrorState, LoadingState, PageHeader, EmptyState } from '@/components/shared'
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from '@/components/design-system'
import {
  BookOpen,
  Library,
  Plus,
  FileText,
  ArrowRight,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Shield,
  Search,
} from 'lucide-react'
import type { WikiSpace } from '@/types/wiki'
import { canWriteSpace } from '@/types/wiki'
import { ResourceAccessDialog } from '@/components/authorization/ResourceAccessDialog'

/** 个人空间排序：按当前用户 username 隔离存 localStorage（非全局，每人各自的顺序）。 */
function orderStorageKey(username: string | undefined): string {
  return `wiki_space_order_${username ?? 'anon'}`
}

function loadPersonalOrder(username: string | undefined): number[] {
  try {
    const raw = localStorage.getItem(orderStorageKey(username))
    return raw ? (JSON.parse(raw) as number[]) : []
  } catch {
    return []
  }
}

function savePersonalOrder(username: string | undefined, ids: number[]): void {
  try {
    localStorage.setItem(orderStorageKey(username), JSON.stringify(ids))
  } catch {
    /* ignore quota errors */
  }
}

/** 把后端返回的空间列表按个人顺序排列：已记录的按记录顺序，未记录的（新空间）排末尾。 */
function applyPersonalOrder(spaces: WikiSpace[], order: number[]): WikiSpace[] {
  const pos = new Map(order.map((id, i) => [id, i]))
  return [...spaces].sort((a, b) => {
    const pa = pos.has(a.id) ? (pos.get(a.id) as number) : Number.MAX_SAFE_INTEGER
    const pb = pos.has(b.id) ? (pos.get(b.id) as number) : Number.MAX_SAFE_INTEGER
    if (pa !== pb) return pa - pb
    return a.id - b.id // 同为新空间时按 id 稳定排序
  })
}

export default function WikiSpacesPage() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const queryClient = useQueryClient()
  const username = useAuthStore((s) => s.user?.username)
  const groupId = useAuthStore((s) => s.groupId)
  const groupScope = useAuthStore((s) => s.groupScope)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<WikiSpace | null>(null) // null=新建，非空=编辑
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ownerGroupId, setOwnerGroupId] = useState('')
  const [deleting, setDeleting] = useState<WikiSpace | null>(null)
  const [aclTarget, setAclTarget] = useState<WikiSpace | null>(null)
  const [order, setOrder] = useState<number[]>([])

  const effectiveOwnerGroupId = !editing && groupScope === 'group' ? String(groupId ?? '') : ownerGroupId

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('wiki', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  // 加载个人排序（username 就绪后）
  useEffect(() => {
    // Persisted browser state changes when the hydrated username becomes available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(loadPersonalOrder(username))
  }, [username])

  const { data: spaces, isLoading, isError, refetch } = useQuery<WikiSpace[]>({
    queryKey: ['wiki-spaces'],
    queryFn: wikiApi.listSpaces,
  })
  const { data: groups = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['authorization-groups'],
    queryFn: () => api.get('/groups').then((response) => response.data.data ?? []),
    enabled: hasPermission('group', 'read'),
  })

  const canCreate = hasPermission('wiki', 'create')
  const canUpdate = hasPermission('wiki', 'update')
  const canDelete = hasPermission('wiki', 'delete')

  // 两层：官方手册（system seed 空间，置顶固定）+ 团队空间（用户创建，可个人排序）
  const manualSpaces = useMemo(
    () => (spaces ?? []).filter((s) => s.system),
    [spaces],
  )
  const teamSpaces = useMemo(
    () => applyPersonalOrder((spaces ?? []).filter((s) => !s.system), order),
    [spaces, order],
  )

  // 上移/下移：仅作用于团队空间，更新个人顺序并持久化（仅本人 localStorage，不动后端）
  const move = useCallback(
    (index: number, dir: -1 | 1) => {
      const ids = teamSpaces.map((s) => s.id)
      const target = index + dir
      if (target < 0 || target >= ids.length) return
      ;[ids[index], ids[target]] = [ids[target], ids[index]]
      setOrder(ids)
      savePersonalOrder(username, ids)
    },
    [teamSpaces, username],
  )

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? wikiApi.updateSpace(editing.id, { name: name.trim(), description: description.trim() })
        : wikiApi.createSpace({ name: name.trim(), description: description.trim(),
          ownerGroupId: effectiveOwnerGroupId ? Number(effectiveOwnerGroupId) : undefined }),
    onSuccess: (space) => {
      queryClient.invalidateQueries({ queryKey: ['wiki-spaces'] })
      const wasCreate = !editing
      setCreateOpen(false)
      setEditing(null)
      setName('')
      setDescription('')
      setOwnerGroupId('')
      toast.success(wasCreate ? '空间已创建' : '空间已更新')
      if (wasCreate && space) router.push(`/wiki/${space.id}`)
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (editing ? '更新失败' : '创建失败')
      toast.error(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => wikiApi.deleteSpace(id),
    onSuccess: (_void, id) => {
      queryClient.invalidateQueries({ queryKey: ['wiki-spaces'] })
      // 从个人顺序里移除
      const next = order.filter((x) => x !== id)
      setOrder(next)
      savePersonalOrder(username, next)
      setDeleting(null)
      toast.success('空间已删除')
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '删除失败'
      toast.error(msg)
      setDeleting(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setCreateOpen(true)
  }

  function openEdit(s: WikiSpace) {
    setEditing(s)
    setName(s.name)
    setDescription(s.description ?? '')
    setCreateOpen(true)
  }

  // 渲染单个空间卡片。idx 仅团队空间传入（带上移/下移）；手册卡不传，无排序。
  function renderSpaceCard(s: WikiSpace, idx?: number) {
    const sortable = idx !== undefined
    const writable = canWriteSpace(s)
    return (
      <Card
        key={s.id}
        hover
        onClick={() => router.push(`/wiki/${s.id}`)}
        className="flex cursor-pointer flex-col p-5"
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-v2-md bg-v2-primary-soft text-v2-primary">
            {s.system ? <Library className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-v2-fg">{s.name}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-v2-muted">
              <FileText className="h-3 w-3" />
              {s.pageCount} 篇文档
            </p>
          </div>
          {sortable && (
            <div className="flex shrink-0 flex-col">
              <button
                title="上移"
                disabled={idx === 0}
                onClick={(e) => { e.stopPropagation(); move(idx, -1) }}
                className="flex h-5 w-5 items-center justify-center rounded text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                title="下移"
                disabled={idx === teamSpaces.length - 1}
                onClick={(e) => { e.stopPropagation(); move(idx, 1) }}
                className="flex h-5 w-5 items-center justify-center rounded text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <p className="mb-4 line-clamp-2 min-h-[2.5rem] flex-1 text-sm text-v2-muted">
          {s.description || '暂无描述'}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-v2-subtle">
            {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString('zh-CN') : '—'}
            {s.createdByName ? ` · ${s.createdByName}` : ''}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {(canUpdate && writable) || s.canManageAcl ? (
              <button
                title="重命名"
                onClick={(e) => { e.stopPropagation(); openEdit(s) }}
                className="flex h-7 w-7 items-center justify-center rounded text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {s.canManageAcl && (
              <button
                title="授权管理"
                onClick={(e) => { e.stopPropagation(); setAclTarget(s) }}
                className="flex h-7 w-7 items-center justify-center rounded text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg"
              >
                <Shield className="h-3.5 w-3.5" />
              </button>
            )}
            {canDelete && writable && (
              <button
                title="删除"
                onClick={(e) => { e.stopPropagation(); setDeleting(s) }}
                className="flex h-7 w-7 items-center justify-center rounded text-v2-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/wiki/${s.id}`) }}>
              进入
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="知识库"
        title="知识空间"
        subtitle="按团队或主题组织知识空间，集中沉淀运维文档、规范与排障经验。"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/wiki/search')}>
              <Search className="h-4 w-4" />
              搜索知识库
            </Button>
            {canCreate && (
              <Button variant="primary" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新建空间
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <LoadingState label="正在加载知识空间…" minHeight={220} />
      ) : isError ? (
        <Card>
          <ErrorState
            title="知识空间加载失败"
            description="无法读取知识空间列表，请重试。"
            onRetry={() => void refetch()}
          />
        </Card>
      ) : manualSpaces.length === 0 && teamSpaces.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="h-5 w-5 text-v2-muted" />}
            title="暂无知识空间"
            description="还没有任何知识空间，点击右上角创建第一个空间开始沉淀文档。"
            action={
              canCreate && (
                <Button variant="primary" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  新建空间
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {/* 第一层：官方手册（系统维护，置顶固定） */}
          {manualSpaces.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-v2-muted">
                <Library className="h-3.5 w-3.5 text-v2-primary" />
                官方手册
                <span className="rounded-full bg-v2-primary-soft px-2 py-0.5 text-[10px] font-medium normal-case text-v2-primary">
                  系统维护
                </span>
                <span className="h-px flex-1 bg-v2-border" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {manualSpaces.map((s) => renderSpaceCard(s))}
              </div>
            </section>
          )}

          {/* 第二层：团队空间（用户创建，可个人排序） */}
          {teamSpaces.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-v2-muted">
                <BookOpen className="h-3.5 w-3.5" />
                团队空间
                <span className="h-px flex-1 bg-v2-border" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {teamSpaces.map((s, idx) => renderSpaceCard(s, idx))}
              </div>
            </section>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑知识空间' : '新建知识空间'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="空间名称（必填）"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              placeholder="空间描述（选填）"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {!editing && (
              <label className="block space-y-1 text-sm text-v2-fg">
                <span>归属组（必选）</span>
                <select className="h-9 w-full rounded-v2-sm border border-v2-border bg-v2-surface px-2" value={effectiveOwnerGroupId} disabled={groupScope === 'group'} onChange={(event) => setOwnerGroupId(event.target.value)}>
                  <option value="">请选择归属组</option>
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
                {groupScope === 'group' && <span className="text-xs text-v2-muted">组级用户固定为当前会话归属组。</span>}
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim() || (!editing && !effectiveOwnerGroupId) || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {editing ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除知识空间</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-v2-fg">
            确定删除空间「{deleting?.name}」吗？
            {(deleting?.pageCount ?? 0) > 0 && (
              <p className="mt-2 text-xs text-amber-600">
                该空间下还有 {deleting?.pageCount} 篇文档，需先删除全部页面才能删除空间。
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {aclTarget && (
        <ResourceAccessDialog resourceType="wiki_space" resourceId={aclTarget.id}
          title={aclTarget.name} container open={!!aclTarget}
          onOpenChange={(open) => { if (!open) setAclTarget(null) }} />
      )}
    </div>
  )
}
