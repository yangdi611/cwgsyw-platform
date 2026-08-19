'use client'

import { type ReactNode, Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import { TaskEmpty, TaskPanel, IDENTITY_LOCK_ICON, IDENTITY_LOCK_NODE } from '@/components/task-runtime/TaskEmpty'
import {
  Button,
  Checkbox,
  DataManagementPage,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Select,
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

interface Role {
  id: number
  name: string
}

function PermissionsHeader({ action }: { action?: ReactNode }) {
  return (
    <PageHeader
      showEyebrow={false}
      showBreadcrumb={false}
      showSubtitle={false}
      title="权限配置"
      actions={action}
    />
  )
}

interface PermissionsEditorProps {
  roleId: string
  resources: Resource[]
  permissions: Permission[]
  rolePermissions: Permission[]
  rolePicker: ReactNode
}

function PermissionsEditor({ roleId, resources, permissions, rolePermissions, rolePicker }: PermissionsEditorProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(rolePermissions.map((permission) => permission.id)),
  )

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
      if (next.has(permId)) next.delete(permId)
      else next.add(permId)
      return next
    })
  }

  return (
    <DataManagementPage
      embedded
      className="cwgsyw-tasks-page"
      header={
        <PermissionsHeader
          action={
            <Button type="button" size="sm" variant="primary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? '保存中…' : '保存权限'}
            </Button>
          }
        />
      }
      filter={rolePicker}
      content={
        <div className="cwgsyw-tasks-permission-list">
          {resources.map((resource) => {
            const resourcePermissions = permissions.filter((permission) => permission.resourceId === resource.id)
            return (
              <TaskPanel key={resource.id} title={resource.name}>
                <div className="cwgsyw-tasks-option-grid__list">
                  {resourcePermissions.map((permission) => (
                    <Checkbox
                      key={permission.id}
                      className="cwgsyw-tasks-choice"
                      checked={selected.has(permission.id)}
                      onChange={() => toggle(permission.id)}
                      label={permission.action}
                    />
                  ))}
                </div>
              </TaskPanel>
            )
          })}
        </div>
      }
    />
  )
}

function PermissionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roleId = searchParams.get('roleId')

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/rbac/roles').then((r) => r.data.data.records as Role[]),
  })
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

  const rolePicker = (
    <div className="cwgsyw-tasks-toolbar">
      <Field label="角色">
        <Select
          size="sm"
          overlay
          placeholder="选择角色"
          value={roleId ?? ''}
          options={(rolesQuery.data ?? []).map((role) => ({ value: String(role.id), label: role.name }))}
          onChange={(value) => router.replace(value ? `/rbac/permissions?roleId=${value}` : '/rbac/permissions')}
        />
      </Field>
    </div>
  )

  if (!roleId) {
    return (
      <DataManagementPage
        embedded
        className="cwgsyw-tasks-page"
        header={<PermissionsHeader />}
        filter={rolePicker}
        content={
          <TaskEmpty
            iconSrc={IDENTITY_LOCK_ICON}
            figmaNode={IDENTITY_LOCK_NODE}
            title="请先选择角色"
            description="从上方选择角色，或从角色管理进入配置权限。"
            action={
              <Button type="button" size="sm" variant="secondary" onClick={() => router.push('/rbac/roles')}>
                返回角色管理
              </Button>
            }
          />
        }
      />
    )
  }

  if (resourcesQuery.isLoading || allPermsQuery.isLoading || rolePermsQuery.isLoading) {
    return <DataManagementPage embedded className="cwgsyw-tasks-page" header={<PermissionsHeader />} filter={rolePicker} content={<LoadingState label="正在加载权限…" />} />
  }

  if (resourcesQuery.isError || allPermsQuery.isError || rolePermsQuery.isError) {
    return (
      <DataManagementPage
        embedded
        className="cwgsyw-tasks-page"
        header={<PermissionsHeader />}
        filter={rolePicker}
        content={
          <ErrorState
            title="权限加载失败"
            description="无法读取角色权限，请稍后重试。"
            retry={
              <Button
                type="button"
                size="sm"
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
    <>
      <PermissionsEditor
        key={`${roleId}:${rolePermsQuery.dataUpdatedAt}`}
        roleId={roleId}
        resources={resourcesQuery.data ?? []}
        permissions={allPermsQuery.data ?? []}
        rolePermissions={rolePermsQuery.data ?? []}
        rolePicker={rolePicker}
      />
    </>
  )
}

export default function PermissionsPage() {
  return (
    <Suspense fallback={<LoadingState label="正在加载权限…" />}>
      <PermissionsContent />
    </Suspense>
  )
}
