'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { usePermission } from '@/hooks/usePermission'
import UserDialog from '@/components/user/UserDialog'
import { Plus, Search } from 'lucide-react'

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
  const { hasPermission } = usePermission()

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
        .then((r) => r.data.data.records as User[]),
  })

  const [dialogOpen, setDialogOpen] = useState(false)

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
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              (data ?? []).map((user) => (
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <UserDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
