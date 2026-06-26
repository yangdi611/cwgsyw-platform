'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { wikiApi } from '@/lib/wiki-api'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { Input } from '@/components/v2/Input'
import { Textarea } from '@/components/v2/Textarea'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { PageHeader, EmptyState } from '@/components/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/v2/Dialog'
import {
  BookOpen,
  Plus,
  FileText,
  ArrowRight,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import type { WikiSpace } from '@/types/wiki'

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

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<WikiSpace | null>(null) // null=新建，非空=编辑
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deleting, setDeleting] = useState<WikiSpace | null>(null)
  const [order, setOrder] = useState<number[]>([])

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('wiki', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  // 加载个人排序（username 就绪后）
  useEffect(() => {
    setOrder(loadPersonalOrder(username))
  }, [username])

  const { data: spaces, isLoading } = useQuery<WikiSpace[]>({
    queryKey: ['wiki-spaces'],
    queryFn: wikiApi.listSpaces,
  })

  const canCreate = hasPermission('wiki', 'create')
  const canUpdate = hasPermission('wiki', 'update')
  const canDelete = hasPermission('wiki', 'delete')

  // 应用个人顺序后的展示列表
  const list = useMemo(
    () => applyPersonalOrder(spaces ?? [], order),
    [spaces, order],
  )

  // 上移/下移：更新个人顺序并持久化（仅本人 localStorage，不动后端）
  const move = useCallback(
    (index: number, dir: -1 | 1) => {
      const ids = list.map((s) => s.id)
      const target = index + dir
      if (target < 0 || target >= ids.length) return
      ;[ids[index], ids[target]] = [ids[target], ids[index]]
      setOrder(ids)
      savePersonalOrder(username, ids)
    },
    [list, username],
  )

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? wikiApi.updateSpace(editing.id, { name: name.trim(), description: description.trim() })
        : wikiApi.createSpace({ name: name.trim(), description: description.trim() }),
    onSuccess: (space) => {
      queryClient.invalidateQueries({ queryKey: ['wiki-spaces'] })
      const wasCreate = !editing
      setCreateOpen(false)
      setEditing(null)
      setName('')
      setDescription('')
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="知识库"
        title="知识空间"
        subtitle="按团队或主题组织知识空间，集中沉淀运维文档、规范与排障经验。"
        actions={
          canCreate && (
            <Button variant="primary" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新建空间
            </Button>
          )
        }
      />

      {isLoading ? null : list.length === 0 ? (
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s, idx) => (
            <Card key={s.id} hover className="flex flex-col p-5">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-v2-md bg-v2-primary-soft text-v2-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-v2-fg">{s.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-v2-muted">
                    <FileText className="h-3 w-3" />
                    {s.page_count} 篇文档
                  </p>
                </div>
                {/* 个人排序：上移/下移（仅本人 localStorage，非全局） */}
                <div className="flex shrink-0 flex-col">
                  <button
                    title="上移"
                    disabled={idx === 0}
                    onClick={() => move(idx, -1)}
                    className="flex h-5 w-5 items-center justify-center rounded text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    title="下移"
                    disabled={idx === list.length - 1}
                    onClick={() => move(idx, 1)}
                    className="flex h-5 w-5 items-center justify-center rounded text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mb-4 line-clamp-2 min-h-[2.5rem] flex-1 text-sm text-v2-muted">
                {s.description || '暂无描述'}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs text-v2-subtle">
                  {s.updated_at
                    ? new Date(s.updated_at).toLocaleDateString('zh-CN')
                    : '—'}
                  {s.created_by_name ? ` · ${s.created_by_name}` : ''}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {canUpdate && (
                    <button
                      title="重命名"
                      onClick={() => openEdit(s)}
                      className="flex h-7 w-7 items-center justify-center rounded text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      title="删除"
                      onClick={() => setDeleting(s)}
                      className="flex h-7 w-7 items-center justify-center rounded text-v2-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/wiki/${s.id}`)}>
                    进入
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
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
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim() || saveMutation.isPending}
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
            {(deleting?.page_count ?? 0) > 0 && (
              <p className="mt-2 text-xs text-amber-600">
                该空间下还有 {deleting?.page_count} 篇文档，需先删除全部页面才能删除空间。
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
    </div>
  )
}
