'use client'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react'

/* ---------- Types ---------- */

interface IpAllocationVO {
  id: number
  poolId: number
  ipAddress: string
  status: string
  ciInstanceId: number | null
  ciInstanceName: string | null
  description: string | null
  allocatedBy: number | null
  allocatedByName: string | null
  allocatedAt: string | null
  releasedAt: string | null
}

interface IpPoolDetailVO {
  id: number
  name: string
  description: string
  cidr: string
  gateway: string
  dns: string
  status: string
  totalCount: number
  allocatedCount: number
  utilizationPercent: number
  createdAt: string
  updatedAt: string
  allocations: IpAllocationVO[]
}

/* ---------- Component ---------- */

export default function IpamDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()

  const [allocateOpen, setAllocateOpen] = useState(false)
  const [allocateForm, setAllocateForm] = useState({
    ipAddress: '', ciInstanceId: null as number | null, description: '',
  })
  const [releaseTarget, setReleaseTarget] = useState<IpAllocationVO | null>(null)

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', gateway: '', dns: '' })

  useEffect(() => {
    if (!hasPermission('ip_pool', 'read')) router.replace('/')
  }, [hasPermission, router])

  // Fetch pool detail
  const { data: pool, isLoading } = useQuery({
    queryKey: ['ip-pool', id],
    queryFn: () => api.get(`/ip-pools/${id}`).then(r => r.data.data as IpPoolDetailVO),
    enabled: hasPermission('ip_pool', 'read'),
  })

  // Allocate IP
  const allocateMutation = useMutation({
    mutationFn: (body: typeof allocateForm) => api.post(`/ip-pools/${id}/allocate`, body),
    onSuccess: () => {
      toast.success('IP 已分配')
      queryClient.invalidateQueries({ queryKey: ['ip-pool', id] })
      queryClient.invalidateQueries({ queryKey: ['ip-pools'] })
      setAllocateOpen(false)
      setAllocateForm({ ipAddress: '', ciInstanceId: null, description: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '分配失败'),
  })

  // Release IP
  const releaseMutation = useMutation({
    mutationFn: (ipAddress: string) => api.post(`/ip-pools/${id}/release`, { ipAddress }),
    onSuccess: () => {
      toast.success('IP 已释放')
      queryClient.invalidateQueries({ queryKey: ['ip-pool', id] })
      queryClient.invalidateQueries({ queryKey: ['ip-pools'] })
      setReleaseTarget(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '释放失败'),
  })

  // Update pool
  const updateMutation = useMutation({
    mutationFn: () => api.put(`/ip-pools/${id}`, editForm),
    onSuccess: () => {
      toast.success('地址池信息已更新')
      queryClient.invalidateQueries({ queryKey: ['ip-pool', id] })
      queryClient.invalidateQueries({ queryKey: ['ip-pools'] })
      setEditing(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  const startEdit = () => {
    if (!pool) return
    setEditForm({
      name: pool.name,
      description: pool.description || '',
      gateway: pool.gateway || '',
      dns: pool.dns || '',
    })
    setEditing(true)
  }

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>
  if (!pool) return <p className="text-destructive">地址池不存在</p>

  const pct = pool.utilizationPercent
  const activeAllocations = pool.allocations.filter(a => a.status === 'allocated')

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/ipam" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ArrowLeft className="h-4 w-4 mr-1" />返回
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{pool.name}</h1>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="font-mono">{pool.cidr}</Badge>
              <Badge variant={pool.status === 'active' ? 'default' : pool.status === 'full' ? 'destructive' : 'secondary'}>
                {pool.status === 'active' ? '活跃' : pool.status === 'full' ? '已满' : '已禁用'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <PermissionGuard resource="ip_pool" action="update">
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Pencil className="h-4 w-4 mr-1" />编辑
            </Button>
          </PermissionGuard>
          <PermissionGuard resource="ip_pool" action="update">
            <Button size="sm" onClick={() => setAllocateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />分配 IP
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">编辑地址池信息</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>名称</Label>
                <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>网关</Label>
                <Input value={editForm.gateway} onChange={e => setEditForm(f => ({ ...f, gateway: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>DNS</Label>
                <Input value={editForm.dns} onChange={e => setEditForm(f => ({ ...f, dns: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>描述</Label>
                <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>保存</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">CIDR</CardTitle></CardHeader>
          <CardContent className="text-sm font-mono">{pool.cidr}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">网关</CardTitle></CardHeader>
          <CardContent className="text-sm font-mono">{pool.gateway || '-'}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">DNS</CardTitle></CardHeader>
          <CardContent className="text-sm font-mono">{pool.dns || '-'}</CardContent>
        </Card>
        {pool.description && (
          <Card>
            <CardHeader><CardTitle className="text-sm">描述</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{pool.description}</CardContent>
          </Card>
        )}
      </div>

      {/* Utilization Bar */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm">使用率</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-sm font-medium whitespace-nowrap">
              {pool.allocatedCount} / {pool.totalCount}（{pct.toFixed(1)}%）
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Allocations Table */}
      <h2 className="font-semibold text-base mb-3">IP 分配记录</h2>
      {activeAllocations.length === 0 && pool.allocations.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">暂无分配记录</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>IP 地址</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>关联 CI 实例</TableHead>
              <TableHead>分配人</TableHead>
              <TableHead>分配时间</TableHead>
              <TableHead>描述</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pool.allocations.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-sm">{a.ipAddress}</TableCell>
                <TableCell>
                  <Badge variant={a.status === 'allocated' ? 'default' : 'secondary'}>
                    {a.status === 'allocated' ? '已分配' : '已释放'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {a.ciInstanceId ? (
                    <Link href={`/cmdb/instances/${a.ciInstanceId}`} className="hover:underline text-primary text-sm">
                      {a.ciInstanceName ?? `实例 #${a.ciInstanceId}`}
                    </Link>
                  ) : <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell className="text-sm">{a.allocatedByName || '-'}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {a.allocatedAt ? new Date(a.allocatedAt).toLocaleString('zh-CN') : '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-32 truncate">{a.description || '-'}</TableCell>
                <TableCell className="text-right">
                  {a.status === 'allocated' && (
                    <PermissionGuard resource="ip_pool" action="update">
                      <Button size="sm" variant="ghost" onClick={() => setReleaseTarget(a)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </PermissionGuard>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Allocate IP Dialog */}
      <Dialog open={allocateOpen} onOpenChange={(v) => !v && setAllocateOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>分配 IP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>IP 地址（留空自动分配）</Label>
              <Input value={allocateForm.ipAddress}
                onChange={e => setAllocateForm(f => ({ ...f, ipAddress: e.target.value }))}
                placeholder="留空则自动分配下一个可用 IP" />
            </div>
            <div className="space-y-1.5">
              <Label>描述</Label>
              <Input value={allocateForm.description}
                onChange={e => setAllocateForm(f => ({ ...f, description: e.target.value }))}
                placeholder="备注用途" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setAllocateOpen(false)}>取消</Button>
            <Button size="sm" onClick={() => allocateMutation.mutate(allocateForm)}
              disabled={allocateMutation.isPending}>
              {allocateMutation.isPending ? '分配中...' : '确认分配'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Confirmation */}
      <AlertDialog open={!!releaseTarget} onOpenChange={(v) => !v && setReleaseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认释放 IP</AlertDialogTitle>
            <AlertDialogDescription>
              确定要释放 IP <span className="font-mono font-semibold">{releaseTarget?.ipAddress}</span> 吗？
              {releaseTarget?.ciInstanceName && (
                <span>（关联实例：{releaseTarget.ciInstanceName}）</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => releaseTarget && releaseMutation.mutate(releaseTarget.ipAddress)}
              disabled={releaseMutation.isPending}>
              {releaseMutation.isPending ? '释放中...' : '确认释放'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
