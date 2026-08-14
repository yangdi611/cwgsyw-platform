'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  listInstances,
  listModelGroups,
  listModels,
  resolveCiScope,
  type CiScopeResolution,
  type CiScopeSelection,
} from '@/lib/task-plan-api'
import {
  Button,
  Card,
  Checkbox,
  Chip,
  SearchInput,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

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
    <div className="cwgsyw-form">
      <div className="cwgsyw-split">
        <section className="cwgsyw-split__pane">
          <div className="cwgsyw-split__pane-head">
            <p className="cwgsyw-type-label-xs">模型组</p>
          </div>
          <div className="cwgsyw-split__pane-body cwgsyw-stack-list">
            {groups.data?.map((group) => (
              <div key={group.code} className="cwgsyw-inline-controls">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={groupCode === group.code}
                  onClick={() => { setGroupCode(group.code); setModelCode(undefined) }}
                >
                  {group.name} · {group.modelCount}
                </Button>
                <Checkbox
                  aria-label={`选择模型组 ${group.name}`}
                  checked={selected.has(`model_group:${group.code}`)}
                  showLabel={false}
                  label={`选择模型组 ${group.name}`}
                  onChange={() => toggle({ level: 'model_group', key: group.code, label: group.name })}
                />
              </div>
            ))}
          </div>
        </section>
        <section className="cwgsyw-split__pane">
          <div className="cwgsyw-split__pane-head">
            <p className="cwgsyw-type-label-xs">模型</p>
          </div>
          <div className="cwgsyw-split__pane-body cwgsyw-stack-list">
            {!groupCode ? <p className="cwgsyw-stack-list__empty">先选择左侧模型组</p> : models.data?.map((model) => (
              <div key={model.modelId} className="cwgsyw-inline-controls">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={modelCode === model.modelId}
                  onClick={() => setModelCode(model.modelId)}
                >
                  {model.displayName || model.name} · {model.instanceCount ?? 0}
                </Button>
                <Checkbox
                  aria-label={`选择模型 ${model.displayName || model.name}`}
                  checked={selected.has(`model:${model.modelId}`)}
                  showLabel={false}
                  label={`选择模型 ${model.displayName || model.name}`}
                  onChange={() => toggle({ level: 'model', key: model.modelId, label: model.displayName || model.name })}
                />
              </div>
            ))}
          </div>
        </section>
        <section className="cwgsyw-split__pane">
          <div className="cwgsyw-split__pane-head">
            <p className="cwgsyw-type-label-xs">CI 实例</p>
          </div>
          <div className="cwgsyw-split__pane-body cwgsyw-form">
            {modelCode ? (
              <SearchInput value={keyword} placeholder="搜索实例" onChange={(event) => setKeyword(event.target.value)} />
            ) : null}
            {!modelCode ? (
              <p className="cwgsyw-stack-list__empty">先选择中间模型</p>
            ) : (
              <div className="cwgsyw-stack-list">
                {instances.data?.map((instance) => (
                  <Checkbox
                    key={instance.id}
                    checked={selected.has(`instance:${instance.id}`)}
                    label={instance.name}
                    onChange={() => toggle({ level: 'instance', key: String(instance.id), label: instance.name })}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {value.length > 0 ? (
        <Card title="已选范围">
          <div className="cwgsyw-inline-controls">
            {value.map((selection) => (
              <Chip
                key={selectionKey(selection)}
                label={selection.label || selection.key}
                showRemove
                onRemove={() => toggle(selection)}
              />
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>清空</Button>
          </div>
          {preview.data ? (
            <div className="cwgsyw-inline-controls">
              <StatusBadge label={`命中 ${preview.data.total} 个 CI`} status="success" />
              {preview.data.truncated ? <StatusBadge label="仅预览前 20 个" status="warning" /> : null}
              {preview.data.warnings.map((warning) => <span key={warning} className="cwgsyw-type-label-xs">{warning}</span>)}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
