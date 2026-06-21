'use client'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, Suspense } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { PageHeader, EmptyState } from '@/components/shared'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'

interface Resource {
  id: number
  code: string
  name: string
  actions: string[]
}

interface Permission {
  id: number
  code: string
  name: string
  resource_id: number
  action: string
}

function PermissionsContent() {
  const searchParams = useSearchParams()
  const roleId = searchParams.get('roleId')
  const queryClient = useQueryClient()

  const { data: resources } = useQuery({
    queryKey: ['resources'],
    queryFn: () => api.get('/rbac/resources').then((r) => r.data.data as Resource[]),
  })

  const { data: allPerms } = useQuery({
    queryKey: ['all-permissions'],
    queryFn: () => api.get('/rbac/permissions').then((r) => r.data.data as Permission[]),
  })

  const { data: rolePerms } = useQuery({
    queryKey: ['role-permissions', roleId],
    queryFn: () =>
      api.get(`/rbac/roles/${roleId}/permissions`).then((r) => r.data.data as Permission[]),
    enabled: !!roleId,
  })

  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (rolePerms) setSelected(new Set(rolePerms.map((p) => p.id)))
  }, [rolePerms])

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/rbac/roles/${roleId}/permissions`, { permission_ids: [...selected] }),
    onSuccess: () => {
      toast.success('权限已保存')
      queryClient.invalidateQueries({ queryKey: ['role-permissions', roleId] })
    },
    onError: () => toast.error('保存失败'),
  })

  const toggle = (permId: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(permId) ? next.delete(permId) : next.add(permId)
      return next
    })
  }

  if (!roleId) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldCheck className="h-5 w-5 text-v2-muted" />}
          title="请先选择角色"
          description="从角色管理页点击「配置权限」进入此页面。"
        />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="身份与权限"
        title="权限配置"
        subtitle="为当前角色勾选资源操作权限，修改后点击保存生效。"
        actions={
          <Button variant="primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? '保存中…' : '保存权限'}
          </Button>
        }
      />

      <div className="space-y-4">
        {(resources ?? []).map((resource) => {
          const perms = (allPerms ?? []).filter((p) => p.resource_id === resource.id)
          return (
            <Card key={resource.id} className="p-4">
              <h3 className="mb-3 font-semibold text-v2-fg">{resource.name}</h3>
              <div className="flex flex-wrap gap-4">
                {perms.map((perm) => (
                  <label key={perm.id} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={selected.has(perm.id)}
                      onCheckedChange={() => toggle(perm.id)}
                    />
                    <span className="text-sm text-v2-fg">{perm.action}</span>
                  </label>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default function PermissionsPage() {
  return (
    <Suspense fallback={<p className="text-v2-muted">加载中…</p>}>
      <PermissionsContent />
    </Suspense>
  )
}
