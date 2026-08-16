'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import '@/design-system/figma-neutral/index.css'
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  FormSettingsPage,
  Input,
  LoadingState,
  PageHeader,
  SearchInput,
} from '@/design-system/figma-neutral/components'

interface CiInstanceSummary { name: string; modelId: string; modelCode?: string }

interface CiAssociationDefVO {
  defId: string
  kindId: string
  name: string
  srcModelId: string
  dstModelId: string
  mapping: string
  onDelete: string
}

interface InstanceSearchVO {
  id: number
  name: string
  modelId: string
  modelCode?: string
  modelName: string
}

const STEPS = ['选择关联定义', '选择目标实例', '确认提交'] as const

export default function NewAssociationPage() {
  const { modelCode, id } = useParams<{ modelCode: string; id: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [selectedDefId, setSelectedDefId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selectedPeer, setSelectedPeer] = useState<InstanceSearchVO | null>(null)
  const [error, setError] = useState('')
  const [assocAttrs, setAssocAttrs] = useState<Record<string, string>>({})
  const [attrKey, setAttrKey] = useState('')
  const [attrValue, setAttrValue] = useState('')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_relation', 'create')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: inst } = useQuery<CiInstanceSummary>({
    queryKey: ['cmdb-instance', modelCode, id],
    queryFn: async () => {
      try {
        const r = await api.get(`/cmdb/instances/${id}`)
        return {
          name: r.data.data.name,
          modelId: r.data.data.modelId,
        }
      } catch {
        return {} as CiInstanceSummary
      }
    },
    enabled: typeof window !== 'undefined',
  })

  const { data: applicableDefs = [] } = useQuery<CiAssociationDefVO[]>({
    queryKey: ['cmdb-rel-applicable-defs', id],
    queryFn: () => api.get(`/cmdb/instances/${id}/relations/applicable-defs`).then((r) => r.data.data),
    enabled: typeof window !== 'undefined',
  })

  useBreadcrumbLabel(inst?.name)

  const selectedDef = applicableDefs.find((d) => d.defId === selectedDefId)
  const targetModelId = selectedDef ? selectedDef.dstModelId : null

  const { data: searchResult, isFetching: searching } = useQuery<{ records: InstanceSearchVO[]; total: number }>({
    queryKey: ['cmdb-rel-search', targetModelId, keyword],
    queryFn: () => api.get('/cmdb/instances/search', {
      params: { modelId: targetModelId, keyword, size: 12 },
    }).then((r) => r.data.data),
    enabled: !!targetModelId && step === 1,
  })

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedDef || !selectedPeer) throw new Error('请选择关联定义和目标实例')
      return api.post(`/cmdb/instances/${id}/relations`, {
        defId: selectedDef.defId,
        dstInstanceId: selectedPeer.id,
        metadata: assocAttrs,
      })
    },
    onSuccess: () => {
      toast.success('关联已建立')
      router.push(`/cmdb/instances/by-model/${modelCode}/${id}/associations`)
    },
    onError: (e: unknown) => {
      setError(getApiErrorMessage(e, '创建失败'))
    },
  })

  const resetPeer = () => { setSelectedPeer(null); setKeyword(''); setError('') }

  return (
    <FormSettingsPage className="cwgsyw-cmdb-page"
      header={
        <div className="cwgsyw-cmdb-instance-page">
        <PageHeader
          showEyebrow={false}
          title="新建关联"
          subtitle={`为 ${inst?.name ?? `#${id}`} 建立关联`}
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/cmdb', label: 'CMDB' },
                { href: `/cmdb/instances/by-model/${modelCode}/${id}`, label: inst?.name ?? `#${id}` },
                { href: `/cmdb/instances/by-model/${modelCode}/${id}/associations`, label: '关联管理' },
                { label: '新建关联' },
              ]}
            />
          }
        />
        </div>
      }
      form={
        <div className="cwgsyw-form">
          <div className="cwgsyw-cmdb-wizard-steps" role="list">
            {STEPS.map((label, i) => (
              <Chip key={label} label={`${i + 1} ${label}`} selected={i === step} />
            ))}
          </div>

            {step === 0 && (
              applicableDefs.length === 0 ? (
                <EmptyState
                  title="暂无可用关联定义"
                  description={`当前模型暂无可作为源端的关联定义。请先在配置管理中定义关联（src 端 = ${modelCode}）。`}
                />
              ) : (
                <div className="cwgsyw-cmdb-choice-list">
                  {applicableDefs.map((d) => (
                    <Card
                      key={d.defId}
                      title={d.name ?? d.defId}
                      description={`${d.srcModelId} → ${d.dstModelId} · ${d.kindId} ${d.mapping}`}
                      variant={selectedDefId === d.defId ? 'selected' : 'interactive'}
                      onClick={() => { setSelectedDefId(d.defId); resetPeer() }}
                    />
                  ))}
                </div>
              )
            )}

            {step === 1 && (
              <div className="cwgsyw-form">
                <Field label={`目标实例${targetModelId ? ` · ${targetModelId}` : ''}`}>
                  <SearchInput
                    size="sm"
                    value={keyword}
                    placeholder="搜索实例名称..."
                    onChange={(event) => { setKeyword(event.target.value); setSelectedPeer(null) }}
                  />
                </Field>
                {searching ? (
                  <LoadingState label="搜索实例" />
                ) : (searchResult?.records ?? []).length === 0 ? (
                  <EmptyState title={keyword ? '无匹配实例' : '请输入关键词搜索'} />
                ) : (
                  <div className="cwgsyw-cmdb-choice-list">
                    {(searchResult?.records ?? []).map((rec) => (
                      <Card
                        key={rec.id}
                        title={rec.name}
                        description={rec.modelName}
                        variant={selectedPeer?.id === rec.id ? 'selected' : 'interactive'}
                        onClick={() => setSelectedPeer(rec)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="cwgsyw-form">
                <dl className="cwgsyw-cmdb-confirm">
                  <div>
                    <dt>当前实例</dt>
                    <dd>{inst?.name ?? `#${id}`}</dd>
                  </div>
                  <div>
                    <dt>关联定义</dt>
                    <dd>{selectedDef?.name ?? selectedDef?.defId} · {selectedDef?.kindId} {selectedDef?.mapping}</dd>
                  </div>
                  <div>
                    <dt>目标实例</dt>
                    <dd>{selectedPeer?.name} · {selectedPeer?.modelName}</dd>
                  </div>
                  <div>
                    <dt>方向</dt>
                    <dd>{inst?.name ?? `#${id}`} → {selectedPeer?.name}</dd>
                  </div>
                </dl>
                <Field label="关联属性">
                  <div className="cwgsyw-inline-controls">
                    <Input size="sm" placeholder="属性名" value={attrKey} onChange={(e) => setAttrKey(e.target.value)} />
                    <Input size="sm" placeholder="属性值" value={attrValue} onChange={(e) => setAttrValue(e.target.value)} />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (!attrKey.trim()) return
                        setAssocAttrs((a) => ({ ...a, [attrKey.trim()]: attrValue }))
                        setAttrKey('')
                        setAttrValue('')
                      }}
                    >
                      添加
                    </Button>
                  </div>
                </Field>
                {Object.keys(assocAttrs).length > 0 ? (
                  <div className="cwgsyw-inline-controls">
                    {Object.entries(assocAttrs).map(([k, v]) => (
                      <Chip
                        key={k}
                        label={`${k}: ${v}`}
                        showRemove
                        onRemove={() => setAssocAttrs((a) => {
                          const next = { ...a }
                          delete next[k]
                          return next
                        })}
                      />
                    ))}
                  </div>
                ) : null}
                {error ? <Alert tone="danger" title="创建失败" description={error} showDismiss={false} /> : null}
              </div>
            )}

          <div className="cwgsyw-inline-controls">
            <Button
              type="button"
              variant="ghost"
              onClick={() => step === 0
                ? router.push(`/cmdb/instances/by-model/${modelCode}/${id}/associations`)
                : (setStep((s) => s - 1), setError(''))}
            >
              {step === 0 ? '取消' : '上一步'}
            </Button>
            {step < 2 ? (
              <Button
                type="button"
                disabled={(step === 0 && !selectedDefId) || (step === 1 && !selectedPeer)}
                onClick={() => { setError(''); setStep((s) => s + 1) }}
              >
                下一步
              </Button>
            ) : (
              <Button type="button" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? '创建中…' : '建立关联'}
              </Button>
            )}
          </div>
        </div>
      }
    />
  )
}
