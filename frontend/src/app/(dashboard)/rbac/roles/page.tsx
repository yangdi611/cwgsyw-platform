'use client'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card } from '@/components/v2/Card'
import { PageHeader, EmptyState } from '@/components/shared'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import Link from 'next/link'
import { Shield, ArrowRight } from 'lucide-react'

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

type ChipTone = 'default' | 'primary' | 'success'

function scopeTone(scope: string): ChipTone {
  if (scope === 'platform') return 'primary'
  if (scope === 'tenant') return 'success'
  return 'default'
}

function ScopeChip({ scope }: { scope: string }) {
  const cls: Record<ChipTone, string> = {
    default: 'border-v2-border bg-v2-surface-soft text-v2-fg',
    primary: 'border-v2-primary-border bg-v2-primary-soft text-v2-primary',
    success: 'border-v2-success-border bg-v2-success-soft text-v2-success',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${cls[scopeTone(scope)]}`}>
      {scopeLabel[scope] ?? scope}
    </span>
  )
}

export default function RolesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/rbac/roles').then((r) => r.data.data.records as Role[]),
  })

  const roles = data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="身份与权限"
        title="角色管理"
        subtitle="查看系统角色与权限作用域，点击「配置权限」为角色分配资源操作。"
      />

      {isLoading ? null : roles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Shield className="h-5 w-5 text-v2-muted" />}
            title="暂无角色"
            description="系统角色由平台预置，将在初始化后显示。"
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <Card key={role.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Shield className="h-4 w-4 text-v2-primary" />
                    <span className="font-semibold text-v2-fg">{role.name}</span>
                    <span className="text-sm text-v2-muted">({role.code})</span>
                    <ScopeChip scope={role.scope} />
                  </div>
                  {role.description && (
                    <p className="mt-1.5 text-sm text-v2-muted leading-relaxed">{role.description}</p>
                  )}
                </div>
                <PermissionGuard resource="resource" action="assign">
                  <Link
                    href={`/rbac/permissions?roleId=${role.id}`}
                    className="inline-flex shrink-0 items-center gap-1.5 h-9 px-3 text-sm font-semibold rounded-v2-md border border-v2-border bg-v2-surface text-v2-fg shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
                  >
                    配置权限
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </PermissionGuard>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
