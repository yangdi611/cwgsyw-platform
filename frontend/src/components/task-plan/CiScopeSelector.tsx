'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Database, Layers3, Search, Server, X } from 'lucide-react'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { StatusBadge } from '@/components/v2/StatusBadge'
import {
  listInstances,
  listModelGroups,
  listModels,
  resolveCiScope,
  type CiScopeResolution,
  type CiScopeSelection,
} from '@/lib/task-plan-api'

interface CiScopeSelectorProps {
  value: CiScopeSelection[]
  onChange: (value: CiScopeSelection[]) => void
}

function selectionKey(selection: CiScopeSelection) {
  return `${selection.level}:${selection.key}`
}

export function CiScopeSelector({ value, onChange }: CiScopeSelectorProps) {
  const [groupCode, setGroupCode] = useState<string>()
  const [modelCode, setModelCode] = useState<string>()
  const [keyword, setKeyword] = useState('')
  const groups = useQuery({ queryKey: ['task-plan-ci-groups'], queryFn: listModelGroups })
  const models = useQuery({ queryKey: ['task-plan-ci-models', groupCode], queryFn: () => listModels(groupCode), enabled: !!groupCode })
  const instances = useQuery({
    queryKey: ['task-plan-ci-instances', modelCode, keyword],
    queryFn: () => listInstances(modelCode!, keyword || undefined),
    enabled: !!modelCode,
  })
  const preview = useQuery<CiScopeResolution>({
    queryKey: ['task-plan-ci-preview', value],
    queryFn: () => resolveCiScope(value, { status: ['active'] }, 20),
    enabled: value.length > 0,
  })
  const selected = useMemo(() => new Set(value.map(selectionKey)), [value])

  const toggle = (selection: CiScopeSelection) => {
    const key = selectionKey(selection)
    onChange(selected.has(key) ? value.filter((item) => selectionKey(item) !== key) : [...value, selection])
  }

  return (
    <div className="space-y-3">
      <div className="grid min-h-64 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface lg:grid-cols-3">
        <div className="border-b border-v2-border p-3 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-v2-muted">模型组</p>
          <div className="space-y-1">
            {groups.data?.map((group) => (
              <div key={group.code} className={`flex items-center gap-2 rounded-v2-md px-2 py-1.5 ${groupCode === group.code ? 'bg-v2-primary-soft' : 'hover:bg-v2-surface-hover'}`}>
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => { setGroupCode(group.code); setModelCode(undefined) }}>
                  <Layers3 className="h-4 w-4 text-v2-muted" />
                  <span className="truncate text-sm text-v2-fg">{group.name}</span>
                  <span className="ml-auto text-xs text-v2-muted">{group.modelCount}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-v2-muted" />
                </button>
                <input aria-label={`选择模型组 ${group.name}`} type="checkbox" checked={selected.has(`model_group:${group.code}`)} onChange={() => toggle({ level: 'model_group', key: group.code, label: group.name })} />
              </div>
            ))}
          </div>
        </div>
        <div className="border-b border-v2-border p-3 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-v2-muted">模型</p>
          {!groupCode ? <p className="py-8 text-center text-sm text-v2-muted">先选择左侧模型组</p> : (
            <div className="space-y-1">
              {models.data?.map((model) => (
                <div key={model.modelId} className={`flex items-center gap-2 rounded-v2-md px-2 py-1.5 ${modelCode === model.modelId ? 'bg-v2-primary-soft' : 'hover:bg-v2-surface-hover'}`}>
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setModelCode(model.modelId)}>
                    <Database className="h-4 w-4 text-v2-muted" />
                    <span className="truncate text-sm text-v2-fg">{model.displayName || model.name}</span>
                    <span className="ml-auto text-xs text-v2-muted">{model.instanceCount ?? 0}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-v2-muted" />
                  </button>
                  <input aria-label={`选择模型 ${model.displayName || model.name}`} type="checkbox" checked={selected.has(`model:${model.modelId}`)} onChange={() => toggle({ level: 'model', key: model.modelId, label: model.displayName || model.name })} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-v2-muted">CI 实例</p>
          {modelCode && <div className="relative mb-2"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-v2-muted" /><Input className="pl-8" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索实例" /></div>}
          {!modelCode ? <p className="py-8 text-center text-sm text-v2-muted">先选择中间模型</p> : (
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {instances.data?.map((instance) => (
                <label key={instance.id} className="flex cursor-pointer items-center gap-2 rounded-v2-md px-2 py-1.5 hover:bg-v2-surface-hover">
                  <Server className="h-4 w-4 text-v2-muted" />
                  <span className="min-w-0 flex-1 truncate text-sm text-v2-fg">{instance.name}</span>
                  <input type="checkbox" checked={selected.has(`instance:${instance.id}`)} onChange={() => toggle({ level: 'instance', key: String(instance.id), label: instance.name })} />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {value.length > 0 && (
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {value.map((selection) => (
              <span key={selectionKey(selection)} className="inline-flex items-center gap-1 rounded-v2-md border border-v2-border bg-v2-surface-soft px-2 py-1 text-xs text-v2-fg">
                {selection.label || selection.key}
                <button type="button" aria-label="移除选择" onClick={() => toggle(selection)}><X className="h-3 w-3" /></button>
              </span>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>清空</Button>
          </div>
          {preview.data && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-v2-muted"><StatusBadge status="ok">命中 {preview.data.total} 个 CI</StatusBadge>{preview.data.truncated && <StatusBadge status="warn">仅预览前 20 个</StatusBadge>}{preview.data.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>}
        </Card>
      )}
    </div>
  )
}
