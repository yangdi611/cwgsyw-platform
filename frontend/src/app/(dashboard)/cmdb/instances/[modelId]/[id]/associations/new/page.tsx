'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Search, Check, ChevronRight, Link2, ArrowRight } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { cn } from '@/lib/utils'

interface CiInstanceSummary { name: string; model_id: string }
interface CiAssociationDefVO {
  def_id: string
  kind_id: string
  name: string
  src_model_id: string
  dst_model_id: string
  mapping: string
}
interface InstanceSearchVO {
  id: number
  name: string
  model_id: string
  model_name: string
}

const STEPS = ['选择关联定义', '选择目标实例', '确认提交'] as const

export default function NewAssociationPage() {
  const { modelId, id } = useParams<{ modelId: string; id: string }>()
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()

  const [step, setStep] = useState(0) // 0,1,2
  const [selectedDefId, setSelectedDefId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [selectedPeer, setSelectedPeer] = useState<InstanceSearchVO | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_relation', 'create')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: inst } = useQuery<CiInstanceSummary>({
    queryKey: ['cmdb-instance', modelId, id],
    queryFn: () => api.get(`/cmdb/instances/${modelId}/${id}`).then(r => ({
      name: r.data.data.name,
      model_id: r.data.data.model_id,
    })),
  })

  const { data: allDefs = [], isLoading: defsLoading } = useQuery<CiAssociationDefVO[]>({
    queryKey: ['cmdb-assoc-defs'],
    queryFn: () => api.get('/cmdb/meta/association-defs').then(r => r.data.data),
  })

  // 当前模型适用的关联定义
  const applicableDefs = allDefs.filter(
    d => d.src_model_id === modelId || d.dst_model_id === modelId
  )
  const selectedDef = applicableDefs.find(d => d.def_id === selectedDefId)
  // 目标模型：取关联定义中与当前模型相对的另一端
  const targetModelId = selectedDef
    ? (selectedDef.src_model_id === modelId ? selectedDef.dst_model_id : selectedDef.src_model_id)
    : null

  const { data: searchResult, isFetching: searching } = useQuery<{ records: InstanceSearchVO[]; total: number }>({
    queryKey: ['cmdb-rel-search', targetModelId, keyword],
    queryFn: () => api.get('/cmdb/rel/search', {
      params: { modelId: targetModelId, keyword, size: 12 },
    }).then(r => r.data.data),
    enabled: !!targetModelId && step === 1,
  })

  const createMutation = useMutation({
    mutationFn: () => {
      if (!selectedDef || !selectedPeer) throw new Error('请选择关联定义和目标实例')
      // 新版关联 API：当前实例恒为 src
      return api.post(`/cmdb/instances/${id}/relations`, {
        dst_instance_id: selectedPeer.id,
        association_kind: selectedDef.kind_id,
      })
    },
    onSuccess: () => {
      toast.success('关联已建立')
      router.push(`/cmdb/instances/${modelId}/${id}/associations`)
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message ?? '创建失败')
    },
  })

  const resetPeer = () => { setSelectedPeer(null); setKeyword(''); setError('') }

  return (
    <div className="max-w-2xl">
      {/* 顶部 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/cmdb/instances/${modelId}/${id}/associations`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回关联管理
        </Link>
        <div>
          <h1 className="text-2xl font-bold">新建关联</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            为 {inst?.name ?? `#${id}`} 创建新的关联关系
          </p>
        </div>
      </div>

      {/* 步骤指示器 */}
      <div className="flex items-center mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border transition-colors',
                i < step ? 'bg-primary text-primary-foreground border-primary'
                  : i === step ? 'border-primary text-primary'
                    : 'border-muted text-muted-foreground'
              )}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn(
                'text-sm whitespace-nowrap',
                i === step ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-px flex-1 mx-3', i < step ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* 步骤内容 */}
      <div className="border rounded-lg p-5 min-h-[280px]">
        {/* Step 1: 选择关联定义 */}
        {step === 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="h-4 w-4 text-primary" />
              <Label className="text-sm">选择关联定义</Label>
              <span className="text-xs text-muted-foreground">（仅显示当前模型适用的定义）</span>
            </div>
            {defsLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : applicableDefs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                当前模型暂无可用的关联定义。请先在配置管理中定义关联。
              </p>
            ) : (
              <div className="space-y-2">
                {applicableDefs.map(d => {
                  const isSelected = selectedDefId === d.def_id
                  const isSrc = d.src_model_id === modelId
                  const targetModel = isSrc ? d.dst_model_id : d.src_model_id
                  return (
                    <button
                      key={d.def_id}
                      onClick={() => { setSelectedDefId(d.def_id); resetPeer() }}
                      className={cn(
                        'w-full text-left p-3 rounded-md border transition-colors',
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Check className={cn('h-4 w-4', isSelected ? 'text-primary' : 'opacity-0')} />
                          <span className="font-medium text-sm">{d.name}</span>
                          <Badge variant="outline" className="text-xs">{d.kind_id}</Badge>
                        </div>
                        <Badge variant="secondary" className="text-xs">{d.mapping}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1.5 ml-6 flex items-center gap-1">
                        <span>{isSrc ? modelId : targetModel}</span>
                        <ArrowRight className="h-3 w-3" />
                        <span>{isSrc ? targetModel : modelId}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: 搜索目标实例 */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-4 w-4 text-primary" />
              <Label className="text-sm">
                选择目标实例
                {targetModelId && (
                  <span className="text-muted-foreground ml-1.5 font-normal">（模型：{targetModelId}）</span>
                )}
              </Label>
            </div>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="搜索实例名称..."
                value={keyword}
                onChange={e => { setKeyword(e.target.value); setSelectedPeer(null) }}
                autoFocus
              />
            </div>
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {searching ? (
                <p className="text-center text-muted-foreground text-sm py-6">搜索中...</p>
              ) : (searchResult?.records ?? []).length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-6">
                  {keyword ? '无匹配实例' : '请输入关键词搜索'}
                </p>
              ) : (
                (searchResult?.records ?? []).map(rec => {
                  const isSelected = selectedPeer?.id === rec.id
                  return (
                    <button
                      key={rec.id}
                      className={cn(
                        'w-full flex items-center justify-between text-left px-3 py-2.5 text-sm transition-colors',
                        isSelected ? 'bg-primary/10 font-medium' : 'hover:bg-muted/50'
                      )}
                      onClick={() => setSelectedPeer(rec)}
                    >
                      <div className="flex items-center gap-2">
                        <Check className={cn('h-3.5 w-3.5', isSelected ? 'text-primary' : 'opacity-0')} />
                        {rec.name}
                      </div>
                      <Badge variant="secondary" className="text-xs">{rec.model_name}</Badge>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Step 3: 确认提交 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="h-4 w-4 text-primary" />
              <Label className="text-sm">确认关联信息</Label>
            </div>
            <div className="rounded-md border bg-muted/30 p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm items-center">
                <span className="text-muted-foreground">当前实例</span>
                <span className="col-span-2 font-medium">{inst?.name ?? `#${id}`}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm items-center">
                <span className="text-muted-foreground">关联类型</span>
                <span className="col-span-2 flex items-center gap-1.5">
                  <Badge variant="outline">{selectedDef?.kind_id}</Badge>
                  <span>{selectedDef?.name}</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm items-center">
                <span className="text-muted-foreground">目标实例</span>
                <span className="col-span-2 font-medium">
                  {selectedPeer?.name}
                  <span className="text-muted-foreground ml-1.5">({selectedPeer?.model_name})</span>
                </span>
              </div>
              <div className="pt-2 border-t flex items-center justify-center gap-3 text-sm">
                <span className="px-3 py-1.5 rounded bg-card border font-medium">
                  {inst?.name ?? `#${id}`}
                </span>
                <ArrowRight className="h-4 w-4 text-primary" />
                <span className="px-3 py-1.5 rounded bg-card border font-medium">
                  {selectedPeer?.name}
                </span>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              关联方向：当前实例 → 目标实例。提交后可在关联管理页查看。
            </p>
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between mt-4">
        <Button variant="ghost" size="sm"
          onClick={() => step === 0
            ? router.push(`/cmdb/instances/${modelId}/${id}/associations`)
            : (setStep(s => s - 1), setError(''))}>
          {step === 0 ? '取消' : '上一步'}
        </Button>
        {step < 2 ? (
          <Button size="sm" disabled={
            (step === 0 && !selectedDefId) || (step === 1 && !selectedPeer)
          } onClick={() => { setError(''); setStep(s => s + 1) }}>
            下一步 <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? '创建中...' : '建立关联'}
          </Button>
        )}
      </div>
    </div>
  )
}
