'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Plus, Trash2, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react'

/* ---------- Types ---------- */

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

/* ---------- Component ---------- */

export default function IpamPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()

  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const size = 20

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '', cidr: '', gateway: '', dns: '', description: '',
  })

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<IpPoolVO | null>(null)

  useEffect(() => {
    if (!hasPermission('ip_pool', 'read')) router.replace('/')
  }, [hasPermission, router])

  // Fetch pools
  const { data, isLoading } = useQuery({
    queryKey: ['ip-pools', keyword, status, page],
    queryFn: () => api.get('/ip-pools', {
      params: {
        keyword: keyword || undefined,
        status: status || undefined,
        page, size,
      },
    }).then(r => r.data.data),
    enabled: hasPermission('ip_pool', 'read'),
  })

  const pools = (data?.records ?? []) as IpPoolVO[]
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / size)

  // Create pool
  const createMutation = useMutation({
    mutationFn: (body: typeof createForm) => api.post('/ip-pools', body).then(r => r.data),
    onSuccess: () => {
      toast.success('地址池已创建')
      queryClient.invalidateQueries({ queryKey: ['ip-pools'] })
      setCreateOpen(false)
      setCreateForm({ name: '', cidr: '', gateway: '', dns: '', description: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  // Delete pool
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
    if (!createForm.name.trim()) { toast.error('请填写地址池名称'); return }
    if (!createForm.cidr.trim()) { toast.error('请填写 CIDR'); return }
    createMutation.mutate(createForm)
  }

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    active: { label: '活跃', variant: 'default' },
    disabled: { label: '已禁用', variant: 'secondary' },
    full: { label: '已满', variant: 'destructive' },
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">IP 地址池</h1>
        <PermissionGuard resource="ip_pool" action="create">
          <Button size="sm" onClick={() => {
            setCreateOpen(true)
            setCreateForm({ name: '', cidr: '', gateway: '', dns: '', description: '' })
          }}>
            <Plus className="h-4 w-4 mr-1" />新建地址池
          </Button>
        </PermissionGuard>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="搜索名称、CIDR、描述..." value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1) }} />
        </div>

        <Select value={status} onValueChange={v => { setStatus((v ?? '') === '__all__' ? '' : (v ?? '')); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部状态</SelectItem>
            <SelectItem value="active">活跃</SelectItem>
            <SelectItem value="disabled">已禁用</SelectItem>
            <SelectItem value="full">已满</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : pools.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">暂无地址池数据</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>CIDR</TableHead>
                <TableHead>网关</TableHead>
                <TableHead>使用率</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pools.map(pool => {
                const sc = statusConfig[pool.status] ?? { label: pool.status, variant: 'outline' as const }
                const pct = pool.utilizationPercent
                return (
                  <TableRow key={pool.id}>
                    <TableCell>
                      <Link href={`/ipam/${pool.id}`} className="font-medium hover:underline">
                        {pool.name}
                      </Link>
                      {pool.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-48">{pool.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{pool.cidr}</TableCell>
                    <TableCell className="text-sm">{pool.gateway || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {pool.allocatedCount}/{pool.totalCount} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={sc.variant}>{sc.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Link href={`/ipam/${pool.id}`}>
                          <Button size="sm" variant="ghost"><Eye className="h-3.5 w-3.5" /></Button>
                        </Link>
                        <PermissionGuard resource="ip_pool" action="delete">
                          <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(pool)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </PermissionGuard>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-muted-foreground">共 {total} 条</span>
            <div className="flex gap-2 items-center">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">{page} / {totalPages || 1}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

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
                <Input value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例：生产网段 A" />
              </div>
              <div className="space-y-1.5">
                <Label>CIDR *</Label>
                <Input value={createForm.cidr}
                  onChange={e => setCreateForm(f => ({ ...f, cidr: e.target.value }))}
                  placeholder="例：192.168.1.0/24" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>网关</Label>
                <Input value={createForm.gateway}
                  onChange={e => setCreateForm(f => ({ ...f, gateway: e.target.value }))}
                  placeholder="192.168.1.1" />
              </div>
              <div className="space-y-1.5">
                <Label>DNS</Label>
                <Input value={createForm.dns}
                  onChange={e => setCreateForm(f => ({ ...f, dns: e.target.value }))}
                  placeholder="8.8.8.8" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>描述</Label>
              <Input value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button size="sm" onClick={handleCreate}
              disabled={!createForm.name.trim() || !createForm.cidr.trim() || createMutation.isPending}>
              {createMutation.isPending ? '创建中...' : '创建'}
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
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
