'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { usePermission } from '@/hooks/usePermission'
import UserDialog from '@/components/user/UserDialog'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 300)
    return () => clearTimeout(timer)
  }, [keyword])

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, debouncedKeyword],
    queryFn: () =>
      api
        .get('/users', {
          params: { page, size: 20, keyword: debouncedKeyword || undefined },
        })
        .then((r) => r.data.data as { records: User[]; total: number; page: number; size: number }),
  })

  const users = data?.records ?? []
  const total = data?.total ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success('用户已删除')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
        {hasPermission('user', 'create') && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            新增用户
          </Button>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 max-w-sm"
          placeholder="搜索用户名、姓名或邮箱..."
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            setPage(1)
          }}
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>所属组织</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              (users).map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.real_name || '-'}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>{user.phone || '-'}</TableCell>
                  <TableCell>{user.group_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === 1 ? 'default' : 'secondary'}>
                      {user.status === 1 ? '启用' : '禁用'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {hasPermission('user', 'update') && (
                        <Button variant="ghost" size="icon" onClick={() => { setEditUser(user); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {hasPermission('user', 'delete') && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(user)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>共 {total} 条，第 {page} 页</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            上一页
          </Button>
          <Button variant="outline" size="sm" disabled={users.length < 20} onClick={() => setPage(p => p + 1)}>
            下一页
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除用户「{deleteTarget?.username}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setEditUser(null)
          setDialogOpen(open)
        }}
        user={editUser ?? undefined}
      />
    </div>
  )
}
