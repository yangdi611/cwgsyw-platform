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
  Checkbox,
  Chip,
  SearchInput,
} from '@/design-system/figma-neutral/components'

interface CiScopeSelectorProps {
  value: CiScopeSelection[]
  onChange: (value: CiScopeSelection[]) => void
}


export function localizeScopeWarning(warning: string, selections: CiScopeSelection[]) {
  const replaced = selections.reduce((text, item) => {
    return item.key ? text.replaceAll(item.key, item.label || item.key) : text
  }, warning)
  return replaced.replaceAll(' CI ', ' 配置项 ').replace(/^CI /, '配置项 ')
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
    <div className="cwgsyw-tasks-cascader-wrap">
      <div className="cwgsyw-tasks-cascader" role="group" aria-label="配置项范围连续选择">
        <section className="cwgsyw-tasks-cascader__col">
          <header>模型组</header>
          <div className="cwgsyw-tasks-cascader__body">
            {groups.data?.map((group) => (
              <div
                key={group.code}
                className="cwgsyw-tasks-cascader__row"
                data-current={groupCode === group.code ? 'true' : undefined}
              >
                <Checkbox
                  className="cwgsyw-tasks-choice"
                  aria-label={`选择模型组 ${group.name}`}
                  checked={selected.has(`model_group:${group.code}`)}
                  showLabel={false}
                  label={`选择模型组 ${group.name}`}
                  onChange={() => toggle({ level: 'model_group', key: group.code, label: group.name })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="cwgsyw-tasks-cascader__open"
                  aria-pressed={groupCode === group.code}
                  onClick={() => { setGroupCode(group.code); setModelCode(undefined); setKeyword('') }}
                >
                  <span>{group.name}</span>
                  <span>{group.modelCount}</span>
                </Button>
              </div>
            ))}
          </div>
        </section>
        <section className="cwgsyw-tasks-cascader__col">
          <header>模型</header>
          <div className="cwgsyw-tasks-cascader__body">
            {!groupCode ? (
              <p className="cwgsyw-tasks-cascader__empty">先选择模型组</p>
            ) : models.data?.map((model) => (
              <div
                key={model.modelId}
                className="cwgsyw-tasks-cascader__row"
                data-current={modelCode === model.modelId ? 'true' : undefined}
              >
                <Checkbox
                  className="cwgsyw-tasks-choice"
                  aria-label={`选择模型 ${model.displayName || model.name}`}
                  checked={selected.has(`model:${model.modelId}`)}
                  showLabel={false}
                  label={`选择模型 ${model.displayName || model.name}`}
                  onChange={() => toggle({ level: 'model', key: model.modelId, label: model.displayName || model.name })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="cwgsyw-tasks-cascader__open"
                  aria-pressed={modelCode === model.modelId}
                  onClick={() => { setModelCode(model.modelId); setKeyword('') }}
                >
                  <span>{model.displayName || model.name}</span>
                  <span>{model.instanceCount ?? 0}</span>
                </Button>
              </div>
            ))}
          </div>
        </section>
        <section className="cwgsyw-tasks-cascader__col">
          <header>配置项</header>
          <div className="cwgsyw-tasks-cascader__body">
            {modelCode ? (
              <SearchInput size="sm" value={keyword} placeholder="搜索配置项..." onChange={(event) => setKeyword(event.target.value)} />
            ) : null}
            {!modelCode ? (
              <p className="cwgsyw-tasks-cascader__empty">先选择模型</p>
            ) : (
              instances.data?.map((instance) => (
                <div key={instance.id} className="cwgsyw-tasks-cascader__row">
                  <Checkbox
                    className="cwgsyw-tasks-choice"
                    checked={selected.has(`instance:${instance.id}`)}
                    label={instance.name}
                    onChange={() => toggle({ level: 'instance', key: String(instance.id), label: instance.name })}
                  />
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {value.length > 0 ? (
        <div className="cwgsyw-tasks-cascader-selected">
          <div className="cwgsyw-tasks-cascader-selected__head">
            <span>已选范围</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>清空</Button>
          </div>
          <div className="cwgsyw-inline-controls">
            {value.map((selection) => (
              <Chip
                key={selectionKey(selection)}
                label={selection.label || selection.key}
                showRemove
                onRemove={() => toggle(selection)}
              />
            ))}
          </div>
          {preview.data ? (
            <div className="cwgsyw-tasks-cascader-selected__meta">
              <p>命中 {preview.data.total} 个配置项{preview.data.truncated ? '，仅预览前 20 个' : ''}</p>
              {preview.data.warnings.map((warning) => (
                <p key={warning}>{localizeScopeWarning(warning, value)}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
