'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Plus, Trash2, Search, ChevronLeft, ChevronRight, Upload, Eye, Grid3x3, Bell } from 'lucide-react'
import { CsvImportDialog } from '@/components/cmdb/CsvImportDialog'

/* ---------- Types ---------- */

interface CiModelVO {
  id: number; name: string; displayName: string; group: string; groupName: string
  isBuiltIn: boolean; instanceCount: number; attributes: any[]; createdAt: string; updatedAt: string
}

interface CiAttributeVO {
  id: number; modelId: string; fieldKey: string; name: string
  groupId: string; groupName: string; fieldType: string
  isRequired: boolean; isEditable: boolean; isUnique: boolean
  isBuiltIn: boolean; isListShow: boolean; defaultValue: string
  enumOptions: string; sortOrder: number
}

interface CiInstanceVO {
  id: number; name: string; modelId: string; modelName: string
  status: string; owner: string; description: string
  fieldsData: Record<string, any>; createdAt: string; updatedAt: string
}

/* ---------- Component ---------- */

export default function CmdbInstancesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()

  const [model, setModel] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const size = 20

  // Create dialog — stores modelId (number as string) for fetching attributes
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    modelId: '', name: '', status: 'running', owner: '', description: '',
    fieldsData: {} as Record<string, string>,
  })
  const [selectedModelAttrs, setSelectedModelAttrs] = useState<CiAttributeVO[]>([])

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<CiInstanceVO | null>(null)

  // CSV import
  const [csvOpen, setCsvOpen] = useState(false)
  const [csvModel, setCsvModel] = useState('')

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  // Auto-set model from URL param
  useEffect(() => {
    const m = searchParams.get('model')
    if (m) setModel(m)
  }, [searchParams])

  // Fetch models for filter
  const { data: models = [] } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models-all'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models', { params: { size: 100 } })
        return r.data.data.records
      } catch {
        return []
      }
    },
    enabled: typeof window !== 'undefined',
  })

  // Fetch instances
  const { data, isLoading } = useQuery({
    queryKey: ['cmdb-instances', model, keyword, status, page],
    queryFn: () => api.get('/cmdb/instances', {
      params: {
        model: model || undefined,
        keyword: keyword || undefined,
        status: status || undefined,
        page, size,
      },
    }).then(r => r.data.data),
    enabled: hasPermission('cmdb_instance', 'read'),
  })

  const instances = (data?.records ?? []) as CiInstanceVO[]
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / size)

  // Fetch attributes when creating — uses model numeric ID
  const { data: createModelAttrs } = useQuery<CiAttributeVO[]>({
    queryKey: ['cmdb-model-attrs', createForm.modelId],
    queryFn: () => api.get(`/cmdb/models/${createForm.modelId}/attributes`).then(r => r.data.data),
    enabled: !!createForm.modelId,
  })

  useEffect(() => {
    setSelectedModelAttrs(createModelAttrs ?? [])
  }, [createModelAttrs])

  // Create instance — sends model name to backend
  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/cmdb/instances', body).then(r => r.data),
    onSuccess: () => {
      toast.success('实例已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instances'] })
      setCreateOpen(false)
      setCreateForm({ modelId: '', name: '', status: 'running', owner: '', description: '', fieldsData: {} })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  // Delete instance
  const deleteMutation = useMutation({
    mutationFn: (instId: number) => api.delete(`/cmdb/instances/${instId}`),
    onSuccess: () => {
      toast.success('实例已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instances'] })
      setDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const handleCreate = () => {
    if (!createForm.modelId) { toast.error('请选择模型'); return }
    if (!createForm.name.trim()) { toast.error('请填写实例名称'); return }
    // Look up model name from models list
    const selectedModel = models.find(m => m.id.toString() === createForm.modelId)
    createMutation.mutate({
      modelId: selectedModel?.id.toString() ?? createForm.modelId,
      name: createForm.name,
      status: createForm.status,
      owner: createForm.owner,
      description: createForm.description,
      fieldsData: createForm.fieldsData,
    })
  }

  const openCsvImport = () => {
    if (!model) { toast.error('请先选择一个模型'); return }
    setCsvModel(model)
    setCsvOpen(true)
  }

  const renderFieldInput = (attr: CiAttributeVO) => {
    const val = createForm.fieldsData[attr.fieldKey] ?? ''
    const setVal = (v: string) => setCreateForm(f => ({
      ...f, fieldsData: { ...f.fieldsData, [attr.fieldKey]: v },
    }))

    switch (attr.fieldType) {
      case 'enum':
        const options = (attr.enumOptions ?? '').split('\n').filter(Boolean)
        return (
          <Select value={val} onValueChange={v => setVal(v ?? '')}>
            <SelectTrigger className="w-full"><SelectValue placeholder="请选择" /></SelectTrigger>
            <SelectContent>
              {options.map(o => <SelectItem key={o.trim()} value={o.trim()}>{o.trim()}</SelectItem>)}
            </SelectContent>
          </Select>
        )
      case 'int':
        return <Input type="number" value={val} onChange={e => setVal(e.target.value)} />
      case 'bool':
        return (
          <Select value={val || 'false'} onValueChange={v => setVal(v ?? '')}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="true">是</SelectItem>
              <SelectItem value="false">否</SelectItem>
            </SelectContent>
          </Select>
        )
      case 'date':
        return <Input type="date" value={val} onChange={e => setVal(e.target.value)} />
      case 'list':
        return <Textarea value={val} onChange={e => setVal(e.target.value)} rows={2} />
      default:
        return <Input value={val} onChange={e => setVal(e.target.value)} />
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">CMDB 实例管理</h1>
        <div className="flex gap-2">
          <PermissionGuard resource="cmdb_instance" action="create">
            <Button size="sm" onClick={() => {
              setCreateOpen(true)
              setCreateForm({ modelId: '', name: '', status: 'running', owner: '', description: '', fieldsData: {} })
            }}>
              <Plus className="h-4 w-4 mr-1" />新建实例
            </Button>
          </PermissionGuard>
          <Link href="/cmdb/instances/2d-view" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Grid3x3 className="h-4 w-4 mr-1" />2D 视图
          </Link>
          <PermissionGuard resource="cmdb_instance" action="create">
            <Button size="sm" variant="outline" onClick={openCsvImport}>
              <Upload className="h-4 w-4 mr-1" />导入 CSV
            </Button>
          </PermissionGuard>
          <Link href="/notifications" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Bell className="h-4 w-4 mr-1" />告警
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={model} onValueChange={v => { setModel((v ?? '') === '__all__' ? '' : (v ?? '')); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="全部模型" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部模型</SelectItem>
            {models.map(m => <SelectItem key={m.name} value={m.name}>{m.displayName}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="搜索实例名称..." value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1) }} />
        </div>

        <Select value={status} onValueChange={v => { setStatus((v ?? '') === '__all__' ? '' : (v ?? '')); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部状态</SelectItem>
            <SelectItem value="running">运行中</SelectItem>
            <SelectItem value="stopped">已停用</SelectItem>
            <SelectItem value="maintenance">维护中</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : instances.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">暂无实例数据</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>负责人</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.map(inst => (
                <TableRow key={inst.id}>
                  <TableCell className="text-muted-foreground">{inst.id}</TableCell>
                  <TableCell>
                    <Link href={`/cmdb/instances/by-model/${inst.modelId}/${inst.id}`} className="font-medium hover:underline">
                      {inst.name}
                    </Link>
                  </TableCell>
                  <TableCell><Badge variant="outline">{inst.modelName}</Badge></TableCell>
                  <TableCell>{inst.status || '-'}</TableCell>
                  <TableCell>{inst.owner || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(inst.updatedAt).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Link href={`/cmdb/instances/by-model/${inst.modelId}/${inst.id}`}>
                        <Button size="sm" variant="ghost"><Eye className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <PermissionGuard resource="cmdb_instance" action="delete">
                        <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(inst)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
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

      {/* Create Instance Dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建实例</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>所属模型 *</Label>
                <Select value={createForm.modelId}
                  onValueChange={v => setCreateForm(f => ({ ...f, modelId: v ?? '', fieldsData: {} }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="请选择模型" /></SelectTrigger>
                  <SelectContent>
                    {models.map(m => (
                      <SelectItem key={m.id} value={m.id.toString()}>{m.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>实例名称 *</Label>
                <Input value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>状态</Label>
                <Select value={createForm.status} onValueChange={v => setCreateForm(f => ({ ...f, status: v ?? '' }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="running">运行中</SelectItem>
                    <SelectItem value="stopped">已停用</SelectItem>
                    <SelectItem value="maintenance">维护中</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>负责人</Label>
                <Input value={createForm.owner}
                  onChange={e => setCreateForm(f => ({ ...f, owner: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>描述</Label>
              <Textarea value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>

            {/* Dynamic attributes */}
            {selectedModelAttrs.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">模型属性</h3>
                <div className="space-y-3">
                  {selectedModelAttrs
                    .filter(a => a.isEditable)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map(attr => (
                      <div key={attr.id} className="grid grid-cols-[120px_1fr] gap-2 items-start">
                        <Label className="text-sm pt-2">
                          {attr.name}{attr.isRequired && <span className="text-destructive ml-0.5">*</span>}
                        </Label>
                        {renderFieldInput(attr)}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button size="sm" onClick={handleCreate}
              disabled={!createForm.modelId || !createForm.name.trim() || createMutation.isPending}>
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
              确定要删除实例「{deleteTarget?.name}」吗？此操作不可撤销。
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

      {/* CSV Import Dialog */}
      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} model={csvModel} />
    </div>
  )
}
