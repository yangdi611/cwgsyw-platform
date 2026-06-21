'use client'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/v2/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/v2/Card'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { DataTable, type ColumnDef } from '@/components/shared'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/v2/Dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react'

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

type StatusVariant = 'ok' | 'warn' | 'danger' | 'neutral'

function poolStatusMeta(s: string): { variant: StatusVariant; label: string } {
  if (s === 'active') return { variant: 'ok', label: '活跃' }
  if (s === 'full') return { variant: 'danger', label: '已满' }
  if (s === 'disabled') return { variant: 'neutral', label: '已禁用' }
  return { variant: 'neutral', label: s || '未知' }
}

function allocStatusMeta(s: string): { variant: StatusVariant; label: string } {
  if (s === 'allocated') return { variant: 'ok', label: '已分配' }
  if (s === 'released') return { variant: 'neutral', label: '已释放' }
  return { variant: 'neutral', label: s || '未知' }
}

export default function IpamDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()

  const [allocateOpen, setAllocateOpen] = useState(false)
  const [allocateForm, setAllocateForm] = useState({
    ipAddress: '',
    ciInstanceId: null as number | null,
    description: '',
  })
  const [releaseTarget, setReleaseTarget] = useState<IpAllocationVO | null>(null)

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', gateway: '', dns: '' })

  useEffect(() => {
    if (!hasPermission('ip_pool', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: pool, isLoading } = useQuery({
    queryKey: ['ip-pool', id],
    queryFn: () => api.get(`/ip-pools/${id}`).then((r) => r.data.data as IpPoolDetailVO),
    enabled: hasPermission('ip_pool', 'read'),
  })

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

  if (isLoading) return <p className="text-v2-muted">加载中…</p>
  if (!pool) return <p className="text-v2-danger">地址池不存在</p>

  const pct = pool.utilizationPercent
  const pst = poolStatusMeta(pool.status)

  const columns: ColumnDef<IpAllocationVO>[] = [
    {
      key: 'ipAddress',
      title: 'IP 地址',
      render: (r) => <span className="font-v2-mono text-sm text-v2-fg">{r.ipAddress}</span>,
    },
    {
      key: 'status',
      title: '状态',
      render: (r) => {
        const m = allocStatusMeta(r.status)
        return <StatusBadge status={m.variant}>{m.label}</StatusBadge>
      },
    },
    {
      key: 'ciInstance',
      title: '关联 CI 实例',
      render: (r) =>
        r.ciInstanceId ? (
          <Link
            href={`/cmdb/instances/by-model/host/${r.ciInstanceId}`}
            className="text-sm font-semibold text-v2-primary hover:text-v2-primary-hover"
          >
            {r.ciInstanceName ?? `实例 #${r.ciInstanceId}`}
          </Link>
        ) : (
          <span className="text-v2-subtle">-</span>
        ),
    },
    {
      key: 'allocatedByName',
      title: '分配人',
      render: (r) => <span className="text-sm text-v2-fg">{r.allocatedByName || '-'}</span>,
    },
    {
      key: 'allocatedAt',
      title: '分配时间',
      render: (r) => (
        <span className="whitespace-nowrap text-sm text-v2-muted">
          {r.allocatedAt ? new Date(r.allocatedAt).toLocaleString('zh-CN') : '-'}
        </span>
      ),
    },
    {
      key: 'description',
      title: '描述',
      render: (r) => (
        <span className="max-w-32 truncate text-sm text-v2-muted">{r.description || '-'}</span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (r) =>
        r.status === 'allocated' ? (
          <PermissionGuard resource="ip_pool" action="update">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0 text-v2-danger"
              onClick={() => setReleaseTarget(r)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </PermissionGuard>
        ) : (
          <span className="text-v2-subtle">-</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/ipam"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-v2-md text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-v2-fg">{pool.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-v2-border bg-v2-surface-soft px-2 py-0.5 font-v2-mono text-xs text-v2-fg">
                {pool.cidr}
              </span>
              <StatusBadge status={pst.variant}>{pst.label}</StatusBadge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <PermissionGuard resource="ip_pool" action="update">
            <Button variant="secondary" size="sm" onClick={startEdit}>
              <Pencil className="h-4 w-4" />
              编辑
            </Button>
          </PermissionGuard>
          <PermissionGuard resource="ip_pool" action="update">
            <Button variant="primary" size="sm" onClick={() => setAllocateOpen(true)}>
              <Plus className="h-4 w-4" />
              分配 IP
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">编辑地址池信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>名称</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>网关</Label>
                <Input
                  value={editForm.gateway}
                  onChange={(e) => setEditForm((f) => ({ ...f, gateway: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>DNS</Label>
                <Input
                  value={editForm.dns}
                  onChange={(e) => setEditForm((f) => ({ ...f, dns: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>描述</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
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

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">CIDR</CardTitle>
          </CardHeader>
          <CardContent className="font-v2-mono text-sm text-v2-fg">{pool.cidr}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">网关</CardTitle>
          </CardHeader>
          <CardContent className="font-v2-mono text-sm text-v2-fg">{pool.gateway || '-'}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">DNS</CardTitle>
          </CardHeader>
          <CardContent className="font-v2-mono text-sm text-v2-fg">{pool.dns || '-'}</CardContent>
        </Card>
        {pool.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">描述</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-v2-muted">{pool.description}</CardContent>
          </Card>
        )}
      </div>

      {/* Utilization Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">使用率</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-v2-surface-soft">
              <div
                className={`h-full rounded-full transition-all ${
                  pct >= 90 ? 'bg-v2-danger' : pct >= 70 ? 'bg-v2-warning' : 'bg-v2-success'
                }`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-sm font-medium tabular-nums text-v2-fg">
              {pool.allocatedCount} / {pool.totalCount}（{pct.toFixed(1)}%）
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Allocations Table */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-v2-fg">IP 分配记录</h2>
        <DataTable
          columns={columns}
          data={pool.allocations}
          rowKey={(r) => r.id}
          empty={{ title: '暂无分配记录', description: '点击右上角「分配 IP」分配第一个地址。' }}
        />
      </div>

      {/* Allocate IP Dialog */}
      <Dialog open={allocateOpen} onOpenChange={(v) => !v && setAllocateOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>分配 IP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>IP 地址（留空自动分配）</Label>
              <Input
                value={allocateForm.ipAddress}
                onChange={(e) => setAllocateForm((f) => ({ ...f, ipAddress: e.target.value }))}
                placeholder="留空则自动分配下一个可用 IP"
              />
            </div>
            <div className="space-y-1.5">
              <Label>描述</Label>
              <Input
                value={allocateForm.description}
                onChange={(e) => setAllocateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="备注用途"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setAllocateOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => allocateMutation.mutate(allocateForm)}
              disabled={allocateMutation.isPending}
            >
              {allocateMutation.isPending ? '分配中…' : '确认分配'}
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
              确定要释放 IP <span className="font-v2-mono font-semibold">{releaseTarget?.ipAddress}</span> 吗？
              {releaseTarget?.ciInstanceName && (
                <span>（关联实例：{releaseTarget.ciInstanceName}）</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => releaseTarget && releaseMutation.mutate(releaseTarget.ipAddress)}
              disabled={releaseMutation.isPending}
            >
              {releaseMutation.isPending ? '释放中…' : '确认释放'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
