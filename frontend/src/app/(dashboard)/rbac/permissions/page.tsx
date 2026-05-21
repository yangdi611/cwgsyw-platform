'use client'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, Suspense } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

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
    queryFn: () =>
      api.get('/rbac/resources').then((r) => r.data.data as Resource[]),
  })

  const { data: allPerms } = useQuery({
    queryKey: ['all-permissions'],
    queryFn: () =>
      api.get('/rbac/permissions').then((r) => r.data.data as Permission[]),
  })

  const { data: rolePerms } = useQuery({
    queryKey: ['role-permissions', roleId],
    queryFn: () =>
      api
        .get(`/rbac/roles/${roleId}/permissions`)
        .then((r) => r.data.data as Permission[]),
    enabled: !!roleId,
  })

  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (rolePerms) setSelected(new Set(rolePerms.map((p) => p.id)))
  }, [rolePerms])

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/rbac/roles/${roleId}/permissions`, {
        permission_ids: [...selected],
      }),
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

  if (!roleId)
    return (
      <p className="text-muted-foreground">请从角色管理页选择角色后配置权限</p>
    )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">权限配置</h1>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? '保存中...' : '保存权限'}
        </Button>
      </div>
      <div className="space-y-6">
        {(resources ?? []).map((resource) => {
          const perms = (allPerms ?? []).filter(
            (p) => p.resource_id === resource.id
          )
          return (
            <div key={resource.id} className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">{resource.name}</h3>
              <div className="flex flex-wrap gap-4">
                {perms.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(perm.id)}
                      onCheckedChange={() => toggle(perm.id)}
                    />
                    <span className="text-sm">{perm.action}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PermissionsPage() {
  return (
    <Suspense fallback={<p>加载中...</p>}>
      <PermissionsContent />
    </Suspense>
  )
}
