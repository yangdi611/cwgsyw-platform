'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
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
import { Pencil, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

/* ---------- Types ---------- */

interface CiAttributeVO {
  id: number; modelId: string; fieldKey: string; name: string
  groupId: string; groupName: string; fieldType: string
  isRequired: boolean; isEditable: boolean; isUnique: boolean
  isBuiltIn: boolean; isListShow: boolean; defaultValue: string
  enumOptions: string; sortOrder: number
}

interface CiInstanceDetailVO {
  id: number; name: string; modelId: string; modelName: string
  status: string; owner: string; description: string
  fieldsData: Record<string, any>
  attributes: CiAttributeVO[]
  createdAt: string; updatedAt: string
}

interface CiRelationVO {
  id: number; srcInstanceId: number; srcInstanceName: string
  dstInstanceId: number; dstInstanceName: string
  associationKind: string; metadata: Record<string, any>; createdAt: string
}

interface CiAssociationAttrDefVO {
  id: number; associationKind: string; fieldKey: string; name: string
  fieldType: string; isRequired: boolean; enumOptions: string | null
  defaultValue: string | null; sortOrder: number
}

interface TopologyNodeVO { id: number; name: string; model_id: string; model_name: string; is_root: boolean }
interface TopologyEdgeVO { src: number; dst: number; kind: string; label: string }
interface TopologyResultVO { nodes: TopologyNodeVO[]; edges: TopologyEdgeVO[] }

interface ChangeHistoryVO {
  id: number; action: string; operatorId: number; operatorName: string
  beforeJson: Record<string, any> | null; afterJson: Record<string, any> | null
  createdAt: string; instanceName?: string; modelName?: string
}

interface ImpactLayerVO { depth: number; nodes: { id: number | null; name: string; modelId: string; modelName: string; status: string | null; businessLevel: string | null }[] }
interface ImpactEdgeVO { src: number | null; dst: number | null; kind: string; label: string }
interface ImpactAnalysisResultVO {
  rootId: number; rootName: string; rootModelId: string
  direction: string; maxDepth: number; truncated: boolean
  layers: ImpactLayerVO[]; edges: ImpactEdgeVO[]
}

/* ---------- Constants ---------- */

const FIELD_TYPE_MAP: Record<string, string> = {
  singlechar: '单行文本', int: '整数', enum: '枚举', list: '列表',
  bool: '布尔', user: '用户', date: '日期',
}

const ACTION_MAP: Record<string, string> = {
  create: '创建', update: '更新', delete: '删除',
}

const KIND_MAP: Record<string, string> = {
  dependency: '依赖', deploy: '部署', connect: '连接',
  ownership: '所属', realize: '实现',
}

/* ---------- Topology Visualizer ---------- */

function TopologyView({ nodes, edges }: { nodes: TopologyNodeVO[]; edges: TopologyEdgeVO[] }) {
  if (nodes.length === 0) return <p className="text-muted-foreground text-sm py-8 text-center">无拓扑数据</p>

  const rootNode = nodes.find(n => n.is_root)
  const childMap = new Map<number, { edge: TopologyEdgeVO; child: TopologyNodeVO }[]>()
  edges.forEach(e => {
    const arr = childMap.get(e.src) ?? []
    arr.push({ edge: e, child: nodes.find(n => n.id === e.dst)! })
    childMap.set(e.src, arr)
  })

  const renderNode = (node: TopologyNodeVO, level: number) => {
    const children = childMap.get(node.id) ?? []
    return (
      <div key={node.id} className="ml-4 mt-1">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border ${
          node.is_root ? 'bg-primary/10 border-primary/30 font-medium' : 'bg-card'
        }`}>
          {node.is_root && <span className="text-xs text-primary">★ 根</span>}
          <span>{node.name}</span>
          <Badge variant="outline" className="text-xs">{node.model_name}</Badge>
        </div>
        {children.length > 0 && (
          <div className="border-l-2 border-muted ml-4 pl-2">
            {children.map(({ edge, child }) => (
              <div key={`${edge.src}-${edge.dst}-${edge.kind}`}>
                <div className="text-xs text-muted-foreground ml-4 mb-0.5">
                  └─ <Badge variant="secondary" className="text-xs">{KIND_MAP[edge.kind] ?? edge.kind}</Badge>
                </div>
                {child && renderNode(child, level + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1 overflow-x-auto">
      {rootNode ? renderNode(rootNode, 0) : nodes.map(n => renderNode(n, 0))}
    </div>
  )
}

/* ---------- Main Component ---------- */

export default function CmdbInstanceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<'info' | 'relations' | 'topology' | 'impact' | 'devices' | 'change-docs' | 'daily-reports' | 'history'>('info')

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '', status: '', owner: '', description: '',
    fieldsData: {} as Record<string, string>,
  })

  // Relation dialogs
  const [relCreateOpen, setRelCreateOpen] = useState(false)
  const [relForm, setRelForm] = useState({
    dstInstanceId: '', associationKind: '', metadata: {} as Record<string, string>,
  })
  const [relSearchKeyword, setRelSearchKeyword] = useState('')
  const [relEditTarget, setRelEditTarget] = useState<CiRelationVO | null>(null)
  const [relEditMeta, setRelEditMeta] = useState<Record<string, string>>({})
  const [relDeleteTarget, setRelDeleteTarget] = useState<CiRelationVO | null>(null)

  // Topology
  const [topoDepth, setTopoDepth] = useState(3)

  // Impact analysis
  const [impactDirection, setImpactDirection] = useState('both')
  const [impactDepth, setImpactDepth] = useState(3)

  // History pagination
  const [historyPage, setHistoryPage] = useState(1)
  const historySize = 15

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  // Fetch instance detail
  const { data: instance, isLoading } = useQuery<CiInstanceDetailVO>({
    queryKey: ['cmdb-instance', id],
    queryFn: () => api.get(`/cmdb/instances/${id}`).then(r => r.data.data),
    enabled: hasPermission('cmdb_instance', 'read'),
  })

  // Init edit form
  useEffect(() => {
    if (instance) {
      setEditForm({
        name: instance.name,
        status: instance.status ?? '',
        owner: instance.owner ?? '',
        description: instance.description ?? '',
        fieldsData: { ...(instance.fieldsData ?? {}) } as Record<string, string>,
      })
    }
  }, [instance])

  // Update instance
  const updateMutation = useMutation({
    mutationFn: () => api.put(`/cmdb/instances/${id}`, {
      name: editForm.name,
      status: editForm.status,
      owner: editForm.owner,
      description: editForm.description,
      fieldsData: editForm.fieldsData,
    }).then(r => r.data),
    onSuccess: () => {
      toast.success('实例已更新')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instance', id] })
      setEditOpen(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  // Relations
  const { data: relations = [], isLoading: relLoading } = useQuery<CiRelationVO[]>({
    queryKey: ['cmdb-instance-relations', id],
    queryFn: () => api.get(`/cmdb/instances/${id}/relations`).then(r => r.data.data),
    enabled: tab === 'relations',
  })

  // Association kinds attributes for relation creation
  const { data: assocAttrDefs = [] } = useQuery<CiAssociationAttrDefVO[]>({
    queryKey: ['cmdb-assoc-attrs', relForm.associationKind],
    queryFn: () => api.get(`/cmdb/association-kinds/${relForm.associationKind}/attributes`).then(r => r.data.data),
    enabled: !!relForm.associationKind,
  })

  // Instance search for relation creation
  const { data: searchResults = [] } = useQuery({
    queryKey: ['cmdb-instance-search', relSearchKeyword],
    queryFn: () => api.get('/cmdb/instances/search', {
      params: { keyword: relSearchKeyword, size: 10 },
    }).then(r => r.data.data?.records ?? []),
    enabled: relSearchKeyword.length >= 1,
  })

  // Create relation
  const createRelMutation = useMutation({
    mutationFn: () => api.post(`/cmdb/instances/${id}/relations`, {
      dstInstanceId: Number(relForm.dstInstanceId),
      associationKind: relForm.associationKind,
      metadata: relForm.metadata,
    }).then(r => r.data),
    onSuccess: () => {
      toast.success('关联已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instance-relations', id] })
      setRelCreateOpen(false)
      setRelForm({ dstInstanceId: '', associationKind: '', metadata: {} })
      setRelSearchKeyword('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  // Update relation metadata
  const updateRelMutation = useMutation({
    mutationFn: () => api.put(`/cmdb/instances/${id}/relations/${relEditTarget!.id}`, {
      metadata: relEditMeta,
    }).then(r => r.data),
    onSuccess: () => {
      toast.success('关联已更新')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instance-relations', id] })
      setRelEditTarget(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  // Delete relation
  const deleteRelMutation = useMutation({
    mutationFn: (relId: number) => api.delete(`/cmdb/instances/${id}/relations/${relId}`),
    onSuccess: () => {
      toast.success('关联已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instance-relations', id] })
      setRelDeleteTarget(null)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  // Topology
  const { data: topoData, isLoading: topoLoading } = useQuery<TopologyResultVO>({
    queryKey: ['cmdb-topology', id, topoDepth],
    queryFn: () => api.get(`/cmdb/topology/${id}`, { params: { depth: topoDepth } }).then(r => r.data.data),
    enabled: tab === 'topology',
  })

  // Impact analysis
  const [impactTriggered, setImpactTriggered] = useState(false)
  const impactQuery = useQuery<ImpactAnalysisResultVO>({
    queryKey: ['cmdb-impact', id, impactDirection, impactDepth],
    queryFn: () => api.post(`/cmdb/instances/${id}/impact`, {
      direction: impactDirection, maxDepth: impactDepth,
    }).then(r => r.data.data),
    enabled: impactTriggered && tab === 'impact',
  })

  // History
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['cmdb-instance-history', id, historyPage],
    queryFn: () => api.get(`/cmdb/instances/${id}/history`, {
      params: { page: historyPage, size: historySize },
    }).then(r => r.data.data),
    enabled: tab === 'history',
  })
  const historyRecords = (historyData?.records ?? []) as ChangeHistoryVO[]
  const historyTotal = historyData?.total ?? 0
  const historyTotalPages = Math.ceil(historyTotal / historySize)

  // Related devices
  const { data: relatedDevices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ['cmdb-instance-devices', id],
    queryFn: () => api.get(`/cmdb/instances/${id}/devices`).then(r => r.data.data ?? []),
    enabled: tab === 'devices',
  })

  // Related change docs
  const { data: relatedChangeDocs = [], isLoading: cdLoading } = useQuery({
    queryKey: ['cmdb-instance-change-docs', id],
    queryFn: () => api.get(`/cmdb/instances/${id}/change-docs`).then(r => r.data.data ?? []),
    enabled: tab === 'change-docs',
  })

  // Related daily reports
  const { data: relatedDailyReports = [], isLoading: drLoading } = useQuery({
    queryKey: ['cmdb-instance-daily-reports', id],
    queryFn: () => api.get(`/cmdb/instances/${id}/daily-reports`).then(r => r.data.data ?? []),
    enabled: tab === 'daily-reports',
  })

  const CHANGE_DOC_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    draft:    { label: '草稿',   variant: 'secondary' },
    pending:  { label: '待审批', variant: 'default' },
    approved: { label: '已通过', variant: 'outline' },
    rejected: { label: '已拒绝', variant: 'destructive' },
  }

  // Dynamic field renderer for edit form
  const renderEditField = (attr: CiAttributeVO) => {
    const val = editForm.fieldsData[attr.fieldKey] ?? ''
    const setVal = (v: string) => setEditForm(f => ({
      ...f, fieldsData: { ...f.fieldsData, [attr.fieldKey]: v },
    }))

    switch (attr.fieldType) {
      case 'enum':
        const options = (attr.enumOptions ?? '').split('\n').filter(Boolean)
        return (
          <Select value={String(val)} onValueChange={v => setVal(v ?? '')}>
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
          <Select value={String(val || 'false')} onValueChange={v => setVal(v ?? '')}>
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

  if (isLoading) return <p className="text-muted-foreground text-sm">加载中...</p>
  if (!instance) return <p className="text-muted-foreground text-sm">实例不存在</p>

  const attrs = instance.attributes ?? []

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push('/cmdb/instances')}>← 返回</Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{instance.name}</h1>
          <p className="text-sm text-muted-foreground">
            ID: {instance.id} · 模型: {instance.modelName} · 状态: {instance.status || '-'}
            {instance.owner && ` · 负责人: ${instance.owner}`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {(['info', 'relations', 'topology', 'impact', 'devices', 'change-docs', 'daily-reports', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              if (t === 'impact') setImpactTriggered(false)
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'info' && '基本信息'}
            {t === 'relations' && '关联关系'}
            {t === 'topology' && '拓扑图'}
            {t === 'impact' && '影响分析'}
            {t === 'devices' && '关联设备'}
            {t === 'change-docs' && '相关变更'}
            {t === 'daily-reports' && '相关日报'}
            {t === 'history' && '变更历史'}
          </button>
        ))}
      </div>

      {/* ========== Info Tab ========== */}
      {tab === 'info' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">实例信息</h2>
            <PermissionGuard resource="cmdb_instance" action="update">
              <Button size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-1" />编辑
              </Button>
            </PermissionGuard>
          </div>

          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              ['名称', instance.name],
              ['模型', instance.modelName],
              ['状态', instance.status || '-'],
              ['负责人', instance.owner || '-'],
              ['描述', instance.description || '-'],
              ['创建时间', new Date(instance.createdAt).toLocaleString('zh-CN')],
            ].map(([label, value]) => (
              <div key={String(label)} className="border rounded-lg p-3">
                <span className="text-xs text-muted-foreground">{label}</span>
                <p className="text-sm mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Dynamic fields */}
          {attrs.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">属性字段</h3>
              <div className="grid grid-cols-2 gap-4">
                {attrs
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map(attr => (
                    <div key={attr.id} className="border rounded-lg p-3">
                      <span className="text-xs text-muted-foreground">
                        {attr.name}
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          {FIELD_TYPE_MAP[attr.fieldType] ?? attr.fieldType}
                        </Badge>
                      </span>
                      <p className="text-sm mt-0.5 break-all">
                        {instance.fieldsData?.[attr.fieldKey] != null
                          ? String(instance.fieldsData[attr.fieldKey])
                          : '—'}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== Relations Tab ========== */}
      {tab === 'relations' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">关联关系 ({relations.length})</h2>
            <PermissionGuard resource="cmdb_relation" action="create">
              <Button size="sm" onClick={() => {
                setRelForm({ dstInstanceId: '', associationKind: '', metadata: {} })
                setRelSearchKeyword('')
                setRelCreateOpen(true)
              }}>
                <Plus className="h-4 w-4 mr-1" />新建关联
              </Button>
            </PermissionGuard>
          </div>

          {relLoading ? (
            <p className="text-muted-foreground text-sm">加载中...</p>
          ) : relations.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">暂无关联关系</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>源实例</TableHead>
                  <TableHead>关联类型</TableHead>
                  <TableHead>目标实例</TableHead>
                  <TableHead>扩展属性</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relations.map(rel => (
                  <TableRow key={rel.id}>
                    <TableCell>
                      <Link href={`/cmdb/instances/${rel.srcInstanceId}`} className="hover:underline">
                        {rel.srcInstanceName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{KIND_MAP[rel.associationKind] ?? rel.associationKind}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/cmdb/instances/${rel.dstInstanceId}`} className="hover:underline">
                        {rel.dstInstanceName}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {rel.metadata && Object.keys(rel.metadata).length > 0
                        ? JSON.stringify(rel.metadata)
                        : '-'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(rel.createdAt).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <PermissionGuard resource="cmdb_relation" action="create">
                          <Button size="sm" variant="ghost" onClick={() => {
                            setRelEditTarget(rel)
                            setRelEditMeta({ ...(rel.metadata ?? {}) } as Record<string, string>)
                          }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard resource="cmdb_relation" action="delete">
                          <Button size="sm" variant="ghost" onClick={() => setRelDeleteTarget(rel)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </PermissionGuard>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* ========== Topology Tab ========== */}
      {tab === 'topology' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">拓扑图</h2>
            <div className="flex items-center gap-2">
              <Label className="text-sm">深度:</Label>
              {[1, 2, 3, 5].map(d => (
                <Button key={d} size="sm" variant={topoDepth === d ? 'default' : 'outline'}
                  onClick={() => setTopoDepth(d)}>{d}</Button>
              ))}
            </div>
          </div>

          {topoLoading ? (
            <p className="text-muted-foreground text-sm">加载中...</p>
          ) : topoData ? (
            <div className="border rounded-lg p-4">
              <TopologyView nodes={topoData.nodes} edges={topoData.edges} />
              <p className="text-xs text-muted-foreground mt-4">
                {topoData.nodes.length} 个节点 · {topoData.edges.length} 条连线
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">无拓扑数据</p>
          )}
        </div>
      )}

      {/* ========== Impact Analysis Tab ========== */}
      {tab === 'impact' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">影响分析</h2>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">方向:</Label>
              <Select value={impactDirection} onValueChange={v => { setImpactDirection(v ?? 'bidirectional'); setImpactTriggered(false) }}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">双向</SelectItem>
                  <SelectItem value="upstream">上游</SelectItem>
                  <SelectItem value="downstream">下游</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">深度:</Label>
              <Select value={String(impactDepth)} onValueChange={v => { setImpactDepth(Number(v)); setImpactTriggered(false) }}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => setImpactTriggered(true)} disabled={impactQuery.isPending}>
              {impactQuery.isPending ? '分析中...' : '开始分析'}
            </Button>
          </div>

          {!impactTriggered ? (
            <p className="text-muted-foreground text-sm py-8 text-center">设置参数后点击「开始分析」</p>
          ) : impactQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">分析中...</p>
          ) : impactQuery.data ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex gap-3">
                <Badge variant="outline">方向: {impactDirection === 'both' ? '双向' : impactDirection === 'upstream' ? '上游' : '下游'}</Badge>
                <Badge variant="outline">深度: {impactQuery.data.maxDepth}</Badge>
                {impactQuery.data.truncated && <Badge variant="secondary">结果已截断</Badge>}
              </div>

              {/* Layers */}
              {impactQuery.data.layers.map(layer => (
                <div key={layer.depth} className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-2">层级 {layer.depth} ({layer.nodes.length} 个节点)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {layer.nodes.map((node, i) => (
                      <div key={`${node.id ?? 'null'}-${i}`} className="border rounded p-2 text-sm">
                        {node.id ? (
                          <Link href={`/cmdb/instances/${node.id}`} className="font-medium hover:underline">
                            {node.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{node.name}</span>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {node.modelName} {node.status && `· ${node.status}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Edges */}
              {impactQuery.data.edges.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-2">路径 ({impactQuery.data.edges.length})</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>源</TableHead>
                        <TableHead>关系</TableHead>
                        <TableHead>目标</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {impactQuery.data.edges.map((edge, i) => (
                        <TableRow key={i}>
                          <TableCell>{edge.src ?? '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{edge.label || edge.kind}</Badge>
                          </TableCell>
                          <TableCell>{edge.dst ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">分析失败，请重试</p>
          )}
        </div>
      )}


      {/* ========== Devices Tab ========== */}
      {tab === 'devices' && (
        <div>
          <h2 className="font-semibold mb-4">关联设备</h2>
          {devicesLoading ? (
            <p className="text-muted-foreground text-sm">加载中...</p>
          ) : relatedDevices.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">暂无关联设备</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>设备名称</TableHead>
                  <TableHead>设备类型</TableHead>
                  <TableHead>IP 地址</TableHead>
                  <TableHead>分类标签</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedDevices.map((dev: any) => (
                  <TableRow key={dev.id}>
                    <TableCell>
                      <Link href={`/devices/${dev.id}`} className="hover:underline text-primary">
                        {dev.name}
                      </Link>
                    </TableCell>
                    <TableCell>{dev.deviceType ?? '-'}</TableCell>
                    <TableCell className="font-mono">{dev.ip ?? '-'}</TableCell>
                    <TableCell>{dev.category ?? '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* ========== Change Docs Tab ========== */}
      {tab === 'change-docs' && (
        <div>
          <h2 className="font-semibold mb-4">相关变更</h2>

          {cdLoading ? (
            <p className="text-muted-foreground text-sm">加载中...</p>
          ) : relatedChangeDocs.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">暂无关联变更文档</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>变更编号</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>影响级别</TableHead>
                  <TableHead>关联时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedChangeDocs.map((cd: any) => {
                  const st = CHANGE_DOC_STATUS_MAP[cd.status] ?? { label: cd.status ?? '-', variant: 'secondary' as const }
                  const impactVariant = cd.impactLevel === 'high' ? 'destructive' as const
                    : cd.impactLevel === 'medium' ? 'default' as const
                    : 'secondary' as const
                  const impactLabel = cd.impactLevel === 'high' ? '高'
                    : cd.impactLevel === 'medium' ? '中'
                    : cd.impactLevel === 'low' ? '低'
                    : '-'
                  return (
                    <TableRow key={cd.id}>
                      <TableCell>
                        <Link href={`/change-docs/${cd.changeDocId}`} className="hover:underline font-medium">
                          {cd.changeNo ?? '-'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {cd.impactLevel ? (
                          <Badge variant={impactVariant}>{impactLabel}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {cd.linkCreatedAt ? new Date(cd.linkCreatedAt).toLocaleString('zh-CN') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/change-docs/${cd.changeDocId}`}>
                          <Button size="sm" variant="outline">查看变更</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* ========== Daily Reports Tab ========== */}
      {tab === 'daily-reports' && (
        <div>
          <h2 className="font-semibold mb-4">相关日报</h2>

          {drLoading ? (
            <p className="text-muted-foreground text-sm">加载中...</p>
          ) : relatedDailyReports.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">暂无关联日报</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>提交人</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>内容摘要</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedDailyReports.map((dr: any) => {
                  const DAILY_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
                    DRAFT:     { label: '草稿',   variant: 'secondary' },
                    SUBMITTED: { label: '待审批', variant: 'default' },
                    APPROVED:  { label: '已通过', variant: 'outline' },
                    REJECTED:  { label: '已拒绝', variant: 'destructive' },
                  }
                  const st = DAILY_STATUS_MAP[dr.status] ?? { label: dr.status ?? '-', variant: 'secondary' as const }
                  return (
                    <TableRow key={dr.id}>
                      <TableCell className="whitespace-nowrap text-sm">{dr.reportDate ?? '-'}</TableCell>
                      <TableCell>{dr.reporterName ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{dr.completedItemsBrief ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/daily/${dr.id}`}>
                          <Button size="sm" variant="outline">查看日报</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* ========== History Tab ========== */}
      {tab === 'history' && (
        <div>
          <h2 className="font-semibold mb-4">变更历史</h2>

          {historyLoading ? (
            <p className="text-muted-foreground text-sm">加载中...</p>
          ) : historyRecords.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">暂无变更记录</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>操作类型</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead>变更内容</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRecords.map(ch => (
                    <TableRow key={ch.id}>
                      <TableCell>
                        <Badge variant={ch.action === 'create' ? 'default' : ch.action === 'delete' ? 'destructive' : 'secondary'}>
                          {ACTION_MAP[ch.action] ?? ch.action}
                        </Badge>
                      </TableCell>
                      <TableCell>{ch.operatorName ?? '-'}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {ch.afterJson
                          ? Object.entries(ch.afterJson).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join('; ')
                          : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(ch.createdAt).toLocaleString('zh-CN')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-muted-foreground">共 {historyTotal} 条</span>
                <div className="flex gap-2 items-center">
                  <Button size="sm" variant="outline" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">{historyPage} / {historyTotalPages || 1}</span>
                  <Button size="sm" variant="outline" disabled={historyPage >= historyTotalPages} onClick={() => setHistoryPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========== Edit Instance Dialog ========== */}
      <Dialog open={editOpen} onOpenChange={(v) => !v && setEditOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑实例</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>名称 *</Label>
                <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>状态</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v ?? '' }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="running">运行中</SelectItem>
                    <SelectItem value="stopped">已停用</SelectItem>
                    <SelectItem value="maintenance">维护中</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>负责人</Label>
                <Input value={editForm.owner} onChange={e => setEditForm(f => ({ ...f, owner: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>描述</Label>
                <Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            {/* Dynamic attribute fields */}
            {attrs.filter(a => a.isEditable).length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">属性字段</h3>
                <div className="space-y-3">
                  {attrs
                    .filter(a => a.isEditable)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map(attr => (
                      <div key={attr.id} className="grid grid-cols-[120px_1fr] gap-2 items-start">
                        <Label className="text-sm pt-2">
                          {attr.name}{attr.isRequired && <span className="text-destructive ml-0.5">*</span>}
                        </Label>
                        {renderEditField(attr)}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button size="sm" onClick={() => updateMutation.mutate()}
              disabled={!editForm.name.trim() || updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Create Relation Dialog ========== */}
      <Dialog open={relCreateOpen} onOpenChange={(v) => !v && setRelCreateOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建关联</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>关联类型 *</Label>
              <Select value={relForm.associationKind} onValueChange={v => {
                setRelForm(f => ({ ...f, associationKind: v ?? '', metadata: {} }))
              }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="请选择" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>目标实例 *</Label>
              <Input
                placeholder="输入关键词搜索实例..."
                value={relSearchKeyword}
                onChange={e => setRelSearchKeyword(e.target.value)}
              />
              {searchResults.length > 0 && !relForm.dstInstanceId && (
                <div className="border rounded max-h-40 overflow-auto">
                  {searchResults.map((r: any) => (
                    <button
                      key={r.id}
                      onClick={() => setRelForm(f => ({ ...f, dstInstanceId: String(r.id) }))}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    >
                      {r.name} <span className="text-muted-foreground">({r.modelName})</span>
                    </button>
                  ))}
                </div>
              )}
              {relForm.dstInstanceId && (
                <p className="text-sm text-muted-foreground">
                  已选择: 实例 #{relForm.dstInstanceId}
                  <Button variant="link" size="sm" className="h-auto p-0 ml-2"
                    onClick={() => setRelForm(f => ({ ...f, dstInstanceId: '' }))}>
                    重选
                  </Button>
                </p>
              )}
            </div>

            {/* Dynamic association metadata fields */}
            {assocAttrDefs.length > 0 && (
              <div className="border-t pt-3 space-y-3">
                <h4 className="text-sm font-medium">扩展属性</h4>
                {assocAttrDefs.map(ad => {
                  const val = relForm.metadata[ad.fieldKey] ?? ad.defaultValue ?? ''
                  const setVal = (v: string) => setRelForm(f => ({
                    ...f, metadata: { ...f.metadata, [ad.fieldKey]: v },
                  }))

                  return (
                    <div key={ad.id} className="grid grid-cols-[100px_1fr] gap-2 items-center">
                      <Label className="text-sm">
                        {ad.name}{ad.isRequired && <span className="text-destructive ml-0.5">*</span>}
                      </Label>
                      {ad.fieldType === 'enum' ? (
                        <Select value={val} onValueChange={v => setVal(v ?? '')}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="请选择" /></SelectTrigger>
                          <SelectContent>
                            {(ad.enumOptions ?? '').split('\n').filter(Boolean).map(o =>
                              <SelectItem key={o.trim()} value={o.trim()}>{o.trim()}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={val} onChange={e => setVal(e.target.value)} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setRelCreateOpen(false)}>取消</Button>
            <Button size="sm" onClick={() => createRelMutation.mutate()}
              disabled={!relForm.associationKind || !relForm.dstInstanceId || createRelMutation.isPending}>
              {createRelMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Edit Relation Metadata Dialog ========== */}
      <Dialog open={!!relEditTarget} onOpenChange={(v) => !v && setRelEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑关联属性</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {relEditTarget && (
              <p className="text-sm text-muted-foreground">
                {relEditTarget.srcInstanceName} → {relEditTarget.dstInstanceName}
              </p>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Metadata (JSON)</Label>
              <Textarea
                value={JSON.stringify(relEditMeta, null, 2)}
                onChange={e => {
                  try { setRelEditMeta(JSON.parse(e.target.value)) } catch { /* ignore parse error */ }
                }}
                rows={4}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setRelEditTarget(null)}>取消</Button>
            <Button size="sm" onClick={() => updateRelMutation.mutate()} disabled={updateRelMutation.isPending}>
              {updateRelMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Delete Relation Confirmation ========== */}
      <AlertDialog open={!!relDeleteTarget} onOpenChange={(v) => !v && setRelDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除关联「{relDeleteTarget?.srcInstanceName} → {relDeleteTarget?.dstInstanceName}」吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => relDeleteTarget && deleteRelMutation.mutate(relDeleteTarget.id)}
              disabled={deleteRelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRelMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
