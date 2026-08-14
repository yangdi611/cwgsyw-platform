'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage, isAxiosError } from '@/lib/api-error'
import { CredentialRow } from '@/components/device/CredentialRow'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Chip,
  DetailDrawerPage,
  ErrorState,
  Field,
  Input,
  LoadingState,
  NeutralAlertDialog,
  PageHeader,
} from '@/design-system/figma-neutral/components'

interface Credential {
  id: number
  username: string
  description: string
  groupId: number | null
  groupName: string | null
}

interface DeviceDetail {
  id: number
  name: string
  ip: string
  deviceType: string
  category: string
  groupName: string
  description: string
  ciInstanceId: number | null
  ciInstanceName: string | null
  ciModelCode: string | null
  credentials: Credential[]
}

const DEVICE_TYPES = [
  { value: 'server', label: '服务器' },
  { value: 'network', label: '网络设备' },
  { value: 'security', label: '安全设备' },
  { value: 'cloud', label: '云资源' },
  { value: 'other', label: '其他' },
]

const ORG_GROUPS = [
  { id: 2, name: '数据库组' },
  { id: 3, name: '主机组' },
  { id: 4, name: '网络组' },
  { id: 5, name: '云平台组' },
]

function CredentialSection({
  group,
  credentials,
  canAdd,
  onAdd,
  onDeleted,
}: {
  group: { id: number | null; name: string }
  credentials: Credential[]
  canAdd: boolean
  onAdd: (groupId: number | null) => void
  onDeleted: () => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <section className="cwgsyw-permission-group">
      <div className="cwgsyw-permission-group__head">
        <Button type="button" variant="ghost" className="cwgsyw-inline-controls" onClick={() => setExpanded((current) => !current)}>
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          <strong>{group.name}</strong>
          <Chip label={String(credentials.length)} />
        </Button>
        {canAdd ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onAdd(group.id)}
          >
            添加
          </Button>
        ) : null}
      </div>
      {expanded ? (
        <div className="cwgsyw-stack-list">
          {credentials.length === 0 ? (
            <p className="cwgsyw-stack-list__empty">暂无账号</p>
          ) : (
            credentials.map((credential) => (
              <CredentialRow
                key={credential.id}
                credentialId={credential.id}
                username={credential.username}
                description={credential.description}
                onDeleted={onDeleted}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  )
}

export default function DeviceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission, isHydrated } = usePermission()
  const groupScope = useAuthStore((state) => state.groupScope)
  const userGroupId = useAuthStore((state) => state.groupId)

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<DeviceDetail>>({})
  const [addingToGroup, setAddingToGroup] = useState<number | null | undefined>(undefined)
  const [newCred, setNewCred] = useState({ username: '', password: '', description: '' })
  const [confirmDelete, setConfirmDelete] = useState(false)

  const canRead = isHydrated && hasPermission('device', 'read')
  const { data: device, isLoading, isError, error, refetch } = useQuery<DeviceDetail, unknown>({
    queryKey: ['device', id],
    queryFn: () => api.get(`/devices/${id}`).then((response) => response.data.data as DeviceDetail),
    enabled: canRead,
    retry: (failureCount, err: unknown) => {
      if (isAxiosError(err) && [403, 404].includes(err.response?.status ?? 0)) return false
      return failureCount < 2
    },
  })

  useBreadcrumbLabel(device?.name)

  const addCredMutation = useMutation({
    mutationFn: (groupId: number | null) =>
      api.post(`/devices/${id}/credentials`, { ...newCred, groupId }),
    onSuccess: () => {
      toast.success('账号已添加')
      queryClient.invalidateQueries({ queryKey: ['device', id] })
      setAddingToGroup(undefined)
      setNewCred({ username: '', password: '', description: '' })
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, '添加失败')),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      api.put(`/devices/${id}`, {
        category: editForm.category ?? null,
        description: editForm.description ?? null,
      }),
    onSuccess: () => {
      toast.success('设备信息已更新')
      queryClient.invalidateQueries({ queryKey: ['device', id] })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setEditing(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, '更新失败')),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/devices/${id}`),
    onSuccess: () => {
      toast.success('设备已删除')
      router.push('/devices')
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, '删除失败')),
  })

  const startEdit = () => {
    if (!device) return
    setEditForm({
      category: device.category,
      description: device.description,
    })
    setEditing(true)
  }

  if (isLoading) return <LoadingState label="正在加载设备…" />
  if (isError) {
    const status = isAxiosError(error) ? error.response?.status : undefined
    const message = status === 404 ? '设备不存在' : status === 403 ? '你没有访问该设备的权限' : `加载设备失败：${getApiErrorMessage(error, '请稍后重试')}`
    return (
      <ErrorState
        title="设备加载失败"
        description={message}
        retry={status !== 403 ? <Button type="button" variant="secondary" onClick={() => void refetch()}>重试</Button> : null}
      />
    )
  }
  if (!device) return <ErrorState title="设备不存在" description="无法找到该设备。" showRetry={false} />

  const typeLabels: Record<string, string> = Object.fromEntries(DEVICE_TYPES.map((item) => [item.value, item.label]))
  const credentials = device.credentials ?? []
  const isAdmin = groupScope === 'tenant' || groupScope === 'platform'
  const visibleGroups = isAdmin ? ORG_GROUPS : ORG_GROUPS.filter((group) => group.id === userGroupId)
  const ungroupedCreds = credentials.filter((credential) => credential.groupId == null)
  const invalidateDevice = () => queryClient.invalidateQueries({ queryKey: ['device', id] })

  return (
    <>
      <DetailDrawerPage
        embedded
        header={
          <PageHeader
            eyebrow="资源管理"
            title={device.name}
            subtitle={device.groupName || '设备详情与访问凭证'}
            breadcrumb={
              <Breadcrumb
                items={[
                  { href: '/', label: '工作台' },
                  { href: '/devices', label: '设备密码库' },
                  { label: device.name },
                ]}
              />
            }
            status={<Badge label={typeLabels[device.deviceType] ?? device.deviceType} tone="neutral" />}
            actions={
              <div className="cwgsyw-inline-controls">
                {device.category ? <Chip label={device.category} /> : null}
                <PermissionGuard resource="device" action="update">
                  <Button type="button" variant="secondary" size="sm" onClick={startEdit}>
                    编辑
                  </Button>
                </PermissionGuard>
                <PermissionGuard resource="device" action="delete">
                  <Button type="button" variant="destructive" size="sm" disabled={deleteMutation.isPending} onClick={() => setConfirmDelete(true)}>
                    删除
                  </Button>
                </PermissionGuard>
              </div>
            }
          />
        }
        content={
          <div className="cwgsyw-form">
            {editing ? (
              <Card title="编辑设备信息" description="名称、IP 和类型来自 CMDB，如需修改请去对应实例。">
                <div className="cwgsyw-form">
                  <dl className="cwgsyw-permission-grid">
                    <div>
                      <dt className="cwgsyw-type-label-xs">设备名称</dt>
                      <dd className="cwgsyw-type-body-sm">{device.name}</dd>
                    </div>
                    <div>
                      <dt className="cwgsyw-type-label-xs">IP 地址</dt>
                      <dd className="cwgsyw-type-body-sm">{device.ip || '-'}</dd>
                    </div>
                    <div>
                      <dt className="cwgsyw-type-label-xs">设备类型</dt>
                      <dd className="cwgsyw-type-body-sm">{DEVICE_TYPES.find((item) => item.value === device.deviceType)?.label ?? '其他'}</dd>
                    </div>
                    <div>
                      <dt className="cwgsyw-type-label-xs">关联 CMDB 实例</dt>
                      <dd className="cwgsyw-type-body-sm">{device.ciInstanceName ?? (device.ciInstanceId ? `实例 #${device.ciInstanceId}` : '-')}</dd>
                    </div>
                  </dl>
                  <Field htmlFor="device-category" label="分类标签">
                    <Input
                      id="device-category"
                      value={editForm.category ?? ''}
                      maxLength={64}
                      placeholder="生产/测试/开发"
                      onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))}
                    />
                  </Field>
                  <Field htmlFor="device-description" label="备注">
                    <Input
                      id="device-description"
                      value={editForm.description ?? ''}
                      maxLength={2000}
                      onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                    />
                  </Field>
                  <div className="cwgsyw-inline-controls">
                    <Button type="button" variant="primary" size="sm" loading={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                      保存
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                      取消
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            {!editing && (device.ip || device.description || device.ciInstanceId) ? (
              <div className="cwgsyw-page__metrics">
                {device.ip ? <Card title="IP 地址">{device.ip}</Card> : null}
                {device.ciInstanceId && device.ciModelCode ? (
                  <Card title="关联 CMDB 实例">
                    <Link href={`/cmdb/instances/by-model/${device.ciModelCode}/${device.ciInstanceId}`}>
                      {device.ciInstanceName ?? `实例 #${device.ciInstanceId}`}
                    </Link>
                  </Card>
                ) : null}
                {device.description ? <Card title="备注">{device.description}</Card> : null}
              </div>
            ) : null}

            {addingToGroup !== undefined ? (
              <Card
                title={`添加账号 — ${addingToGroup == null ? '通用' : ORG_GROUPS.find((group) => group.id === addingToGroup)?.name ?? '未知组'}`}
              >
                <div className="cwgsyw-form">
                  <Field htmlFor="cred-username" label="用户名" required>
                    <Input
                      id="cred-username"
                      value={newCred.username}
                      maxLength={128}
                      placeholder="root"
                      onChange={(event) => setNewCred((current) => ({ ...current, username: event.target.value }))}
                    />
                  </Field>
                  <Field htmlFor="cred-password" label="密码" required>
                    <Input
                      id="cred-password"
                      type="password"
                      value={newCred.password}
                      maxLength={1024}
                      placeholder="••••••••"
                      onChange={(event) => setNewCred((current) => ({ ...current, password: event.target.value }))}
                    />
                  </Field>
                  <Field htmlFor="cred-description" label="备注">
                    <Input
                      id="cred-description"
                      value={newCred.description}
                      maxLength={255}
                      placeholder="例：SSH 登录账号"
                      onChange={(event) => setNewCred((current) => ({ ...current, description: event.target.value }))}
                    />
                  </Field>
                  <div className="cwgsyw-inline-controls">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={addCredMutation.isPending}
                      disabled={!newCred.username || !newCred.password}
                      onClick={() => addCredMutation.mutate(addingToGroup ?? null)}
                    >
                      保存
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAddingToGroup(undefined)}>
                      取消
                    </Button>
                  </div>
                </div>
              </Card>
            ) : null}

            <div>
              <h2 className="cwgsyw-type-title-sm">账号密码</h2>
              {visibleGroups.map((group) => {
                const groupCreds = credentials.filter((credential) => credential.groupId === group.id)
                const canAdd = hasPermission('device', 'create') && (isAdmin || userGroupId === group.id)
                return (
                  <CredentialSection
                    key={group.id}
                    group={group}
                    credentials={groupCreds}
                    canAdd={canAdd}
                    onAdd={(groupId) => {
                      setAddingToGroup(groupId)
                      setNewCred({ username: '', password: '', description: '' })
                    }}
                    onDeleted={invalidateDevice}
                  />
                )
              })}
              {isAdmin && ungroupedCreds.length > 0 ? (
                <CredentialSection
                  group={{ id: null, name: '通用（无分组）' }}
                  credentials={ungroupedCreds}
                  canAdd={false}
                  onAdd={() => {}}
                  onDeleted={invalidateDevice}
                />
              ) : null}
            </div>
          </div>
        }
      />

      <NeutralAlertDialog
        open={confirmDelete}
        title="确认删除"
        description={`确定要删除设备 “${device.name}” 吗？`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => deleteMutation.mutate()}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(false)
        }}
      />
    </>
  )
}
