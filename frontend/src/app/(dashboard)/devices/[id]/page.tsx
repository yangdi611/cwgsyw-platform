'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

interface Group { id: number; name: string }

const DEVICE_TYPES = [
  { value: 'server',   label: '服务器' },
  { value: 'network',  label: '网络设备' },
  { value: 'security', label: '安全设备' },
  { value: 'cloud',    label: '云资源' },
  { value: 'other',    label: '其他' },
]

// Groups that manage credentials on devices
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
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2.5 bg-muted/40 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="font-medium text-sm">{group.name}</span>
          <Badge variant="secondary" className="text-xs">{credentials.length}</Badge>
        </div>
        {canAdd && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={e => { e.stopPropagation(); onAdd(group.id) }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />添加
          </Button>
        )}
      </div>
      {expanded && (
        <div className="px-4">
          {credentials.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">暂无账号</p>
          ) : (
            credentials.map(cred => (
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
  const groupScope = useAuthStore(s => s.groupScope)
  const userGroupId = useAuthStore(s => s.groupId)

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<DeviceDetail>>({})
  const [addingToGroup, setAddingToGroup] = useState<number | null | undefined>(undefined)
  const [newCred, setNewCred] = useState({ username: '', password: '', description: '' })

  const { data: device, isLoading } = useQuery({
    queryKey: ['device', id],
    queryFn: () => api.get(`/devices/${id}`).then(r => r.data.data as DeviceDetail),
  })

  const { data: allGroups = [] } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then(r => r.data.data?.records ?? r.data.data ?? []),
    enabled: hasPermission('device', 'update'),
  })

  const addCredMutation = useMutation({
    mutationFn: (groupId: number | null) => api.post(`/devices/${id}/credentials`, {
      ...newCred,
      group_id: groupId,
    }),
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

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>
  if (!device) return <p className="text-destructive">设备不存在</p>

  const typeLabels: Record<string, string> = {
    server: '服务器', network: '网络设备', security: '安全设备', cloud: '云资源', other: '其他'
  }

  const credentials = device.credentials ?? []
  const isAdmin = groupScope === 'tenant' || groupScope === 'platform'

  // Build group sections: for admins show all groups, for members show only their group
  const visibleGroups = isAdmin
    ? ORG_GROUPS
    : ORG_GROUPS.filter(g => g.id === userGroupId)

  // Credentials with no group (legacy / admin-only)
  const ungroupedCreds = credentials.filter(c => c.group_id == null)

  const invalidateDevice = () => queryClient.invalidateQueries({ queryKey: ['device', id] })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/devices" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ArrowLeft className="h-4 w-4 mr-1" />返回
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{device.name}</h1>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline">{typeLabels[device.device_type] ?? device.device_type}</Badge>
              {device.category && <Badge variant="secondary">{device.category}</Badge>}
              {device.group_name && <span className="text-sm text-muted-foreground">{device.group_name}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <PermissionGuard resource="device" action="update">
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Pencil className="h-4 w-4 mr-1" />编辑
            </Button>
          </PermissionGuard>
          <PermissionGuard resource="device" action="delete">
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <Trash2 className="h-4 w-4 mr-1" />删除
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">编辑设备信息</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>设备名称 *</Label>
                <Input value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>IP 地址</Label>
                <Input value={editForm.ip ?? ''} onChange={e => setEditForm(f => ({ ...f, ip: e.target.value }))} placeholder="192.168.1.1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>设备类型</Label>
                <Select value={editForm.device_type ?? 'server'} onValueChange={v => setEditForm(f => ({ ...f, device_type: v ?? 'server' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>分类标签</Label>
                <Input value={editForm.category ?? ''} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} placeholder="生产/测试/开发" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>备注</Label>
              <Input value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>关联 CMDB 实例</Label>
              <CiInstanceSelect
                value={editForm.ci_instance_id ?? null}
                onChange={id => setEditForm(f => ({ ...f, ci_instance_id: id }))}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => updateMutation.mutate()} disabled={!editForm.name || updateMutation.isPending}>保存</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Device Info */}
      {!editing && (device.ip || device.description || device.ci_instance_id) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {device.ip && (
            <Card>
              <CardHeader><CardTitle className="text-sm">IP 地址</CardTitle></CardHeader>
              <CardContent className="text-sm font-mono">{device.ip}</CardContent>
            </Card>
          )}
          {device.ci_instance_id && (
            <Card>
              <CardHeader><CardTitle className="text-sm">关联 CMDB 实例</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <Link href={`/cmdb/instances/${device.ci_instance_id}`} className="hover:underline text-primary">
                  {device.ci_instance_name ?? `实例 #${device.ci_instance_id}`}
                </Link>
              </CardContent>
            </Card>
          )}
          {device.description && (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-sm">备注</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{device.description}</CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Add Credential Form */}
      {addingToGroup !== undefined && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm">
              添加账号 — {addingToGroup == null ? '通用' : (ORG_GROUPS.find(g => g.id === addingToGroup)?.name ?? '未知组')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">用户名 *</Label>
                <Input value={newCred.username} onChange={e => setNewCred(p => ({ ...p, username: e.target.value }))} placeholder="root" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">密码 *</Label>
                <Input type="password" value={newCred.password} onChange={e => setNewCred(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">备注</Label>
              <Input value={newCred.description} onChange={e => setNewCred(p => ({ ...p, description: e.target.value }))} placeholder="例：SSH 登录账号" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addCredMutation.mutate(addingToGroup ?? null)}
                disabled={!newCred.username || !newCred.password || addCredMutation.isPending}>
                保存
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingToGroup(undefined)}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credentials by Group */}
      <div className="space-y-3">
        <h2 className="font-semibold text-base">账号密码</h2>

        {visibleGroups.map(group => {
          const groupCreds = credentials.filter(c => c.group_id === group.id)
          const canAdd = hasPermission('device', 'create') && (isAdmin || userGroupId === group.id)
          return (
            <CredentialSection
              key={group.id}
              group={group}
              credentials={groupCreds}
              canAdd={canAdd}
              onAdd={gid => { setAddingToGroup(gid); setNewCred({ username: '', password: '', description: '' }) }}
              onDeleted={invalidateDevice}
            />
          )
        })}

        {/* Ungrouped credentials — admin only */}
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
