'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

/* ---------- Types ---------- */

interface CiAttributeVO {
  id: number; modelId: string; fieldKey: string; name: string
  groupId: string; groupName: string; fieldType: string
  isRequired: boolean; isEditable: boolean; isUnique: boolean
  isBuiltIn: boolean; isListShow: boolean; defaultValue: string
  enumOptions: string; sortOrder: number
}

interface CiModelVO {
  id: number; name: string; displayName: string; group: string; groupName: string
  isBuiltIn: boolean; instanceCount: number
  attributes: CiAttributeVO[]; createdAt: string; updatedAt: string
}

interface CiInstanceVO {
  id: number; name: string; modelId: string; modelName: string
  status: string; owner: string; description: string
  fieldsData: Record<string, any>; createdAt: string; updatedAt: string
}

const FIELD_TYPES = [
  { value: 'singlechar', label: '单行文本' },
  { value: 'int', label: '整数' },
  { value: 'enum', label: '枚举' },
  { value: 'list', label: '列表' },
  { value: 'bool', label: '布尔' },
  { value: 'user', label: '用户' },
  { value: 'date', label: '日期' },
]

const defaultAttrForm = {
  fieldKey: '', name: '', fieldType: 'singlechar', groupId: '',
  isRequired: false, isUnique: false, isListShow: true,
  isEditable: true, enumOptions: '', defaultValue: '', sortOrder: 0,
}

/* ---------- Component ---------- */

