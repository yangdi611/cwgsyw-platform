'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import { wikiApi } from '@/lib/wiki-api'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import type { WikiSpace } from '@/types/wiki'
import { canWriteSpace } from '@/types/wiki'
import { ResourceAccessDialog } from '@/components/authorization/ResourceAccessDialog'
import '@/design-system/figma-neutral/index.css'
import {
  Badge,
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  LoadingState,
  NeutralAlertDialog,
  NeutralDialog,
  NeutralTooltip,
  PageHeader,
  Select,
  Textarea,
} from '@/design-system/figma-neutral/components'

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

function applyPersonalOrder(spaces: WikiSpace[], order: number[]): WikiSpace[] {
  const pos = new Map(order.map((id, index) => [id, index]))
  return [...spaces].sort((left, right) => {
    const leftPos = pos.has(left.id) ? (pos.get(left.id) as number) : Number.MAX_SAFE_INTEGER
    const rightPos = pos.has(right.id) ? (pos.get(right.id) as number) : Number.MAX_SAFE_INTEGER
    if (leftPos !== rightPos) return leftPos - rightPos
    return left.id - right.id
  })
}

export default function WikiSpacesPage() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const queryClient = useQueryClient()
  const username = useAuthStore((state) => state.user?.username)
  const groupId = useAuthStore((state) => state.groupId)
  const groupScope = useAuthStore((state) => state.groupScope)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<WikiSpace | null>(null)
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

  const manualSpaces = useMemo(() => (spaces ?? []).filter((space) => space.system), [spaces])
  const teamSpaces = useMemo(
    () => applyPersonalOrder((spaces ?? []).filter((space) => !space.system), order),
    [spaces, order],
  )

  const move = useCallback(
    (index: number, dir: -1 | 1) => {
      const ids = teamSpaces.map((space) => space.id)
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
        : wikiApi.createSpace({
            name: name.trim(),
            description: description.trim(),
            ownerGroupId: effectiveOwnerGroupId ? Number(effectiveOwnerGroupId) : undefined,
          }),
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
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (editing ? '更新失败' : '创建失败')
      toast.error(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => wikiApi.deleteSpace(id),
    onSuccess: (_void, id) => {
      queryClient.invalidateQueries({ queryKey: ['wiki-spaces'] })
      const next = order.filter((item) => item !== id)
      setOrder(next)
      savePersonalOrder(username, next)
      setDeleting(null)
      toast.success('空间已删除')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '删除失败'
      toast.error(message)
      setDeleting(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setName('')
    setDescription('')
    setCreateOpen(true)
  }

  function openEdit(space: WikiSpace) {
    setEditing(space)
    setName(space.name)
    setDescription(space.description ?? '')
    setCreateOpen(true)
  }

  function renderSpaceCard(space: WikiSpace, idx?: number) {
    const sortable = idx !== undefined
    const writable = canWriteSpace(space)
    return (
      <article
        key={space.id}
        className="cwgsyw-wiki-space-card"
        onClick={() => router.push(`/wiki/${space.id}`)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') router.push(`/wiki/${space.id}`)
        }}
        role="link"
        tabIndex={0}
      >
        <div className="cwgsyw-wiki-space-card__body">
          <div className="cwgsyw-wiki-space-card__title-row">
            <span className="cwgsyw-wiki-space-card__name">{space.name}</span>
            {space.system ? <Badge label="官方手册" /> : null}
            {sortable ? (
              <span className="cwgsyw-wiki-space-card__sort">
                <NeutralTooltip content="上移" className="cwgsyw-tooltip--pill" followCursor>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-wiki-space-card__chevron cwgsyw-wiki-space-card__chevron--up" />}
                    aria-label={`上移 ${space.name}`}
                    disabled={idx === 0}
                    onClick={(event) => {
                      event.stopPropagation()
                      move(idx, -1)
                    }}
                  />
                </NeutralTooltip>
                <NeutralTooltip content="下移" className="cwgsyw-tooltip--pill" followCursor>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-wiki-space-card__chevron" />}
                    aria-label={`下移 ${space.name}`}
                    disabled={idx === teamSpaces.length - 1}
                    onClick={(event) => {
                      event.stopPropagation()
                      move(idx, 1)
                    }}
                  />
                </NeutralTooltip>
              </span>
            ) : null}
          </div>
          <p className="cwgsyw-wiki-space-card__meta">{space.pageCount} 篇文档</p>
          <p className="cwgsyw-wiki-space-card__desc">{space.description || '暂无描述'}</p>
          <div className="cwgsyw-wiki-space-card__footer">
            <span className="cwgsyw-wiki-space-card__stamp">
              {space.updatedAt ? new Date(space.updatedAt).toLocaleDateString('zh-CN') : '—'}
              {space.createdByName ? ` · ${space.createdByName}` : ''}
            </span>
            <span className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions" onClick={(event) => event.stopPropagation()}>
            {(canUpdate && writable) || space.canManageAcl ? (
              <NeutralTooltip content="重命名" className="cwgsyw-tooltip--pill" followCursor>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--edit" />}
                  aria-label={`重命名 ${space.name}`}
                  onClick={() => openEdit(space)}
                />
              </NeutralTooltip>
            ) : null}
            {space.canManageAcl ? (
              <NeutralTooltip content="授权" className="cwgsyw-tooltip--pill" followCursor>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--settings" />}
                  aria-label={`授权 ${space.name}`}
                  onClick={() => setAclTarget(space)}
                />
              </NeutralTooltip>
            ) : null}
            {canDelete && writable ? (
              <NeutralTooltip content="删除" className="cwgsyw-tooltip--pill" followCursor>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="cwgsyw-cmdb-admin__delete-action"
                  icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--trash" />}
                  aria-label={`删除 ${space.name}`}
                  onClick={() => setDeleting(space)}
                />
              </NeutralTooltip>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/wiki/${space.id}`)}
            >
              进入
            </Button>
            </span>
          </div>
        </div>
      </article>
    )
  }

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-wiki"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="知识空间"
            subtitle="按团队或主题组织知识空间，集中沉淀运维文档、规范与排障经验。"
            actions={
              <div className="cwgsyw-inline-controls cwgsyw-wiki__header-actions">
                <Button type="button" variant="secondary" size="sm" onClick={() => router.push('/wiki/search')}>
                  搜索知识库
                </Button>
                {canCreate ? (
                  <Button type="button" size="sm" onClick={openCreate}>
                    新建空间
                  </Button>
                ) : null}
              </div>
            }
          />
        }
        content={
          isLoading ? (
            <LoadingState label="正在加载知识空间…" />
          ) : isError ? (
            <ErrorState
              title="知识空间加载失败"
              description="无法读取知识空间列表，请重试。"
              retry={<Button type="button" variant="secondary" onClick={() => void refetch()}>重试</Button>}
            />
          ) : manualSpaces.length === 0 && teamSpaces.length === 0 ? (
            <div className="cwgsyw-neutral-empty">
              {/* Official Figma library glyph; image optimization adds no value here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/figma-icons/wiki-library.svg" width={22} height={22} alt="" data-figma-node="6:27530" />
              <EmptyState
                showIcon={false}
                title="暂无知识空间"
                description="还没有任何知识空间，点击右上角创建第一个空间开始沉淀文档。"
                action={canCreate ? <Button type="button" size="sm" onClick={openCreate}>新建空间</Button> : undefined}
              />
            </div>
          ) : (
            <div className="cwgsyw-wiki-spaces">
              {manualSpaces.length > 0 ? (
                <section className="cwgsyw-wiki-spaces__section">
                  <header className="cwgsyw-wiki-spaces__head">
                    <span>官方手册</span>
                    <Badge label="系统维护" />
                  </header>
                  <div className="cwgsyw-wiki-spaces__grid">{manualSpaces.map((space) => renderSpaceCard(space))}</div>
                </section>
              ) : null}
              {teamSpaces.length > 0 ? (
                <section className="cwgsyw-wiki-spaces__section">
                  <header className="cwgsyw-wiki-spaces__head">
                    <span>团队空间</span>
                  </header>
                  <div className="cwgsyw-wiki-spaces__grid">{teamSpaces.map((space, index) => renderSpaceCard(space, index))}</div>
                </section>
              ) : null}
            </div>
          )
        }
      />

      <NeutralDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={editing ? '编辑知识空间' : '新建知识空间'}
        size="sm"
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button
              type="button"
              size="sm"
              disabled={!name.trim() || (!editing && !effectiveOwnerGroupId) || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {editing ? '保存' : '创建'}
            </Button>
          </>
        }
      >
        <div className="cwgsyw-form">
          <Field htmlFor="wiki-space-name" label="空间名称" required>
            <Input size="sm" value={name} placeholder="空间名称（必填）" onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field htmlFor="wiki-space-desc" label="空间描述">
            <Textarea value={description} rows={3} placeholder="空间描述（选填）" onChange={(event) => setDescription(event.target.value)} />
          </Field>
          {!editing ? (
            <Field htmlFor="wiki-space-group" label="归属组" required helperText={groupScope === 'group' ? '组级用户固定为当前会话归属组。' : undefined}>
              <Select
                overlay
                size="sm"
                value={effectiveOwnerGroupId}
                disabled={groupScope === 'group'}
                placeholder="请选择归属组"
                options={[{ value: '', label: '请选择归属组' }, ...groups.map((group) => ({ value: String(group.id), label: group.name }))]}
                onChange={setOwnerGroupId}
              />
            </Field>
          ) : null}
        </div>
      </NeutralDialog>

      <NeutralAlertDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        intent="destructive"
        title="删除知识空间"
        description={
          deleting
            ? `确定删除空间「${deleting.name}」吗？${(deleting.pageCount ?? 0) > 0 ? ` 该空间下还有 ${deleting.pageCount} 篇文档，需先删除全部页面才能删除空间。` : ''}`
            : undefined
        }
        confirmLabel="删除"
        cancelLabel="取消"
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
        }}
      />

      {aclTarget ? (
        <ResourceAccessDialog
          resourceType="wiki_space"
          resourceId={aclTarget.id}
          title={aclTarget.name}
          container
          open={!!aclTarget}
          onOpenChange={(open) => { if (!open) setAclTarget(null) }}
        />
      ) : null}
    </>
  )
}
