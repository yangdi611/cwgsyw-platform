'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { RoleDialog } from '@/components/rbac/RoleDialog'
import '@/design-system/figma-neutral/index.css'
import {
  Badge,
  Breadcrumb,
  Button,
  DataManagementPage,
  EmptyState,
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
      { key: 'actions', label: '操作', align: 'right' as const },
    ],
    [],
  )

  const rows = roles.map((role) => ({
    id: String(role.id),
    disabled: role.isBuiltin,
    cells: {
      name: role.name,
      code: role.code,
      scope: <Badge label={scopeLabel[role.scope] ?? role.scope} tone="neutral" />,
      flags: (
        <div className="cwgsyw-inline-controls">
          {role.isBuiltin ? <Badge label="内置" tone="neutral" /> : null}
          {role.isLegacy ? <StatusBadge label="兼容角色" status="warning" /> : null}
        </div>
      ),
      description: role.description || '-',
      actions: (
        <div className="cwgsyw-inline-controls">
          {!role.isBuiltin && canUpdate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditRole(role)
                setDialogOpen(true)
              }}
            >
              编辑
            </Button>
          ) : null}
          {!role.isBuiltin && canDelete ? (
            <Button type="button" variant="ghost" size="sm" leadingIcon="trash" onClick={() => setDeleteTarget(role)}>
              删除
            </Button>
          ) : null}
          {!role.isBuiltin ? (
            <PermissionGuard resource="resource" action="assign">
              <Link href={`/rbac/permissions?roleId=${role.id}`}>
                <Button type="button" variant="outline" size="sm">
                  配置权限
                </Button>
              </Link>
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
        layout="default"
        header={
          <PageHeader
            eyebrow="身份与权限"
            title="角色管理"
            subtitle="查看系统角色与权限作用域，点击「配置权限」为角色分配资源操作。"
            breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: '角色管理' }]} />}
            actions={
              canCreate ? (
                <Button
                  type="button"
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
                <Button type="button" variant="secondary" onClick={() => refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <Table
              columns={columns}
              rows={rows}
              showSearch={false}
              state={tableState}
              loading={<LoadingState label="正在加载角色…" />}
              empty={<EmptyState title="暂无角色" description="系统角色由平台预置，将在初始化后显示。" />}
            />
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
