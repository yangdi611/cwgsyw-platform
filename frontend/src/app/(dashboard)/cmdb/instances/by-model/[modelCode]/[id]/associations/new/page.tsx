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
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
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
  const [attrError, setAttrError] = useState('')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_relation', 'create')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const {
    data: inst,
    isLoading: isInstanceLoading,
    isError: isInstanceError,
    refetch: refetchInstance,
  } = useQuery<CiInstanceSummary>({
    queryKey: ['cmdb-instance', modelCode, id],
    queryFn: () => api.get(`/cmdb/instances/${id}`).then((r) => ({
      name: r.data.data.name,
      modelId: r.data.data.modelId,
    })),
    enabled: typeof window !== 'undefined',
  })

  const {
    data: applicableDefs = [],
    isLoading: isDefsLoading,
    isError: isDefsError,
    refetch: refetchDefs,
  } = useQuery<CiAssociationDefVO[]>({
    queryKey: ['cmdb-rel-applicable-defs', id],
    queryFn: () => api.get(`/cmdb/instances/${id}/relations/applicable-defs`).then((r) => r.data.data),
    enabled: typeof window !== 'undefined',
  })

  useBreadcrumbLabel(inst?.name)

  const selectedDef = applicableDefs.find((d) => d.defId === selectedDefId)
  const targetModelId = selectedDef ? selectedDef.dstModelId : null

  const {
    data: searchResult,
    isFetching: searching,
    isError: isSearchError,
    refetch: refetchSearch,
  } = useQuery<{ records: InstanceSearchVO[]; total: number }>({
    queryKey: ['cmdb-rel-search', targetModelId, keyword],
    queryFn: () => api.get('/cmdb/instances/search', {
      params: { modelId: targetModelId, keyword, size: 12 },
    }).then((r) => r.data.data),
    enabled: !!targetModelId && step === 1 && !!keyword.trim(),
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
    <FormSettingsPage className="cwgsyw-cmdb-page cwgsyw-cmdb-association-create"
      header={
        <div className="cwgsyw-cmdb-instance-page">
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title="新建关联"
          subtitle={`为 ${inst?.name ?? `#${id}`} 建立关联`}
        />
        </div>
      }
      form={
        <div className="cwgsyw-cmdb-association-create__form">
          <ol className="cwgsyw-cmdb-wizard-steps" aria-label="新建关联步骤">
            {STEPS.map((label, i) => (
              <li
                key={label}
                data-state={i < step ? 'complete' : i === step ? 'current' : 'upcoming'}
                aria-current={i === step ? 'step' : undefined}
              >
                <span className="cwgsyw-cmdb-wizard-steps__index" aria-hidden="true">{i + 1}</span>
                <span className="cwgsyw-cmdb-wizard-steps__label">{label}</span>
              </li>
            ))}
          </ol>

          <div className="cwgsyw-cmdb-association-create__content">
            <header className="cwgsyw-cmdb-association-create__step-header">
              <span>步骤 {step + 1} / {STEPS.length}</span>
              <h2>{STEPS[step]}</h2>
              <p>{step === 0
                ? '选择当前实例需要建立的关系类型。'
                : step === 1
                  ? '搜索并选择一个符合关联定义的目标实例。'
                  : '核对关联方向和属性，确认后建立关联。'}</p>
            </header>
            {isInstanceLoading || isDefsLoading ? (
              <LoadingState label="加载关联配置" />
            ) : isInstanceError || isDefsError ? (
              <ErrorState
                title="关联配置加载失败"
                description="无法读取当前实例或可用关联定义，请稍后重试。"
                retry={
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void refetchInstance()
                      void refetchDefs()
                    }}
                  >
                    重试
                  </Button>
                }
              />
            ) : step === 0 ? (
              applicableDefs.length === 0 ? (
                <div className="cwgsyw-cmdb-association-create__empty">
                  <span
                    className="cwgsyw-cmdb-association-create__empty-icon cwgsyw-cmdb-association-create__empty-icon--link"
                    aria-hidden="true"
                  />
                  <EmptyState
                    showIcon={false}
                    title="暂无可用关联定义"
                    description={`当前模型暂无可作为源端的关联定义。请先在配置管理中定义关联（src 端 = ${modelCode}）。`}
                  />
                </div>
              ) : (
                <div className="cwgsyw-cmdb-choice-list">
                  {applicableDefs.map((d) => (
                    <div key={d.defId} className="cwgsyw-cmdb-association-create__choice-shell">
                      <Card
                        showHeader={false}
                        padding="sm"
                        variant={selectedDefId === d.defId ? 'selected' : 'interactive'}
                        onClick={() => { setSelectedDefId(d.defId); resetPeer() }}
                      >
                        <span className="cwgsyw-cmdb-association-create__choice">
                          <span className="cwgsyw-cmdb-association-create__choice-icon" aria-hidden="true" />
                          <span className="cwgsyw-cmdb-association-create__choice-body">
                            <span className="cwgsyw-cmdb-association-create__choice-title">{d.name ?? d.defId}</span>
                            <span className="cwgsyw-cmdb-association-create__choice-models">
                              <span>源 {d.srcModelId}</span>
                              <span className="cwgsyw-cmdb-association-create__choice-model-link" aria-hidden="true" />
                              <span>目标 {d.dstModelId}</span>
                            </span>
                            <span className="cwgsyw-cmdb-association-create__choice-meta">{d.kindId} · {d.mapping}</span>
                          </span>
                          <span className="cwgsyw-cmdb-association-create__choice-indicator" aria-hidden="true" />
                        </span>
                      </Card>
                    </div>
                  ))}
                </div>
              )
            ) : step === 1 ? (
              <div className="cwgsyw-cmdb-association-create__search-step">
                <Field label={`目标实例${targetModelId ? ` · ${targetModelId}` : ''}`}>
                  <SearchInput
                    size="sm"
                    value={keyword}
                    placeholder="搜索实例名称..."
                    onChange={(event) => {
                      setKeyword(event.target.value)
                      setSelectedPeer(null)
                    }}
                  />
                </Field>
                {searching ? (
                  <LoadingState label="搜索实例" />
                ) : isSearchError ? (
                  <ErrorState
                    title="目标实例搜索失败"
                    description="无法读取候选实例，请稍后重试。"
                    retry={<Button type="button" size="sm" variant="secondary" onClick={() => refetchSearch()}>重试</Button>}
                  />
                ) : !keyword.trim() ? (
                  <div className="cwgsyw-cmdb-association-create__empty">
                    <span
                      className="cwgsyw-cmdb-association-create__empty-icon cwgsyw-cmdb-association-create__empty-icon--search"
                      aria-hidden="true"
                    />
                    <EmptyState
                      showIcon={false}
                      title="请输入关键词搜索"
                      description="输入目标实例名称，选择一个实例后继续。"
                    />
                  </div>
                ) : (searchResult?.records ?? []).length === 0 ? (
                  <div className="cwgsyw-cmdb-association-create__empty">
                    <span
                      className="cwgsyw-cmdb-association-create__empty-icon cwgsyw-cmdb-association-create__empty-icon--package-search"
                      aria-hidden="true"
                    />
                    <EmptyState showIcon={false} title="无匹配实例" description="请尝试其他实例名称。" />
                  </div>
                ) : (
                  <div className="cwgsyw-cmdb-choice-list">
                    {(searchResult?.records ?? []).map((rec) => (
                      <div key={rec.id} className="cwgsyw-cmdb-association-create__choice-shell">
                        <Card
                          showHeader={false}
                          padding="sm"
                          variant={selectedPeer?.id === rec.id ? 'selected' : 'interactive'}
                          onClick={() => setSelectedPeer(rec)}
                        >
                          <span className="cwgsyw-cmdb-association-create__choice">
                            <span className="cwgsyw-cmdb-association-create__peer-mark" aria-hidden="true">
                              {rec.name.trim().slice(0, 1).toUpperCase() || '#'}
                            </span>
                            <span className="cwgsyw-cmdb-association-create__choice-body">
                              <span className="cwgsyw-cmdb-association-create__choice-title">{rec.name}</span>
                              <span className="cwgsyw-cmdb-association-create__choice-meta">{rec.modelName}</span>
                            </span>
                            <span className="cwgsyw-cmdb-association-create__choice-indicator" aria-hidden="true" />
                          </span>
                        </Card>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="cwgsyw-cmdb-association-create__confirm-step">
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
                    <dd>{selectedPeer?.modelName ? `${selectedPeer.name} · ${selectedPeer.modelName}` : selectedPeer?.name}</dd>
                  </div>
                  <div>
                    <dt>方向</dt>
                    <dd>源实例 {inst?.name ?? `#${id}`} · 目标实例 {selectedPeer?.name}</dd>
                  </div>
                </dl>
                <fieldset className="cwgsyw-cmdb-association-create__attribute-fieldset">
                  <legend>关联属性</legend>
                  <div className="cwgsyw-cmdb-association-create__attribute-row">
                    <Input
                      size="sm"
                      aria-label="关联属性名"
                      placeholder="属性名"
                      value={attrKey}
                      onChange={(e) => {
                        setAttrKey(e.target.value)
                        setAttrError('')
                      }}
                    />
                    <Input size="sm" aria-label="关联属性值" placeholder="属性值" value={attrValue} onChange={(e) => setAttrValue(e.target.value)} />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (!attrKey.trim()) {
                          setAttrError('请输入属性名')
                          return
                        }
                        setAssocAttrs((a) => ({ ...a, [attrKey.trim()]: attrValue }))
                        setAttrKey('')
                        setAttrValue('')
                        setAttrError('')
                      }}
                    >
                      添加
                    </Button>
                  </div>
                  <p className="cwgsyw-cmdb-association-create__attribute-helper">可选；同名属性再次添加时会覆盖原值。</p>
                  {attrError ? <p className="cwgsyw-cmdb-association-create__attribute-error" role="alert">{attrError}</p> : null}
                </fieldset>
                {Object.keys(assocAttrs).length > 0 ? (
                  <div className="cwgsyw-cmdb-association-create__attributes" aria-label="已添加关联属性">
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
          </div>

          <div className="cwgsyw-inline-controls cwgsyw-cmdb-association-create__actions">
            <Button
              type="button"
              size="sm"
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
                size="sm"
                disabled={(step === 0 && !selectedDefId) || (step === 1 && !selectedPeer)}
                onClick={() => { setError(''); setStep((s) => s + 1) }}
              >
                下一步
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? '创建中…' : '建立关联'}
              </Button>
            )}
          </div>
        </div>
      }
    />
  )
}