export default function CmdbModelDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<'attributes' | 'instances'>('attributes')

  // Instance list state
  const [instPage, setInstPage] = useState(1)
  const instSize = 15

  // Attribute dialog
  const [attrDialogOpen, setAttrDialogOpen] = useState(false)
  const [editingAttr, setEditingAttr] = useState<CiAttributeVO | null>(null)
  const [attrForm, setAttrForm] = useState({ ...defaultAttrForm })
  const [deleteAttrTarget, setDeleteAttrTarget] = useState<CiAttributeVO | null>(null)

  useEffect(() => {
    if (!hasPermission('cmdb_model', 'read')) router.replace('/')
  }, [hasPermission, router])

  // Fetch model
  const { data: model, isLoading } = useQuery<CiModelVO>({
    queryKey: ['cmdb-model', id],
    queryFn: () => api.get(`/cmdb/models/${id}`).then(r => r.data.data),
    enabled: hasPermission('cmdb_model', 'read'),
  })

  // Fetch instances for this model
  const { data: instData, isLoading: instLoading } = useQuery({
    queryKey: ['cmdb-instances', model?.name, instPage],
    queryFn: () => api.get('/cmdb/instances', {
      params: { model: model!.name, page: instPage, size: instSize },
    }).then(r => r.data.data),
    enabled: tab === 'instances' && !!model,
  })

  const instances = (instData?.records ?? []) as CiInstanceVO[]
  const instTotal = instData?.total ?? 0
  const instTotalPages = Math.ceil(instTotal / instSize)

  // Attribute CRUD
  const createAttrMutation = useMutation({
    mutationFn: (body: typeof attrForm) =>
      api.post(`/cmdb/models/${id}/attributes`, body).then(r => r.data),
    onSuccess: () => {
      toast.success('属性已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model', id] })
      closeAttrDialog()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const updateAttrMutation = useMutation({
    mutationFn: ({ attrId, body }: { attrId: number; body: Partial<typeof attrForm> }) =>
      api.put(`/cmdb/models/${id}/attributes/${attrId}`, body).then(r => r.data),
    onSuccess: () => {
      toast.success('属性已更新')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model', id] })
      closeAttrDialog()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  const deleteAttrMutation = useMutation({
    mutationFn: (attrId: number) => api.delete(`/cmdb/models/${id}/attributes/${attrId}`),
    onSuccess: () => {
      toast.success('属性已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model', id] })
      setDeleteAttrTarget(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const openCreateAttr = () => {
    setEditingAttr(null)
    setAttrForm({ ...defaultAttrForm })
    setAttrDialogOpen(true)
  }

  const openEditAttr = (a: CiAttributeVO) => {
    setEditingAttr(a)
    setAttrForm({
      fieldKey: a.fieldKey,
      name: a.name,
      fieldType: a.fieldType,
      groupId: a.groupId ?? '',
      isRequired: a.isRequired,
      isUnique: a.isUnique,
      isListShow: a.isListShow,
      isEditable: a.isEditable,
      enumOptions: a.enumOptions ?? '',
      defaultValue: a.defaultValue ?? '',
      sortOrder: a.sortOrder,
    })
    setAttrDialogOpen(true)
  }

  const closeAttrDialog = () => {
    setAttrDialogOpen(false)
    setEditingAttr(null)
  }

  const handleAttrSubmit = () => {
    if (!attrForm.name.trim()) { toast.error('请填写属性名称'); return }
    if (!editingAttr && !attrForm.fieldKey.trim()) { toast.error('请填写字段标识'); return }

    if (editingAttr) {
      updateAttrMutation.mutate({
        attrId: editingAttr.id,
        body: {
          name: attrForm.name,
          fieldType: attrForm.fieldType,
          isRequired: attrForm.isRequired,
          isUnique: attrForm.isUnique,
          isListShow: attrForm.isListShow,
          isEditable: attrForm.isEditable,
          enumOptions: attrForm.enumOptions,
          defaultValue: attrForm.defaultValue,
          sortOrder: attrForm.sortOrder,
        },
      })
    } else {
      createAttrMutation.mutate(attrForm)
    }
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">加载中...</p>
  if (!model) return <p className="text-muted-foreground text-sm">模型不存在</p>

  const attrs = model.attributes ?? []

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/cmdb/models')}>← 返回</Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{model.displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {model.name} · {model.groupName} · {model.instanceCount} 个实例
            {model.isBuiltIn && <Badge variant="secondary" className="ml-2">内置</Badge>}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {(['attributes', 'instances'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'attributes' ? '属性定义' : '实例列表'}
          </button>
        ))}
      </div>

      {/* Attributes Tab */}
      {tab === 'attributes' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">属性定义 ({attrs.length})</h2>
            <PermissionGuard resource="cmdb_model" action="update">
              <Button size="sm" onClick={openCreateAttr}><Plus className="h-4 w-4 mr-1" />新建属性</Button>
            </PermissionGuard>
          </div>

          {attrs.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">暂无属性定义</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>字段标识</TableHead>
                  <TableHead>显示名</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>必填</TableHead>
                  <TableHead>唯一</TableHead>
                  <TableHead>内置</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attrs
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map(a => {
                    const ft = FIELD_TYPES.find(f => f.value === a.fieldType)
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.fieldKey}</TableCell>
                        <TableCell>{a.name}</TableCell>
                        <TableCell><Badge variant="outline">{ft?.label ?? a.fieldType}</Badge></TableCell>
                        <TableCell>{a.isRequired && '✓'}</TableCell>
                        <TableCell>{a.isUnique && '✓'}</TableCell>
                        <TableCell>{a.isBuiltIn && <Badge variant="secondary" className="text-xs">内置</Badge>}</TableCell>
                        <TableCell>{a.sortOrder}</TableCell>
                        <TableCell className="text-right">
                          {!a.isBuiltIn && (
                            <div className="flex gap-1 justify-end">
                              <PermissionGuard resource="cmdb_model" action="update">
                                <Button size="sm" variant="ghost" onClick={() => openEditAttr(a)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </PermissionGuard>
                              <PermissionGuard resource="cmdb_model" action="update">
                                <Button size="sm" variant="ghost" onClick={() => setDeleteAttrTarget(a)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </PermissionGuard>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Instances Tab */}
      {tab === 'instances' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">实例列表 ({instTotal})</h2>
            <PermissionGuard resource="cmdb_instance" action="create">
              <Link href={`/cmdb/instances?createModel=${model.name}`}>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />新建实例</Button>
              </Link>
            </PermissionGuard>
          </div>

          {instLoading ? (
            <p className="text-muted-foreground text-sm">加载中...</p>
          ) : instances.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">暂无实例</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>名称</TableHead>
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
                        <Link href={`/cmdb/instances/${inst.id}`} className="font-medium hover:underline">
                          {inst.name}
                        </Link>
                      </TableCell>
                      <TableCell>{inst.status || '-'}</TableCell>
                      <TableCell>{inst.owner || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(inst.updatedAt).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/cmdb/instances/${inst.id}`}>
                          <Button size="sm" variant="ghost">查看</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">共 {instTotal} 条</span>
                <div className="flex gap-2 items-center">
                  <Button size="sm" variant="outline" disabled={instPage <= 1} onClick={() => setInstPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{instPage} / {instTotalPages || 1}</span>
                  <Button size="sm" variant="outline" disabled={instPage >= instTotalPages} onClick={() => setInstPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Create / Edit Attribute Dialog */}
      <Dialog open={attrDialogOpen} onOpenChange={(v) => !v && closeAttrDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAttr ? '编辑属性' : '新建属性'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>字段标识</Label>
                <Input
                  value={attrForm.fieldKey}
                  onChange={e => setAttrForm(f => ({ ...f, fieldKey: e.target.value }))}
                  placeholder="例: ip_address"
                  disabled={!!editingAttr}
                />
              </div>
              <div className="space-y-1.5">
                <Label>显示名称 *</Label>
                <Input
                  value={attrForm.name}
                  onChange={e => setAttrForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例: IP 地址"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>字段类型 *</Label>
                <Select value={attrForm.fieldType} onValueChange={v => setAttrForm(f => ({ ...f, fieldType: v ?? 'singlechar' }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>排序</Label>
                <Input
                  type="number"
                  value={attrForm.sortOrder}
                  onChange={e => setAttrForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                />
              </div>
            </div>

            {attrForm.fieldType === 'enum' && (
              <div className="space-y-1.5">
                <Label>枚举选项（每行一个）</Label>
                <Textarea
                  value={attrForm.enumOptions}
                  onChange={e => setAttrForm(f => ({ ...f, enumOptions: e.target.value }))}
                  placeholder="选项1&#10;选项2&#10;选项3"
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>默认值</Label>
              <Input
                value={attrForm.defaultValue}
                onChange={e => setAttrForm(f => ({ ...f, defaultValue: e.target.value }))}
              />
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={attrForm.isRequired}
                  onCheckedChange={v => setAttrForm(f => ({ ...f, isRequired: !!v }))}
                />
                必填
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={attrForm.isUnique}
                  onCheckedChange={v => setAttrForm(f => ({ ...f, isUnique: !!v }))}
                />
                唯一
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={attrForm.isListShow}
                  onCheckedChange={v => setAttrForm(f => ({ ...f, isListShow: !!v }))}
                />
                列表显示
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={attrForm.isEditable}
                  onCheckedChange={v => setAttrForm(f => ({ ...f, isEditable: !!v }))}
                />
                可编辑
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={closeAttrDialog}>取消</Button>
            <Button size="sm" onClick={handleAttrSubmit}
              disabled={!attrForm.name.trim() || createAttrMutation.isPending || updateAttrMutation.isPending}>
              {createAttrMutation.isPending || updateAttrMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Attribute Confirmation */}
      <AlertDialog open={!!deleteAttrTarget} onOpenChange={(v) => !v && setDeleteAttrTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除属性「{deleteAttrTarget?.name}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAttrTarget && deleteAttrMutation.mutate(deleteAttrTarget.id)}
              disabled={deleteAttrMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAttrMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
