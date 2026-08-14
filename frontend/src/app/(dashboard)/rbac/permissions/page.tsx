'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Checkbox,
  DataManagementPage,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/design-system/figma-neutral/components'

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
  resourceId: number
  action: string
}

function PermissionsContent() {
  const searchParams = useSearchParams()
  const roleId = searchParams.get('roleId')
  const queryClient = useQueryClient()

  const resourcesQuery = useQuery({
    queryKey: ['resources'],
    queryFn: () => api.get('/rbac/resources').then((r) => r.data.data as Resource[]),
    enabled: !!roleId,
  })

  const allPermsQuery = useQuery({
    queryKey: ['all-permissions'],
    queryFn: () => api.get('/rbac/permissions').then((r) => r.data.data as Permission[]),
    enabled: !!roleId,
  })

  const rolePermsQuery = useQuery({
    queryKey: ['role-permissions', roleId],
    queryFn: () => api.get(`/rbac/roles/${roleId}/permissions`).then((r) => r.data.data as Permission[]),
    enabled: !!roleId,
  })

  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (rolePermsQuery.data) {
      setSelected(new Set(rolePermsQuery.data.map((permission) => permission.id)))
    }
  }, [rolePermsQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/rbac/roles/${roleId}/permissions`, { permissionIds: [...selected] }),
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

  const header = (
    <PageHeader
      eyebrow="身份与权限"
      title="权限配置"
      subtitle="为当前角色勾选资源操作权限，修改后点击保存生效。"
      breadcrumb={
        <Breadcrumb
          items={[
            { href: '/', label: '工作台' },
            { href: '/rbac/roles', label: '角色管理' },
            { label: '权限配置' },
          ]}
        />
      }
      actions={
        roleId ? (
          <Button type="button" variant="primary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? '保存中…' : '保存权限'}
          </Button>
        ) : null
      }
    />
  )

  if (!roleId) {
    return (
      <DataManagementPage
        embedded
        header={header}
        content={<EmptyState title="请先选择角色" description="从角色管理页点击「配置权限」进入此页面。" />}
      />
    )
  }

  if (resourcesQuery.isLoading || allPermsQuery.isLoading || rolePermsQuery.isLoading) {
    return <DataManagementPage embedded header={header} content={<LoadingState label="正在加载权限…" />} />
  }

  if (resourcesQuery.isError || allPermsQuery.isError || rolePermsQuery.isError) {
    return (
      <DataManagementPage
        embedded
        header={header}
        content={
          <ErrorState
            title="权限加载失败"
            description="无法读取角色权限，请稍后重试。"
            retry={
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  resourcesQuery.refetch()
                  allPermsQuery.refetch()
                  rolePermsQuery.refetch()
                }}
              >
                重试
              </Button>
            }
          />
        }
      />
    )
  }

  return (
    <DataManagementPage
      embedded
      header={header}
      content={
        <div className="cwgsyw-form">
          {(resourcesQuery.data ?? []).map((resource) => {
            const perms = (allPermsQuery.data ?? []).filter((permission) => permission.resourceId === resource.id)
            return (
              <section key={resource.id} className="cwgsyw-permission-group">
                <div className="cwgsyw-permission-group__head">
                  <h3 className="cwgsyw-type-title-sm">{resource.name}</h3>
                </div>
                <div className="cwgsyw-permission-group__body cwgsyw-inline-controls">
                  {perms.map((permission) => (
                    <Checkbox
                      key={permission.id}
                      checked={selected.has(permission.id)}
                      onChange={() => toggle(permission.id)}
                      label={permission.action}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      }
    />
  )
}

export default function PermissionsPage() {
  return (
    <Suspense fallback={<LoadingState label="正在加载权限…" />}>
      <PermissionsContent />
    </Suspense>
  )
}
