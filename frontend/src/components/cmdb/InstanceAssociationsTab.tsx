'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { motion, MotionConfig } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { CiInstanceDrawer } from '@/components/cmdb/CiInstanceDrawer'
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  EmptyState,
  Field,
  Input,
  LoadingState,
  NeutralAlertDialog,
  NeutralDialog,
  SearchInput,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

interface CiRelationVO {
  id: number
  srcInstanceId: number
  srcInstanceName: string
  dstInstanceId: number
  dstInstanceName: string
  associationKind: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface CiAssociationDefVO {
  defId: string
  kindId: string
  name: string
  srcModelId: string
  dstModelId: string
  mapping: string
}

interface CiAssociationDefListVO {
  defId: string
  name: string
  kindName: string
}

interface AssociationAttrVO {
  id: number
  fieldKey: string
  name: string
  fieldType: string
  isRequired: boolean
  enumOptions: string | null
  defaultValue: string | null
  sortOrder: number
}

interface InstanceSearchVO {
  id: number
  name: string
  modelId: string
  modelName: string
}

interface Props {
  modelCode: string
  id: string
}

export function InstanceAssociationsTab({ modelCode, id }: Props) {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [definitionOpen, setDefinitionOpen] = useState(false)
  const [selectedDefId, setSelectedDefId] = useState('')
  const [peerSearch, setPeerSearch] = useState('')
  const [selectedPeerId, setSelectedPeerId] = useState<number | null>(null)
  const [addError, setAddError] = useState('')
  const [drawerInstId, setDrawerInstId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [metadata, setMetadata] = useState<Record<string, unknown>>({})

  const { data: defs = [] } = useQuery<CiAssociationDefListVO[]>({
    queryKey: ['cmdb-association-defs'],
    queryFn: () => api.get('/cmdb/association-defs').then((r) => r.data.data ?? []),
    staleTime: 600_000,
  })
  const kindMap = useMemo(() => new Map(defs.map((d) => [d.defId, d.name])), [defs])

  const { data: relations = [], isLoading } = useQuery<CiRelationVO[]>({
    queryKey: ['cmdb-rel', id],
    queryFn: () => api.get(`/cmdb/instances/${id}/relations`).then((r) => r.data.data ?? []),
  })

  const currentId = Number(id)
  const groups = useMemo(() => {
    const map = new Map<string, CiRelationVO[]>()
    for (const rel of relations) {
      const k = rel.associationKind || '(未分类)'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(rel)
    }
    return Array.from(map, ([kind, rels]) => ({ kind, rels }))
  }, [relations])

  const needsNodeRole = groups.some((g) => g.kind === 'host_belong_resource_pool')
  const hostPeerIds = useMemo(() => {
    if (!needsNodeRole) return []
    const ids = new Set<number>()
    for (const g of groups) {
      if (g.kind === 'host_belong_resource_pool') {
        for (const rel of g.rels) ids.add(rel.srcInstanceId === currentId ? rel.dstInstanceId : rel.srcInstanceId)
      }
    }
    return Array.from(ids)
  }, [groups, needsNodeRole, currentId])

  const hostResults = useQueries({
    queries: hostPeerIds.map((hostId) => ({
      queryKey: ['cmdb-instance-drawer', hostId],
      queryFn: () => api.get(`/cmdb/instances/${hostId}`).then((r) => r.data.data),
      staleTime: 600_000,
    })),
  })
  const hostRoleMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const q of hostResults) {
      if (q.data) map.set(q.data.id, (q.data.fieldsData?.node_role as string) ?? '')
    }
    return map
  }, [hostResults])
  const roleOrder = (r: string) => (r === 'master' ? 0 : r === 'worker' ? 1 : r ? 2 : 3)
  const roleLabel: Record<string, string> = { master: '控制节点', worker: '工作节点', storage: '存储节点', network: '网络节点' }

  const { data: modelDetail } = useQuery<{ associationDefs?: CiAssociationDefVO[] }>({
    queryKey: ['cmdb-model-defs', modelCode],
    queryFn: () => api.get(`/cmdb/models/${modelCode}`).then((r) => r.data.data),
    enabled: addDialogOpen,
  })
  const applicableDefs = ((modelDetail?.associationDefs ?? []) as CiAssociationDefVO[]).filter(
    (d) => d.srcModelId === modelCode || d.dstModelId === modelCode,
  )
  const selectedDef = applicableDefs.find((d) => d.defId === selectedDefId)
  const targetModelId = selectedDef
    ? (selectedDef.srcModelId === modelCode ? selectedDef.dstModelId : selectedDef.srcModelId)
    : null

  const { data: kindAttrs = [] } = useQuery<AssociationAttrVO[]>({
    queryKey: ['cmdb-asst-attrs', selectedDef?.kindId],
    queryFn: () => api.get(`/cmdb/association-kinds/${selectedDef!.kindId}/attributes`).then((r) => r.data.data),
    enabled: !!selectedDef && addDialogOpen,
  })

  const { data: searchResult } = useQuery<{ records: InstanceSearchVO[]; total: number }>({
    queryKey: ['cmdb-rel-search', targetModelId, peerSearch],
    queryFn: () => api.get('/cmdb/instances/search', {
      params: { modelId: targetModelId, keyword: peerSearch, size: 8 },
    }).then((r) => r.data.data),
    enabled: !!targetModelId && addDialogOpen,
  })

  const deleteRelMutation = useMutation({
    mutationFn: (relId: number) => api.delete(`/cmdb/instances/${id}/relations/${relId}`),
    onSuccess: () => {
      toast.success('关联已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-rel', id] })
      setDeleteId(null)
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const createRelMutation = useMutation({
    mutationFn: () => {
      if (!selectedDef || !selectedPeerId) throw new Error('请选择关联定义和目标实例')
      return api.post(`/cmdb/instances/${id}/relations`, {
        defId: selectedDef.defId,
        dstInstanceId: selectedPeerId,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      })
    },
    onSuccess: () => {
      toast.success('关联已建立')
      setAddDialogOpen(false)
      setSelectedDefId('')
      setSelectedPeerId(null)
      setPeerSearch('')
      setMetadata({})
      setAddError('')
      queryClient.invalidateQueries({ queryKey: ['cmdb-rel', id] })
    },
    onError: (e: { response?: { data?: { message?: string } } }) => setAddError(e?.response?.data?.message ?? '创建失败'),
  })

  return (
    <section className="cwgsyw-cmdb-instance-associations cwgsyw-cmdb-instance-tab__section">
      <div className="cwgsyw-cmdb-instance-associations__head cwgsyw-cmdb-instance-tab__head">
        <h2>关联关系 <span>{relations.length}</span></h2>
        <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/instances/by-model/${modelCode}/${id}/associations`)}>
          管理全部关联
        </Button>
      </div>
      <div className="cwgsyw-cmdb-instance-tab__body">
        {isLoading ? (
          <LoadingState label="加载关联" />
        ) : groups.length === 0 ? (
          <div className="cwgsyw-cmdb-instance-tab__empty">
            <span className="cwgsyw-cmdb-instance-tab__empty-icon" aria-hidden="true">
              <Image
                src="/figma-icons/cmdb-association-link-2.svg"
                alt=""
                width={22}
                height={12}
                data-figma-node="6:27582"
                className="cwgsyw-cmdb-instance-tab__empty-icon-image"
              />
            </span>
            <EmptyState title="暂无关联" showIcon={false} />
          </div>
        ) : (
          <div className="cwgsyw-cmdb-instance-associations__groups">
            {groups.map((group) => {
            const isHostPool = group.kind === 'host_belong_resource_pool'
            const sortedRels = isHostPool
              ? [...group.rels].sort((a, b) => {
                  const peerA = a.srcInstanceId === currentId ? a.dstInstanceId : a.srcInstanceId
                  const peerB = b.srcInstanceId === currentId ? b.dstInstanceId : b.srcInstanceId
                  return roleOrder(hostRoleMap.get(peerA) ?? '') - roleOrder(hostRoleMap.get(peerB) ?? '')
                })
              : group.rels
            return (
              <div key={group.kind} className="cwgsyw-cmdb-table-block">
                <div className="cwgsyw-cmdb-table-block__title">{kindMap.get(group.kind) ?? group.kind} {group.rels.length}</div>
                <Table
                  className="cwgsyw-cmdb-table"
                  showSearch={false}
                  density="compact"
                  columns={[
                    { key: 'peer', label: '对端 CI' },
                    { key: 'direction', label: '方向' },
                    ...(isHostPool ? [{ key: 'role', label: '节点角色' }] : []),
                    { key: 'attrs', label: '关联属性' },
                    { key: 'actions', label: '' },
                  ]}
                  rows={sortedRels.map((rel) => {
                    const isSrc = rel.srcInstanceId === currentId
                    const peerName = isSrc ? rel.dstInstanceName : rel.srcInstanceName
                    const peerId = isSrc ? rel.dstInstanceId : rel.srcInstanceId
                    const metaEntries = rel.metadata ? Object.entries(rel.metadata) : []
                    const nodeRole = isHostPool ? (hostRoleMap.get(peerId) ?? '') : ''
                    return {
                      id: String(rel.id),
                      cells: {
                        peer: peerName,
                        direction: <Chip label={isSrc ? '→' : '←'} />,
                        role: nodeRole ? <StatusBadge label={roleLabel[nodeRole] ?? nodeRole} status={nodeRole === 'master' ? 'warning' : 'neutral'} /> : '—',
                        attrs: metaEntries.length > 0 ? metaEntries.map(([k, v]) => `${k}=${String(v)}`).join('，') : '—',
                        actions: hasPermission('cmdb_instance', 'delete') ? (
                          <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteId(rel.id)}>删除</Button>
                        ) : null,
                      },
                    }
                  })}
                  onRowClick={(rowId) => {
                    const rel = sortedRels.find((item) => String(item.id) === rowId)
                    if (!rel) return
                    setDrawerInstId(rel.srcInstanceId === currentId ? rel.dstInstanceId : rel.srcInstanceId)
                  }}
                />
              </div>
            )
            })}
          </div>
        )}

        {hasPermission('cmdb_instance', 'create') ? (
          <Button className="cwgsyw-cmdb-instance-associations__add" type="button" size="sm" variant="primary" onClick={() => { setAddDialogOpen(true); setAddError('') }}>
            添加关联
          </Button>
        ) : null}
      </div>

      <CiInstanceDrawer instanceId={drawerInstId} onClose={() => setDrawerInstId(null)} />
      <NeutralAlertDialog
        open={deleteId != null}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        title="删除此关联?"
        description="删除后无法恢复。"
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => { if (deleteId != null) deleteRelMutation.mutate(deleteId) }}
      />

      <NeutralDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open)
          if (!open) { setDefinitionOpen(false); setAddError(''); setSelectedDefId(''); setSelectedPeerId(null); setPeerSearch(''); setMetadata({}) }
        }}
        title="添加关联"
        description="选择关联定义和目标实例；如有需要，再补充关联属性。"
        footer={
          <div className="cwgsyw-inline-controls cwgsyw-cmdb-dialog__actions">
            <Button type="button" size="sm" variant="secondary" onClick={() => setAddDialogOpen(false)}>取消</Button>
            <Button type="button" size="sm" variant="primary" disabled={!selectedDefId || !selectedPeerId || createRelMutation.isPending} onClick={() => createRelMutation.mutate()}>
              {createRelMutation.isPending ? '创建中...' : '建立关联'}
            </Button>
          </div>
        }
      >
        <MotionConfig reducedMotion="user">
          <motion.div
            layout="size"
            className="cwgsyw-cmdb-association-dialog"
            data-definition-open={definitionOpen || undefined}
            transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.8 }}
          >
          <motion.div layout="position" className="cwgsyw-cmdb-dialog__flow-select cwgsyw-cmdb-association-dialog__definition">
            <Field label="关联定义">
              <Select size="sm"
                open={definitionOpen}
                value={selectedDefId}
                placeholder="选择关联定义..."
                options={applicableDefs.map((d) => ({ value: d.defId, label: `${d.name} (${d.mapping})` }))}
                onOpenChange={setDefinitionOpen}
                onChange={(v) => { setSelectedDefId(v); setSelectedPeerId(null); setPeerSearch(''); setMetadata({}); setAddError('') }}
              />
            </Field>
          </motion.div>
          {selectedDef ? (
            <Field label={`目标实例（${searchResult?.records?.[0]?.modelName ?? targetModelId}）`}>
              <SearchInput size="sm"
                placeholder="搜索实例名称..."
                value={peerSearch}
                onChange={(e) => { setPeerSearch(e.target.value); setSelectedPeerId(null) }}
              />
              <div className="cwgsyw-cmdb-association-dialog__candidates" aria-label="目标实例候选">
                {(searchResult?.records ?? []).map((searchInst) => (
                  <Button
                    key={searchInst.id}
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-pressed={selectedPeerId === searchInst.id}
                    onClick={() => setSelectedPeerId(searchInst.id)}
                  >
                    <span>{searchInst.name}</span>
                    <span className="cwgsyw-cmdb-association-dialog__candidate-meta">#{searchInst.id}</span>
                  </Button>
                ))}
                {(searchResult?.records ?? []).length === 0 ? <p className="cwgsyw-cmdb-association-dialog__empty">无匹配实例</p> : null}
              </div>
            </Field>
          ) : null}
          {selectedDef && kindAttrs.length > 0 ? (
            <div className="cwgsyw-cmdb-association-dialog__attributes" aria-label="关联属性">
              {[...kindAttrs].sort((a, b) => a.sortOrder - b.sortOrder).map((attr) => (
                <RelationAttrField
                  key={attr.id}
                  attr={attr}
                  value={metadata[attr.fieldKey]}
                  onChange={(v) => setMetadata((m) => {
                    const next = { ...m }
                    if (v === undefined || v === '' || v === null) delete next[attr.fieldKey]
                    else next[attr.fieldKey] = v
                    return next
                  })}
                />
              ))}
            </div>
          ) : null}
          {addError ? <Alert tone="danger" title="创建失败" description={addError} showDismiss={false} /> : null}
          </motion.div>
        </MotionConfig>
      </NeutralDialog>
    </section>
  )
}

function RelationAttrField({ attr, value, onChange }: {
  attr: AssociationAttrVO
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (attr.fieldType === 'bool') {
    return (
      <Checkbox
        label={`${attr.name}${attr.isRequired ? ' *' : ''}`}
        checked={value === true || value === 'true'}
        onChange={(e) => onChange(e.target.checked)}
      />
    )
  }
  if (attr.fieldType === 'enum') {
    const options = (attr.enumOptions ?? '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
    const current = (value ?? attr.defaultValue ?? '') as string
    return (
      <Field label={`${attr.name}${attr.isRequired ? ' *' : ''}`}>
        <Select size="sm" overlay
          value={current || '__none__'}
          options={[{ value: '__none__', label: '（未设置）' }, ...options.map((o) => ({ value: o, label: o }))]}
          onChange={(v) => onChange(v === '__none__' ? undefined : v)}
        />
      </Field>
    )
  }
  return (
    <Field label={`${attr.name}${attr.isRequired ? ' *' : ''}`}>
      <Input size="sm"
        type={attr.fieldType === 'int' ? 'number' : attr.fieldType === 'date' ? 'date' : 'text'}
        value={(value as string | number | undefined) ?? ''}
        placeholder={attr.defaultValue ?? ''}
        onChange={(e) => {
          const v = e.target.value
          if (attr.fieldType === 'int') onChange(v === '' ? undefined : Number(v))
          else onChange(v || undefined)
        }}
      />
    </Field>
  )
}
