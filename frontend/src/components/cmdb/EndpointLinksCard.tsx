'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Cable, Plus, X } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'

interface EndpointLinkVO {
  id: number
  linkType: string
  srcInstanceId: number
  srcInstanceName?: string
  srcFieldKey: string
  srcEndpointUid: string
  srcEndpointLabel?: string
  dstInstanceId: number
  dstInstanceName?: string
  dstFieldKey?: string
  dstEndpointUid?: string
  dstEndpointLabel?: string
}

interface InstanceVO {
  id: number
  modelId: string
  name?: string
  fieldsData?: Record<string, unknown>
  attributes?: { fieldKey: string; fieldType: string; name: string }[]
}

const LINK_TYPES = [
  { value: 'net', label: '网络（网口↔交换机口）' },
  { value: 'fc', label: 'FC/SAN（HBA↔SAN口）' },
  { value: 'lun', label: 'LUN 分配（存储↔主机）' },
]

/**
 * 端点连接卡片（spec §8，P3）。ci_endpoint_link 是连接的唯一事实源，
 * 增删连接自动维护 connect 类 managed 镜像边（拓扑图可见）。
 * 端点以本实例 table 字段（nics/ports/luns 等）的行 row_id 锚定。
 */
export function EndpointLinksCard({ instanceId }: { instanceId: string }) {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canWrite = hasPermission('cmdb_relation', 'create')
  const [open, setOpen] = useState(false)
  const [linkType, setLinkType] = useState('net')
  const [srcFieldKey, setSrcFieldKey] = useState('')
  const [srcEndpointUid, setSrcEndpointUid] = useState('')
  const [dstId, setDstId] = useState('')
  const [dstKeyword, setDstKeyword] = useState('')
  const [dstModel, setDstModel] = useState('net_switch')
  const [dstFieldKey, setDstFieldKey] = useState('')
  const [dstEndpointUid, setDstEndpointUid] = useState('')

  const { data: links } = useQuery<EndpointLinkVO[]>({
    queryKey: ['cmdb-endpoint-links', instanceId],
    queryFn: () => api.get(`/cmdb/endpoint-links/by-instance/${instanceId}`).then((r: any) => r.data.data),
  })

  // 本实例（拿 table 字段做端点来源）
  const { data: self } = useQuery<InstanceVO>({
    queryKey: ['cmdb-instance', instanceId],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}`).then((r: any) => r.data.data),
  })
  const tableFields = (self?.attributes ?? []).filter((a) => a.fieldType === 'table')
  const srcRows = tableRows(self?.fieldsData?.[srcFieldKey])

  // 目标实例候选
  const { data: dstList } = useQuery<InstanceVO[]>({
    queryKey: ['cmdb-link-dst', dstModel, dstKeyword],
    queryFn: () =>
      api
        .get(`/cmdb/instances`, { params: { model: dstModel, keyword: dstKeyword, page: 1, size: 20 } })
        .then((r: any) => (r.data.data?.records ?? r.data.data?.list ?? r.data.data ?? []) as InstanceVO[]),
    enabled: open,
  })
  // 选中目标的端点行
  const { data: dstInst } = useQuery<InstanceVO>({
    queryKey: ['cmdb-instance', dstId],
    queryFn: () => api.get(`/cmdb/instances/${dstId}`).then((r: any) => r.data.data),
    enabled: open && !!dstId,
  })
  const dstTableFields = (dstInst?.attributes ?? []).filter((a) => a.fieldType === 'table')
  const dstRows = tableRows(dstInst?.fieldsData?.[dstFieldKey])

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(`/cmdb/endpoint-links`, {
        linkType,
        srcInstanceId: Number(instanceId),
        srcFieldKey,
        srcEndpointUid,
        srcEndpointLabel: rowLabel(srcRows, srcEndpointUid),
        dstInstanceId: Number(dstId),
        dstFieldKey: dstFieldKey || undefined,
        dstEndpointUid: dstEndpointUid || undefined,
        dstEndpointLabel: dstEndpointUid ? rowLabel(dstRows, dstEndpointUid) : undefined,
      }),
    onSuccess: () => {
      toast.success('连接已建立')
      queryClient.invalidateQueries({ queryKey: ['cmdb-endpoint-links', instanceId] })
      setOpen(false)
      setSrcFieldKey(''); setSrcEndpointUid(''); setDstId(''); setDstFieldKey(''); setDstEndpointUid('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '连接失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/endpoint-links/${id}`),
    onSuccess: () => {
      toast.success('连接已解除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-endpoint-links', instanceId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '解除失败'),
  })

  // 无 table 字段（无端点来源）则不显示
  if (tableFields.length === 0) return null

  return (
    <div className="rounded-xl border border-v2-border bg-v2-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-v2-border bg-v2-surface-soft">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-v2-muted">
          <Cable className="h-3.5 w-3.5" />
          端口连接
        </span>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => { setSrcFieldKey(tableFields[0]?.fieldKey ?? ''); setOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1" />新建连接
          </Button>
        )}
      </div>
      <div className="px-4 py-3">
        {(links ?? []).length === 0 ? (
          <span className="text-sm text-v2-subtle">暂无端口连接</span>
        ) : (
          <ul className="space-y-1.5">
            {(links ?? []).map((l) => {
              const isSrc = String(l.srcInstanceId) === String(instanceId)
              const localLabel = isSrc ? l.srcEndpointLabel ?? l.srcEndpointUid : l.dstEndpointLabel ?? l.dstEndpointUid
              const peerName = isSrc ? l.dstInstanceName : l.srcInstanceName
              const peerLabel = isSrc ? l.dstEndpointLabel ?? l.dstEndpointUid : l.srcEndpointLabel ?? l.srcEndpointUid
              return (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <span className="text-v2-fg">
                    <span className="font-v2-mono text-xs px-1.5 py-0.5 rounded bg-v2-surface-soft border border-v2-border mr-1">{l.linkType}</span>
                    {localLabel} <span className="text-v2-muted">↔</span> {peerName ?? `#${isSrc ? l.dstInstanceId : l.srcInstanceId}`}
                    {peerLabel && <span className="text-v2-muted"> / {peerLabel}</span>}
                  </span>
                  {canWrite && (
                    <button type="button" onClick={() => deleteMutation.mutate(l.id)} className="text-v2-danger hover:opacity-70" title="解除连接">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>新建端口连接</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">连接类型</Label>
              <Select value={linkType} onValueChange={(v) => setLinkType(v ?? 'net')}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => LINK_TYPES.find((t) => t.value === v)?.label ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>{LINK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">本端字段</Label>
                <Select value={srcFieldKey} onValueChange={(v) => { setSrcFieldKey(v ?? ''); setSrcEndpointUid('') }}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择端口表">
                      {(v: string) => tableFields.find((f) => f.fieldKey === v)?.name ?? '选择端口表'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>{tableFields.map((f) => <SelectItem key={f.fieldKey} value={f.fieldKey}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">本端端口</Label>
                <Select value={srcEndpointUid} onValueChange={(v) => setSrcEndpointUid(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择端口">
                      {(v: string) => srcRows.find((r) => r.uid === v)?.label ?? '选择端口'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>{srcRows.map((r) => <SelectItem key={r.uid} value={r.uid}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">对端模型</Label>
                <Input value={dstModel} onChange={(e) => setDstModel(e.target.value)} placeholder="net_switch / storage…" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">对端设备</Label>
                <Input placeholder="搜索…" value={dstKeyword} onChange={(e) => setDstKeyword(e.target.value)} />
              </div>
            </div>
            <Select value={dstId} onValueChange={(v) => { setDstId(v ?? ''); setDstFieldKey(''); setDstEndpointUid('') }}>
              <SelectTrigger>
                <SelectValue placeholder="选择对端设备">
                  {(v: string) => {
                    const d = (dstList ?? []).find((dd) => String(dd.id) === v)
                    return d ? (d.name ?? `#${d.id}`) : '选择对端设备'
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>{(dstList ?? []).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name ?? `#${d.id}`}</SelectItem>)}</SelectContent>
            </Select>

            {dstId && dstTableFields.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">对端字段（可选）</Label>
                  <Select value={dstFieldKey} onValueChange={(v) => { setDstFieldKey(v ?? ''); setDstEndpointUid('') }}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择端口表">
                        {(v: string) => dstTableFields.find((f) => f.fieldKey === v)?.name ?? '选择端口表'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>{dstTableFields.map((f) => <SelectItem key={f.fieldKey} value={f.fieldKey}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">对端端口（可选）</Label>
                  <Select value={dstEndpointUid} onValueChange={(v) => setDstEndpointUid(v ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择端口">
                        {(v: string) => dstRows.find((r) => r.uid === v)?.label ?? '选择端口'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>{dstRows.map((r) => <SelectItem key={r.uid} value={r.uid}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!srcFieldKey || !srcEndpointUid || !dstId || createMutation.isPending}>
                建立连接
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 从 table 字段值提取 {uid,label} 端点行。优先用 port/name/mount 等显示列做 label。 */
function tableRows(val: unknown): { uid: string; label: string }[] {
  if (!Array.isArray(val)) return []
  return val
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => {
      const uid = String(r.row_id ?? '')
      const label = String(r.port ?? r.name ?? r.mount ?? r.wwpn ?? uid)
      return { uid, label }
    })
    .filter((r) => r.uid)
}

function rowLabel(rows: { uid: string; label: string }[], uid: string): string | undefined {
  return rows.find((r) => r.uid === uid)?.label
}
