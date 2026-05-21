'use client'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'

interface User {
  id: number
  username: string
  real_name: string
  email: string
  status: number
}

export default function UsersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () =>
      api.get('/users').then((r) => r.data.data.records as User[]),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">用户管理</h1>
      {isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div>
                <span className="font-medium">{user.real_name ?? user.username}</span>
                <span className="text-muted-foreground text-sm ml-2">
                  @{user.username}
                </span>
                {user.email && (
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                )}
              </div>
              <Badge variant={user.status === 1 ? 'default' : 'secondary'}>
                {user.status === 1 ? '启用' : '禁用'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
