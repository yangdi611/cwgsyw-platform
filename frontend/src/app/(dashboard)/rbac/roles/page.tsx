'use client'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import Link from 'next/link'

interface Role {
  id: number
  name: string
  code: string
  scope: string
  description: string
}

const scopeLabel: Record<string, string> = {
  group: '组级',
  tenant: '租户级',
  platform: '平台级',
}

export default function RolesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () =>
      api.get('/rbac/roles').then((r) => r.data.data.records as Role[]),
  })

  const roles = data ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">角色管理</h1>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : (
        <div className="space-y-2">
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-card"
            >
              <div>
                <span className="font-medium">{role.name}</span>
                <span className="text-muted-foreground text-sm ml-2">
                  ({role.code})
                </span>
                {role.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {role.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {scopeLabel[role.scope] ?? role.scope}
                </Badge>
                <PermissionGuard resource="resource" action="assign">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/rbac/permissions?roleId=${role.id}`}>
                      配置权限
                    </Link>
                  </Button>
                </PermissionGuard>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
