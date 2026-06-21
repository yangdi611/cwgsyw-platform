'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import UserDialog from '@/components/user/UserDialog'
import { PageHeader, FilterBar, DataTable, Pagination, type ColumnDef } from '@/components/shared'
import { Plus, Search, Trash2, Pencil } from 'lucide-react'

interface User {
  id: number
  username: string
  real_name: string
  email: string
  phone?: string
  group_id?: number
  group_name?: string
  status: number
}

export default function UsersPage() {
  const { hasPermission } = usePermission()
  const canCreate = hasPermission('user', 'create')
  const canUpdate = hasPermission('user', 'update')
  const canDelete = hasPermission('user', 'delete')

  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  const pageSize = 20

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', page, keyword],
    queryFn: () =>
      api.get('/users', { params: { page, size: pageSize } }).then((r) => ({
        records: (r.data.data?.records ?? r.data.data) as User[],
        total: r.data.data?.total ?? 0,
      })),
  })

  const users = data?.records ?? []
  const total = data?.total ?? 0

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

  const columns: ColumnDef<User>[] = [
    {
      key: 'username',
      title: '用户名',
      render: (r) => <span className="font-semibold text-v2-fg">@{r.username}</span>,
    },
    {
      key: 'real_name',
      title: '真实姓名',
      render: (r) => <span className="text-v2-fg">{r.real_name || '-'}</span>,
    },
    {
      key: 'email',
      title: '邮箱',
      render: (r) => <span className="text-v2-muted">{r.email || '-'}</span>,
    },
    {
      key: 'group_name',
      title: '所属组',
      render: (r) => <span className="text-v2-fg">{r.group_name || '-'}</span>,
    },
    {
      key: 'status',
      title: '状态',
      render: (r) => (
        <StatusBadge status={r.status === 1 ? 'ok' : 'neutral'}>
          {r.status === 1 ? '启用' : '禁用'}
        </StatusBadge>
      ),
    },
    ...(canUpdate || canDelete
      ? [
          {
            key: 'actions',
            title: '操作',
            align: 'right' as const,
            render: (r: User) => (
              <div className="flex items-center justify-end gap-1">
                {canUpdate && (
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-v2-danger"
                    onClick={() => setDeleteTarget(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="身份与权限"
        title="用户管理"
        subtitle="维护平台用户账号、所属组与启用状态，按需分配角色与权限。"
        actions={
          canCreate ? (
            <Button variant="primary" onClick={handleNew}>
              <Plus className="h-4 w-4" />
              新建用户
            </Button>
          ) : undefined
        }
      />

      <FilterBar>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-v2-muted" />
          <Input
            placeholder="搜索用户名…"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </FilterBar>

      <DataTable
        columns={columns}
        data={users}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty={{ title: '暂无用户', description: '点击右上角"新建用户"添加第一个账号。' }}
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <UserDialog
        open={dialogOpen}
        mode={dialogMode}
        user={editUser}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除用户 <strong>@{deleteTarget?.username}</strong> 吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
