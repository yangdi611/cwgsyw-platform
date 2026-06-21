'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/v2/Card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CredentialRow } from '@/components/device/CredentialRow'
import { CiInstanceSelect } from '@/components/cmdb/CiInstanceSelect'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { toast } from 'sonner'
import { Plus, ArrowLeft, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/lib/utils'

interface Credential {
  id: number
  username: string
  description: string
  group_id: number | null
  group_name: string | null
}

interface DeviceDetail {
  id: number
  name: string
  ip: string
  device_type: string
  category: string
  group_name: string
  description: string
  ci_instance_id: number | null
  ci_instance_name: string | null
  credentials: Credential[]
}

interface Group {
  id: number
  name: string
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

function Chip({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'primary' | 'neutral' }) {
  const cls =
    tone === 'primary'
      ? 'border-v2-primary-border bg-v2-primary-soft text-v2-primary'
      : 'border-v2-border bg-v2-surface-soft text-v2-fg'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${cls}`}>
      {children}
    </span>
  )
}

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
    <div className="overflow-hidden rounded-v2-md border border-v2-border bg-v2-surface">
      <div
        className="flex cursor-pointer select-none items-center justify-between bg-v2-surface-soft px-4 py-2.5"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-v2-muted" />
          ) : (
            <ChevronRight className="h-4 w-4 text-v2-muted" />
          )}
          <span className="text-sm font-semibold text-v2-fg">{group.name}</span>
          <Chip>{credentials.length}</Chip>
        </div>
        {canAdd && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onAdd(group.id)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            添加
          </Button>
        )}
      </div>
      {expanded && (
        <div className="px-4">
          {credentials.length === 0 ? (
            <p className="py-3 text-center text-xs text-v2-muted">暂无账号</p>
          ) : (
            credentials.map((cred) => (
              <CredentialRow
                key={cred.id}
                credentialId={cred.id}
                username={cred.username}
                description={cred.description}
                onDeleted={onDeleted}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function DeviceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const groupScope = useAuthStore((s) => s.groupScope)
  const userGroupId = useAuthStore((s) => s.groupId)

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<DeviceDetail>>({})
  const [addingToGroup, setAddingToGroup] = useState<number | null | undefined>(undefined)
  const [newCred, setNewCred] = useState({ username: '', password: '', description: '' })

  const { data: device, isLoading } = useQuery({
    queryKey: ['device', id],
    queryFn: () => api.get(`/devices/${id}`).then((r) => r.data.data as DeviceDetail),
  })

  const { data: allGroups = [] } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => r.data.data?.records ?? r.data.data ?? []),
    enabled: hasPermission('device', 'update'),
  })

  const addCredMutation = useMutation({
    mutationFn: (groupId: number | null) =>
      api.post(`/devices/${id}/credentials`, { ...newCred, group_id: groupId }),
    onSuccess: () => {
      toast.success('账号已添加')
      queryClient.invalidateQueries({ queryKey: ['device', id] })
      setAddingToGroup(undefined)
      setNewCred({ username: '', password: '', description: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '添加失败'),
  })

  const updateMutation = useMutation({
    mutationFn: () => api.put(`/devices/${id}`, editForm),
    onSuccess: () => {
      toast.success('设备信息已更新')
      queryClient.invalidateQueries({ queryKey: ['device', id] })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      setEditing(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/devices/${id}`),
    onSuccess: () => {
      toast.success('设备已删除')
      router.push('/devices')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const startEdit = () => {
    if (!device) return
    setEditForm({
      name: device.name,
      ip: device.ip,
      device_type: device.device_type,
      category: device.category,
      description: device.description,
      ci_instance_id: device.ci_instance_id,
    })
    setEditing(true)
  }

  const handleDelete = () => {
    if (!confirm(`确定要删除设备 "${device?.name}" 吗？`)) return
    deleteMutation.mutate()
  }

  if (isLoading) return <p className="text-v2-muted">加载中…</p>
  if (!device) return <p className="text-v2-danger">设备不存在</p>

  const typeLabels: Record<string, string> = {
    server: '服务器',
    network: '网络设备',
    security: '安全设备',
    cloud: '云资源',
    other: '其他',
  }

  const credentials = device.credentials ?? []
  const isAdmin = groupScope === 'tenant' || groupScope === 'platform'

  const visibleGroups = isAdmin ? ORG_GROUPS : ORG_GROUPS.filter((g) => g.id === userGroupId)
  const ungroupedCreds = credentials.filter((c) => c.group_id == null)
  const invalidateDevice = () => queryClient.invalidateQueries({ queryKey: ['device', id] })

  return (
    <div className="space-y-6">
      {/* Title bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/devices"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-v2-fg">{device.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Chip tone="primary">{typeLabels[device.device_type] ?? device.device_type}</Chip>
              {device.category && <Chip>{device.category}</Chip>}
              {device.group_name && <span className="text-sm text-v2-muted">{device.group_name}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <PermissionGuard resource="device" action="update">
            <Button variant="secondary" size="sm" onClick={startEdit}>
              <Pencil className="h-4 w-4" />
              编辑
            </Button>
          </PermissionGuard>
          <PermissionGuard resource="device" action="delete">
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <Trash2 className="h-4 w-4" />
              删除
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">编辑设备信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>设备名称 *</Label>
                <Input
                  value={editForm.name ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>IP 地址</Label>
                <Input
                  value={editForm.ip ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, ip: e.target.value }))}
                  placeholder="192.168.1.1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>设备类型</Label>
                <Select
                  value={editForm.device_type ?? 'server'}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, device_type: v ?? 'server' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>分类标签</Label>
                <Input
                  value={editForm.category ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="生产/测试/开发"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>备注</Label>
              <Input
                value={editForm.description ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>关联 CMDB 实例</Label>
              <CiInstanceSelect
                value={editForm.ci_instance_id ?? null}
                onChange={(cid) => setEditForm((f) => ({ ...f, ci_instance_id: cid }))}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => updateMutation.mutate()}
                disabled={!editForm.name || updateMutation.isPending}
              >
                保存
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Device Info */}
      {!editing && (device.ip || device.description || device.ci_instance_id) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {device.ip && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">IP 地址</CardTitle>
              </CardHeader>
              <CardContent className="font-v2-mono text-sm text-v2-fg">{device.ip}</CardContent>
            </Card>
          )}
          {device.ci_instance_id && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">关联 CMDB 实例</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <Link
                  href={`/cmdb/instances/by-model/host/${device.ci_instance_id}`}
                  className="font-semibold text-v2-primary hover:text-v2-primary-hover"
                >
                  {device.ci_instance_name ?? `实例 #${device.ci_instance_id}`}
                </Link>
              </CardContent>
            </Card>
          )}
          {device.description && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">备注</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-v2-muted">{device.description}</CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Add Credential Form */}
      {addingToGroup !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              添加账号 —{' '}
              {addingToGroup == null
                ? '通用'
                : ORG_GROUPS.find((g) => g.id === addingToGroup)?.name ?? '未知组'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">用户名 *</Label>
                <Input
                  value={newCred.username}
                  onChange={(e) => setNewCred((p) => ({ ...p, username: e.target.value }))}
                  placeholder="root"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">密码 *</Label>
                <Input
                  type="password"
                  value={newCred.password}
                  onChange={(e) => setNewCred((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">备注</Label>
              <Input
                value={newCred.description}
                onChange={(e) => setNewCred((p) => ({ ...p, description: e.target.value }))}
                placeholder="例：SSH 登录账号"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => addCredMutation.mutate(addingToGroup ?? null)}
                disabled={!newCred.username || !newCred.password || addCredMutation.isPending}
              >
                保存
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAddingToGroup(undefined)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credentials by Group */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-v2-fg">账号密码</h2>

        {visibleGroups.map((group) => {
          const groupCreds = credentials.filter((c) => c.group_id === group.id)
          const canAdd = hasPermission('device', 'create') && (isAdmin || userGroupId === group.id)
          return (
            <CredentialSection
              key={group.id}
              group={group}
              credentials={groupCreds}
              canAdd={canAdd}
              onAdd={(gid) => {
                setAddingToGroup(gid)
                setNewCred({ username: '', password: '', description: '' })
              }}
              onDeleted={invalidateDevice}
            />
          )
        })}

        {isAdmin && ungroupedCreds.length > 0 && (
          <CredentialSection
            group={{ id: null, name: '通用（无分组）' }}
            credentials={ungroupedCreds}
            canAdd={false}
            onAdd={() => {}}
            onDeleted={invalidateDevice}
          />
        )}
      </div>
    </div>
  )
}
