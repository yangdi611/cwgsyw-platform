'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import UserDialog from '@/components/user/UserDialog'

interface User {
  id: number
  username: string
  real_name: string
  email: string
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', page, keyword],
    queryFn: () =>
      api.get('/users', { params: { page, size: 20 } }).then((r) => ({
        records: (r.data.data?.records ?? r.data.data) as User[],
        total: r.data.data?.total ?? 0,
      })),
  })

  const users = data?.records ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
        {canCreate && (
          <Button onClick={handleNew}>+ 新建用户</Button>
        )}
      </div>

      <div className="mb-4">
        <Input
          placeholder="搜索用户名..."
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1) }}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : users.length === 0 ? (
        <p className="text-muted-foreground">暂无用户</p>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">用户名</th>
                  <th className="text-left p-3 text-sm font-medium">真实姓名</th>
                  <th className="text-left p-3 text-sm font-medium">邮箱</th>
                  <th className="text-left p-3 text-sm font-medium">状态</th>
                  {(canUpdate || canDelete) && (
                    <th className="text-right p-3 text-sm font-medium">操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="p-3 text-sm font-medium">@{user.username}</td>
                    <td className="p-3 text-sm">{user.real_name || '-'}</td>
                    <td className="p-3 text-sm text-muted-foreground">{user.email || '-'}</td>
                    <td className="p-3">
                      <Badge variant={user.status === 1 ? 'default' : 'secondary'}>
                        {user.status === 1 ? '启用' : '禁用'}
                      </Badge>
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="p-3 text-right">
                        {canUpdate && (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                            编辑
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteTarget(user)}>
                            删除
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>共 {total} 条</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  上一页
                </Button>
                <span className="px-3 py-1">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  下一页
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <UserDialog
        open={dialogOpen}
        mode={dialogMode}
        user={editUser}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除用户 <strong>@{deleteTarget?.username}</strong> 吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
