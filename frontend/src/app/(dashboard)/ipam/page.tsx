'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
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
import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { PageHeader, FilterBar, DataTable, Pagination, type ColumnDef } from '@/components/shared'
import { toast } from 'sonner'
import { Plus, Trash2, Search, Eye } from 'lucide-react'

interface IpPoolVO {
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
}

function poolStatusMeta(s: string): { variant: 'ok' | 'warn' | 'danger' | 'neutral'; label: string } {
  if (s === 'active') return { variant: 'ok', label: '活跃' }
  if (s === 'full') return { variant: 'danger', label: '已满' }
  if (s === 'disabled') return { variant: 'neutral', label: '已禁用' }
  return { variant: 'neutral', label: s || '未知' }
}

export default function IpamPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()

  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const size = 20

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    cidr: '',
    gateway: '',
    dns: '',
    description: '',
  })
  const [deleteTarget, setDeleteTarget] = useState<IpPoolVO | null>(null)

  useEffect(() => {
    if (!hasPermission('ip_pool', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data, isLoading } = useQuery({
    queryKey: ['ip-pools', keyword, status, page],
    queryFn: () =>
      api
        .get('/ip-pools', {
          params: { keyword: keyword || undefined, status: status || undefined, page, size },
        })
        .then((r) => r.data.data),
    enabled: hasPermission('ip_pool', 'read'),
  })

  const pools = (data?.records ?? []) as IpPoolVO[]
  const total = data?.total ?? 0

  const createMutation = useMutation({
    mutationFn: (body: typeof createForm) => api.post('/ip-pools', body).then((r) => r.data),
    onSuccess: () => {
      toast.success('地址池已创建')
      queryClient.invalidateQueries({ queryKey: ['ip-pools'] })
      setCreateOpen(false)
      setCreateForm({ name: '', cidr: '', gateway: '', dns: '', description: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (poolId: number) => api.delete(`/ip-pools/${poolId}`),
    onSuccess: () => {
      toast.success('地址池已删除')
      queryClient.invalidateQueries({ queryKey: ['ip-pools'] })
      setDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const handleCreate = () => {
    if (!createForm.name.trim()) {
      toast.error('请填写地址池名称')
      return
    }
    if (!createForm.cidr.trim()) {
      toast.error('请填写 CIDR')
      return
    }
    createMutation.mutate(createForm)
  }

  const columns: ColumnDef<IpPoolVO>[] = [
    {
      key: 'name',
      title: '名称',
      render: (r) => (
        <div>
          <span className="font-semibold text-v2-fg">{r.name}</span>
          {r.description && (
            <p className="max-w-48 truncate text-xs text-v2-muted">{r.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'cidr',
      title: 'CIDR',
      render: (r) => <span className="font-v2-mono text-sm text-v2-fg">{r.cidr}</span>,
    },
    {
      key: 'gateway',
      title: '网关',
      render: (r) => <span className="text-sm text-v2-fg">{r.gateway || '-'}</span>,
    },
    {
      key: 'utilization',
      title: '使用率',
      render: (r) => {
        const pct = r.utilizationPercent
        const barColor = pct >= 90 ? 'bg-v2-danger' : pct >= 70 ? 'bg-v2-warning' : 'bg-v2-success'
        return (
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-v2-surface-soft rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-xs text-v2-muted">
              {r.allocatedCount}/{r.totalCount} ({pct.toFixed(1)}%)
            </span>
          </div>
        )
      },
    },
    {
      key: 'status',
      title: '状态',
      render: (r) => {
        const m = poolStatusMeta(r.status)
        return <StatusBadge status={m.variant}>{m.label}</StatusBadge>
      },
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/ipam/${r.id}`)}>
            <Eye className="h-3.5 w-3.5" />
            详情
          </Button>
          <PermissionGuard resource="ip_pool" action="delete">
            <Button
              variant="ghost"
              size="sm"
              className="text-v2-danger"
              onClick={() => setDeleteTarget(r)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </PermissionGuard>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="资源管理"
        title="IP 地址池"
        subtitle="管理网络地址段、网关与 DNS，监控地址分配率与冲突状态。"
        actions={
          <PermissionGuard resource="ip_pool" action="create">
            <Button
              variant="primary"
              onClick={() => {
                setCreateOpen(true)
                setCreateForm({ name: '', cidr: '', gateway: '', dns: '', description: '' })
              }}
            >
              <Plus className="h-4 w-4" />
              新建地址池
            </Button>
          </PermissionGuard>
        }
      />

      <FilterBar>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-v2-muted" />
          <Input
            className="pl-8"
            placeholder="搜索名称、CIDR、描述…"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Select
          value={status || '__all__'}
          onValueChange={(v) => {
            setStatus(v === '__all__' ? '' : v ?? '')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="全部状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部状态</SelectItem>
            <SelectItem value="active">活跃</SelectItem>
            <SelectItem value="disabled">已禁用</SelectItem>
            <SelectItem value="full">已满</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        data={pools}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty={{ title: '暂无地址池', description: '点击右上角"新建地址池"添加第一个网段。' }}
      />

      <Pagination page={page} pageSize={size} total={total} onPageChange={setPage} />

      {/* Create Pool Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建地址池</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>名称 *</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="例：生产网段 A"
                />
              </div>
              <div className="space-y-1.5">
                <Label>CIDR *</Label>
                <Input
                  value={createForm.cidr}
                  onChange={(e) => setCreateForm((f) => ({ ...f, cidr: e.target.value }))}
                  placeholder="例：192.168.1.0/24"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>网关</Label>
                <Input
                  value={createForm.gateway}
                  onChange={(e) => setCreateForm((f) => ({ ...f, gateway: e.target.value }))}
                  placeholder="192.168.1.1"
                />
              </div>
              <div className="space-y-1.5">
                <Label>DNS</Label>
                <Input
                  value={createForm.dns}
                  onChange={(e) => setCreateForm((f) => ({ ...f, dns: e.target.value }))}
                  placeholder="8.8.8.8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>描述</Label>
              <Input
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={!createForm.name.trim() || !createForm.cidr.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除地址池「{deleteTarget?.name}」（{deleteTarget?.cidr}）吗？地址池中已分配的 IP 需要先释放。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
