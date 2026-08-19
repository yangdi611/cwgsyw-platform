'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { RoleDialog } from '@/components/rbac/RoleDialog'
import { IdentityIconAction } from '@/components/identity/IdentityActions'
import { TaskEmpty, IDENTITY_LOCK_ICON, IDENTITY_LOCK_NODE } from '@/components/task-runtime/TaskEmpty'
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import {
  Button,
  DataManagementPage,
  ErrorState,
  LoadingState,
  NeutralAlertDialog,
  PageHeader,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

interface Role {
  id: number
  name: string
  code: string
  scope: string
  description: string
  roleType: 'management' | 'functional'
  isBuiltin: boolean
  isLegacy: boolean
}

const scopeLabel: Record<string, string> = {
  group: '组级',
  tenant: '租户级',
  platform: '平台级',
}

export default function RolesPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRole, setEditRole] = useState<Role | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/rbac/roles').then((r) => r.data.data.records as Role[]),
  })

  const roles = data ?? []
  const canCreate = hasPermission('role', 'create')
  const canUpdate = hasPermission('role', 'update')
  const canDelete = hasPermission('role', 'delete')

  const removeRole = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/rbac/roles/${deleteTarget.id}`)
      toast.success('角色已删除')
      setDeleteTarget(null)
      refetch()
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '删除角色失败'))
    }
  }

  const columns = useMemo(
    () => [
      { key: 'name', label: '角色' },
      { key: 'code', label: '编码' },
      { key: 'scope', label: '作用域' },
      { key: 'flags', label: '标记' },
      { key: 'description', label: '描述' },
      { key: 'actions', label: '', align: 'right' as const },
    ],
    [],
  )

  const rows = roles.map((role) => ({
    id: String(role.id),
    disabled: role.isBuiltin,
    cells: {
      name: <p className="cwgsyw-tasks-cell-title">{role.name}</p>,
      code: role.code,
      scope: <StatusBadge label={scopeLabel[role.scope] ?? role.scope} status="neutral" />,
      flags: (
        <div className="cwgsyw-inline-controls">
          {role.isBuiltin ? <StatusBadge label="内置" status="neutral" /> : null}
          {role.isLegacy ? <StatusBadge label="兼容角色" status="warning" /> : null}
        </div>
      ),
      description: role.description || '-',
      actions: (
        <div className="cwgsyw-inline-controls">
          {!role.isBuiltin && canUpdate ? (
            <IdentityIconAction
              label={`编辑 ${role.name}`}
              icon="edit"
              onClick={() => {
                setEditRole(role)
                setDialogOpen(true)
              }}
            />
          ) : null}
          {!role.isBuiltin && canDelete ? (
            <IdentityIconAction label={`删除 ${role.name}`} icon="trash" danger onClick={() => setDeleteTarget(role)} />
          ) : null}
          {!role.isBuiltin ? (
            <PermissionGuard resource="resource" action="assign">
              <Button type="button" variant="secondary" size="sm" onClick={() => router.push(`/rbac/permissions?roleId=${role.id}`)}>
                配置权限
              </Button>
            </PermissionGuard>
          ) : null}
        </div>
      ),
    },
  }))

  const tableState = isLoading ? 'loading' : roles.length === 0 ? 'empty' : 'data'

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-tasks-page"
        layout="default"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            showSubtitle={false}
            title="角色管理"
            actions={
              canCreate ? (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setEditRole(null)
                    setDialogOpen(true)
                  }}
                >
                  新建功能角色
                </Button>
              ) : null
            }
          />
        }
        content={
          isError ? (
            <ErrorState
              title="角色加载失败"
              description="无法读取角色列表，请稍后重试。"
              retry={
                <Button type="button" size="sm" variant="secondary" onClick={() => refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <div className="cwgsyw-cmdb-table">
              <Table
                columns={columns}
                rows={rows}
                showSearch={false}
                density="compact"
                state={tableState}
                loading={<LoadingState label="正在加载角色…" />}
                empty={
                  <TaskEmpty
                    iconSrc={IDENTITY_LOCK_ICON}
                    figmaNode={IDENTITY_LOCK_NODE}
                    title="暂无角色"
                    description="系统角色由平台预置，将在初始化后显示。"
                  />
                }
              />
            </div>
          )
        }
      />

      <RoleDialog
        open={dialogOpen}
        role={editRole}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      <NeutralAlertDialog
        open={!!deleteTarget}
        title="确认删除"
        description={`确定删除角色「${deleteTarget?.name ?? ''}」吗？`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={removeRole}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
    </>
  )
}
