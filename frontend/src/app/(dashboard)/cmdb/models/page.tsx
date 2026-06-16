'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Grid3x3, Boxes } from 'lucide-react'

interface CiModelVO {
  id: number; name: string; displayName: string; group: string; groupName: string
  isBuiltIn: boolean; instanceCount: number; attributes: any[]; createdAt: string; updatedAt: string
}

const MODEL_GROUPS = [
  { code: 'infra', name: '基础设施' },
  { code: 'biz', name: '业务应用' },
  { code: 'network', name: '网络设备' },
  { code: 'security', name: '安全设备' },
  { code: 'cloud', name: '云资源' },
]

export default function CmdbModelsPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()

  const [groupFilter, setGroupFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const size = 20

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<CiModelVO | null>(null)
  const [form, setForm] = useState({ name: '', displayName: '', group: 'infra' })

  const [deleteTarget, setDeleteTarget] = useState<CiModelVO | null>(null)

  useEffect(() => {
    if (!hasPermission('cmdb_model', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data, isLoading } = useQuery({
    queryKey: ['cmdb-models', search, groupFilter, page],
    queryFn: () => api.get('/cmdb/models', {
      params: { keyword: search || undefined, group: groupFilter || undefined, page, size },
    }).then(r => r.data.data),
    enabled: hasPermission('cmdb_model', 'read'),
  })

  const models = (data?.records ?? []) as CiModelVO[]
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / size)

  const createMutation = useMutation({
    mutationFn: (body: { name: string; displayName: string; group: string }) =>
      api.post('/cmdb/models', body).then(r => r.data),
    onSuccess: () => {
      toast.success('模型已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      closeDialog()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { displayName: string; group: string } }) =>
      api.put(`/cmdb/models/${id}`, body).then(r => r.data),
    onSuccess: () => {
      toast.success('模型已更新')
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      closeDialog()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/models/${id}`),
    onSuccess: () => {
      toast.success('模型已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      setDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const openCreate = () => {
    setEditingModel(null)
    setForm({ name: '', displayName: '', group: 'infra' })
    setDialogOpen(true)
  }

  const openEdit = (m: CiModelVO) => {
    setEditingModel(m)
    setForm({ name: m.name, displayName: m.displayName, group: m.group })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingModel(null)
  }

  const handleSubmit = () => {
    if (!form.displayName.trim()) { toast.error('请填写显示名称'); return }
    if (editingModel) {
      updateMutation.mutate({ id: editingModel.id, body: { displayName: form.displayName, group: form.group } })
    } else {
      if (!form.name.trim() || !/^[a-z][a-z0-9_]*$/.test(form.name)) {
        toast.error('模型标识只能包含小写字母、数字和下划线，且以字母开头')
        return
      }
      createMutation.mutate(form)
    }
  }

  return (
    <div className="flex gap-6">
      {/* Left: group filter */}
      <div className="w-44 shrink-0">
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">模型分组</h3>
        <div className="space-y-1">
          <button
            onClick={() => { setGroupFilter(''); setPage(1) }}
            className={cn('block w-full text-left px-3 py-1.5 rounded text-sm transition-colors',
              !groupFilter ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >全部</button>
          {MODEL_GROUPS.map(g => (
            <button
              key={g.code}
              onClick={() => { setGroupFilter(g.code); setPage(1) }}
              className={cn('block w-full text-left px-3 py-1.5 rounded text-sm transition-colors',
                groupFilter === g.code ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >{g.name}</button>
          ))}
        </div>
      </div>

      {/* Right: model table */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">CMDB 模型管理</h1>
          <div className="flex gap-2">
            <Link href="/cmdb/instances/2d-view" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Grid3x3 className="h-4 w-4 mr-1" />2D 视图
            </Link>
            <PermissionGuard resource="cmdb_model" action="create">
              <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />新建模型</Button>
            </PermissionGuard>
          </div>
        </div>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="搜索模型名称..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">加载中...</p>
        ) : models.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">暂无模型数据</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标识</TableHead>
                  <TableHead>显示名</TableHead>
                  <TableHead>分组</TableHead>
                  <TableHead>内置</TableHead>
                  <TableHead>实例数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link href={`/cmdb/models/${m.id}`} className="font-medium hover:underline">{m.name}</Link>
                    </TableCell>
                    <TableCell>{m.displayName}</TableCell>
                    <TableCell><Badge variant="outline">{m.groupName}</Badge></TableCell>
                    <TableCell>{m.isBuiltIn && <Badge variant="secondary">内置</Badge>}</TableCell>
                    <TableCell>{m.instanceCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Link href={`/cmdb/instances/by-model/${m.name}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                          <Boxes className="h-3.5 w-3.5" />查看实例
                        </Link>
                        <PermissionGuard resource="cmdb_model" action="update">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                        </PermissionGuard>
                        <PermissionGuard resource="cmdb_model" action="delete">
                          <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(m)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </PermissionGuard>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => v ? undefined : closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingModel ? '编辑模型' : '新建模型'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>模型标识</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例如: server, database"
                disabled={!!editingModel}
              />
              {!editingModel && <p className="text-xs text-muted-foreground">小写字母开头，仅含小写字母、数字、下划线</p>}
            </div>
            <div className="space-y-1.5">
              <Label>显示名称 *</Label>
              <Input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="例如: 服务器" />
            </div>
            <div className="space-y-1.5">
              <Label>所属分组 *</Label>
              <Select value={form.group} onValueChange={v => setForm(f => ({ ...f, group: v ?? 'infra' }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODEL_GROUPS.map(g => <SelectItem key={g.code} value={g.code}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={closeDialog}>取消</Button>
            <Button size="sm" onClick={handleSubmit}
              disabled={!form.displayName.trim() || (!editingModel && !form.name.trim()) || createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? '保存中...' : '保存'}
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
              确定要删除模型「{deleteTarget?.displayName}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
