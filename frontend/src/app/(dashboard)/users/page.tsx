'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  NeutralAlertDialog,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'
import UserDialog from '@/components/user/UserDialog'
import { UserAuthorizationDialog } from '@/components/user/UserAuthorizationDialog'

interface User {
  id: number
  username: string
  realName: string
  email: string
  phone?: string
  groupId?: number
  groupName?: string
  status: number
  mustChangePassword?: boolean
}

export default function UsersPage() {
  const { hasPermission, isHydrated } = usePermission()
  const canRead = isHydrated && hasPermission('user', 'read')
  const canCreate = hasPermission('user', 'create')
  const canUpdate = hasPermission('user', 'update')
  const canDelete = hasPermission('user', 'delete')

  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [authorizationTarget, setAuthorizationTarget] = useState<User | null>(null)

  const pageSize = 20

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users', page, keyword],
    queryFn: () =>
      api.get('/users', { params: { page, size: pageSize } }).then((r) => ({
        records: (r.data.data?.records ?? r.data.data) as User[],
        total: r.data.data?.total ?? 0,
      })),
    enabled: canRead,
  })

  const users = data?.records ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1)

  const handleNew = () => {
    setDialogMode('create')
    setEditUser(null)
    setDialogOpen(true)
  }

  const handleEdit = (user: User) => {
    setDialogMode('edit')
    setEditUser(user)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/users/${deleteTarget.id}`)
      toast.success('用户已删除')
      setDeleteTarget(null)
      refetch()
    } catch {
      toast.error('删除失败')
    }
  }

  const columns = useMemo(
    () => [
      { key: 'username', label: '用户名' },
      { key: 'realName', label: '真实姓名' },
      { key: 'email', label: '邮箱' },
      { key: 'groupName', label: '所属组' },
      { key: 'status', label: '状态' },
      ...(canUpdate || canDelete ? [{ key: 'actions', label: '操作', align: 'right' as const }] : []),
    ],
    [canDelete, canUpdate],
  )

  const rows = users.map((user) => ({
    id: String(user.id),
    cells: {
      username: `@${user.username}`,
      realName: user.realName || '-',
      email: user.email || '-',
      groupName: user.groupName || '-',
      status: (
        <StatusBadge
          label={user.status === 1 ? '启用' : '禁用'}
          status={user.status === 1 ? 'success' : 'neutral'}
        />
      ),
      actions: (
        <div className="cwgsyw-inline-controls">
          {canUpdate ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setAuthorizationTarget(user)}>
              授权
            </Button>
          ) : null}
          {canUpdate ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => handleEdit(user)}>
              编辑
            </Button>
          ) : null}
          {canDelete ? (
            <Button type="button" size="sm" variant="ghost" leadingIcon="trash" onClick={() => setDeleteTarget(user)}>
              删除
            </Button>
          ) : null}
        </div>
      ),
    },
  }))

  if (!canRead) return null

  const tableState = isLoading ? 'loading' : users.length === 0 ? 'empty' : 'data'

  return (
    <>
      <DataManagementPage
        embedded
        layout="default"
        header={
          <PageHeader
            eyebrow="身份与权限"
            title="用户管理"
            subtitle="维护平台用户账号、所属组与启用状态，按需分配角色与权限。"
            breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: '用户管理' }]} />}
            actions={
              canCreate ? (
                <Button type="button" variant="primary" onClick={handleNew}>
                  新建用户
                </Button>
              ) : null
            }
          />
        }
        filter={
          <FilterBar
            search={
              <SearchInput
                value={keyword}
                placeholder="搜索用户名…"
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setPage(1)
                }}
                onClear={() => {
                  setKeyword('')
                  setPage(1)
                }}
              />
            }
          />
        }
        content={
          isError ? (
            <ErrorState
              title="用户加载失败"
              description="无法读取用户列表，请稍后重试。"
              retry={
                <Button type="button" variant="secondary" onClick={() => refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <>
              <Table
                columns={columns}
                rows={rows}
                showSearch={false}
                state={tableState}
                loading={<LoadingState label="正在加载用户…" />}
                empty={
                  <EmptyState
                    title="暂无用户"
                    description='点击右上角“新建用户”添加第一个账号。'
                    action={
                      canCreate ? (
                        <Button type="button" variant="primary" onClick={handleNew}>
                          新建用户
                        </Button>
                      ) : null
                    }
                  />
                }
              />
              <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={setPage} />
            </>
          )
        }
      />

      <UserDialog
        open={dialogOpen}
        mode={dialogMode}
        user={editUser}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      <NeutralAlertDialog
        open={!!deleteTarget}
        title="确认删除"
        description={`确定要删除用户 @${deleteTarget?.username ?? ''} 吗？此操作不可撤销。`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />

      <UserAuthorizationDialog
        user={authorizationTarget}
        open={!!authorizationTarget}
        onClose={() => setAuthorizationTarget(null)}
      />
    </>
  )
}
