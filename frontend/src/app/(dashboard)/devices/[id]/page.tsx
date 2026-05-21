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
import { CredentialRow } from '@/components/device/CredentialRow'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { toast } from 'sonner'
import { Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface DeviceDetail {
  id: number
  name: string
  ip: string
  device_type: string
  category: string
  group_name: string
  description: string
  credentials: { id: number; username: string; description: string }[]
}

export default function DeviceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showAddCred, setShowAddCred] = useState(false)
  const [newCred, setNewCred] = useState({ username: '', password: '', description: '' })

  const { data: device, isLoading } = useQuery({
    queryKey: ['device', id],
    queryFn: () => api.get(`/devices/${id}`).then(r => r.data.data as DeviceDetail),
  })

  const addCredMutation = useMutation({
    mutationFn: () => api.post(`/devices/${id}/credentials`, newCred),
    onSuccess: () => {
      toast.success('账号已添加')
      queryClient.invalidateQueries({ queryKey: ['device', id] })
      setShowAddCred(false)
      setNewCred({ username: '', password: '', description: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '添加失败'),
  })

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>
  if (!device) return <p className="text-destructive">设备不存在</p>

  const typeLabels: Record<string, string> = {
    server: '服务器', network: '网络设备', security: '安全设备', cloud: '云资源', other: '其他'
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {device.ip && (
          <Card>
            <CardHeader><CardTitle className="text-sm">IP 地址</CardTitle></CardHeader>
            <CardContent className="text-sm font-mono">{device.ip}</CardContent>
          </Card>
        )}
        {device.description && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-sm">备注</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{device.description}</CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>账号密码</CardTitle>
            <PermissionGuard resource="device" action="create">
              <Button size="sm" variant="outline" onClick={() => setShowAddCred(!showAddCred)}>
                <Plus className="h-4 w-4 mr-1" />添加账号
              </Button>
            </PermissionGuard>
          </div>
        </CardHeader>
        <CardContent>
          {showAddCred && (
            <div className="mb-4 p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">用户名 *</Label>
                  <Input value={newCred.username}
                    onChange={e => setNewCred(p => ({ ...p, username: e.target.value }))}
                    placeholder="root" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">密码 *</Label>
                  <Input type="password" value={newCred.password}
                    onChange={e => setNewCred(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">备注</Label>
                <Input value={newCred.description}
                  onChange={e => setNewCred(p => ({ ...p, description: e.target.value }))}
                  placeholder="例：SSH 登录账号" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => addCredMutation.mutate()}
                  disabled={!newCred.username || !newCred.password || addCredMutation.isPending}>
                  保存
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddCred(false)}>取消</Button>
              </div>
            </div>
          )}

          {(device.credentials ?? []).length === 0 && !showAddCred ? (
            <p className="text-sm text-muted-foreground text-center py-6">暂无账号</p>
          ) : (
            (device.credentials ?? []).map(cred => (
              <CredentialRow key={cred.id} credentialId={cred.id}
                username={cred.username} description={cred.description} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
