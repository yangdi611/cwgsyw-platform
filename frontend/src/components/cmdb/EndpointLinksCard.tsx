'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, Input, NeutralDialog, Select } from '@/design-system/figma-neutral/components'
import { toast } from '@/design-system/figma-neutral/toast'
import { usePermission } from '@/hooks/usePermission'

import { getApiErrorMessage } from '@/lib/api-error'

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
    queryFn: () => api.get(`/cmdb/endpoint-links/by-instance/${instanceId}`).then(r => r.data.data),
  })

  const { data: self } = useQuery<InstanceVO>({
    queryKey: ['cmdb-instance', instanceId],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}`).then(r => r.data.data),
  })
  const tableFields = (self?.attributes ?? []).filter((a) => a.fieldType === 'table')
  const srcRows = tableRows(self?.fieldsData?.[srcFieldKey])

  // 目标实例候选
  const { data: dstList } = useQuery<InstanceVO[]>({
    queryKey: ['cmdb-link-dst', dstModel, dstKeyword],
    queryFn: () =>
      api
        .get(`/cmdb/instances`, { params: { model: dstModel, keyword: dstKeyword, page: 1, size: 20 } })
        .then(r => (r.data.data?.records ?? r.data.data?.list ?? r.data.data ?? []) as InstanceVO[]),
    enabled: open,
  })
  // 选中目标的端点行
  const { data: dstInst } = useQuery<InstanceVO>({
    queryKey: ['cmdb-instance', dstId],
    queryFn: () => api.get(`/cmdb/instances/${dstId}`).then(r => r.data.data),
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
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '连接失败')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/endpoint-links/${id}`),
    onSuccess: () => {
      toast.success('连接已解除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-endpoint-links', instanceId] })
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '解除失败')),
  })

  // 无 table 字段（无端点来源）则不显示
  if (tableFields.length === 0) return null

  return (
    <div className="rounded-xl border border-[var(--cwgsyw-border-default)] bg-[var(--cwgsyw-bg-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--cwgsyw-border-default)] bg-[var(--cwgsyw-bg-surface-subtle)]">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--cwgsyw-text-secondary)]">
          
          端口连接
        </span>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => { setSrcFieldKey(tableFields[0]?.fieldKey ?? ''); setOpen(true) }}>
            新建连接
          </Button>
        )}
      </div>
      <div className="px-4 py-3">
        {(links ?? []).length === 0 ? (
          <span className="text-sm text-[var(--cwgsyw-text-tertiary)]">暂无端口连接</span>
        ) : (
          <ul className="space-y-1.5">
            {(links ?? []).map((l) => {
              const isSrc = String(l.srcInstanceId) === String(instanceId)
              const localLabel = isSrc ? l.srcEndpointLabel ?? l.srcEndpointUid : l.dstEndpointLabel ?? l.dstEndpointUid
              const peerName = isSrc ? l.dstInstanceName : l.srcInstanceName
              const peerLabel = isSrc ? l.dstEndpointLabel ?? l.dstEndpointUid : l.srcEndpointLabel ?? l.srcEndpointUid
              return (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--cwgsyw-text-primary)]">
                    <span className="font-[family-name:var(--cwgsyw-font-family-mono)] text-xs px-1.5 py-0.5 rounded bg-[var(--cwgsyw-bg-surface-subtle)] border border-[var(--cwgsyw-border-default)] mr-1">{l.linkType}</span>
                    {localLabel} <span className="text-[var(--cwgsyw-text-secondary)]">↔</span> {peerName ?? `#${isSrc ? l.dstInstanceId : l.srcInstanceId}`}
                    {peerLabel && <span className="text-[var(--cwgsyw-text-secondary)]"> / {peerLabel}</span>}
                  </span>
                  {canWrite && (
                    <Button type="button" size="sm" variant="destructive" onClick={() => deleteMutation.mutate(l.id)} aria-label="解除连接">
                      删除
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <NeutralDialog open={open} onOpenChange={setOpen} title="新建端口连接">
        <div className="cwgsyw-form">
          <Select
            value={linkType}
            options={LINK_TYPES}
            onChange={(v) => setLinkType(v || 'net')}
          />
          <Select
            value={srcFieldKey}
            placeholder="本端字段"
            options={tableFields.map((f) => ({ value: f.fieldKey, label: f.name }))}
            onChange={(v) => { setSrcFieldKey(v); setSrcEndpointUid('') }}
          />
          <Select
            value={srcEndpointUid}
            placeholder="本端端口"
            options={srcRows.map((r) => ({ value: r.uid, label: r.label }))}
            onChange={setSrcEndpointUid}
          />
          <Input value={dstModel} onChange={(e) => setDstModel(e.target.value)} placeholder="对端模型 net_switch / storage…" />
          <Input placeholder="搜索对端设备" value={dstKeyword} onChange={(e) => setDstKeyword(e.target.value)} />
          <Select
            value={dstId}
            placeholder="选择对端设备"
            options={(dstList ?? []).map((d) => ({ value: String(d.id), label: d.name ?? `#${d.id}` }))}
            onChange={(v) => { setDstId(v); setDstFieldKey(''); setDstEndpointUid('') }}
          />
          {dstId && dstTableFields.length > 0 ? (
            <>
              <Select
                value={dstFieldKey}
                placeholder="对端字段（可选）"
                options={dstTableFields.map((f) => ({ value: f.fieldKey, label: f.name }))}
                onChange={(v) => { setDstFieldKey(v); setDstEndpointUid('') }}
              />
              <Select
                value={dstEndpointUid}
                placeholder="对端端口（可选）"
                options={dstRows.map((r) => ({ value: r.uid, label: r.label }))}
                onChange={setDstEndpointUid}
              />
            </>
          ) : null}
          <div className="cwgsyw-inline-controls">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button type="button" disabled={!srcFieldKey || !srcEndpointUid || !dstId || createMutation.isPending} onClick={() => createMutation.mutate()}>
              建立连接
            </Button>
          </div>
        </div>
      </NeutralDialog>
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
