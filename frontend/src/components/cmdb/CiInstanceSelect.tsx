'use client'
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Badge, Button, Input } from '@/design-system/figma-neutral/components'

interface CiInstanceOption {
  id: number
  name: string
  modelId: string
  modelName: string
}

interface CiInstanceSelectProps {
  value: number | null
  onChange: (id: number | null) => void
  disabled?: boolean
}

export function CiInstanceSelect({ value, onChange, disabled }: CiInstanceSelectProps) {
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<CiInstanceOption | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: searchResults = [] } = useQuery<CiInstanceOption[]>({
    queryKey: ['cmdb-instance-select', keyword],
    queryFn: () => api.get('/cmdb/instances/search', {
      params: { keyword, size: 10 },
    }).then(r => r.data.data?.records ?? []),
    enabled: keyword.length >= 1 && open,
  })

  // Fetch selected instance name when value is set but we don't have label yet
  const { data: selectedInstance } = useQuery<CiInstanceOption | null>({
    queryKey: ['cmdb-instance-selected', value],
    queryFn: () =>
      value
        ? api.get(`/cmdb/instances/${value}`).then((response) => {
            const data = response.data.data
            return {
              id: data.id,
              name: data.name,
              modelId: data.modelId ?? data.model_id,
              modelName: data.modelName ?? data.model_name,
            } as CiInstanceOption
          })
        : Promise.resolve(null),
    enabled: !!value && !keyword,
  })

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (inst: CiInstanceOption) => {
    setPicked(inst)
    onChange(inst.id)
    setKeyword('')
    setOpen(false)
  }

  const handleClear = () => {
    setPicked(null)
    onChange(null)
    setKeyword('')
  }

  // Display label for selected value
  const resolved = picked?.id === value ? picked : selectedInstance
  const label = resolved
    ? `${resolved.name}${resolved.modelName ? ` (${resolved.modelName})` : ''}`
    : value ? `实例 #${value}` : null

  return (
    <div ref={containerRef} className="cwgsyw-select" data-cwgsyw-ci-select="sm">
      {value && !open ? (
        <div className="cwgsyw-control cwgsyw-control--sm">
          <span className="cwgsyw-ci-select__value">{label}</span>
          {!disabled && (
            <Button type="button" size="sm" variant="ghost" onClick={handleClear}>
              清除
            </Button>
          )}
        </div>
      ) : (
        <Input size="sm"
          placeholder="输入关键词搜索 CMDB 实例..."
          value={keyword}
          onChange={e => { setKeyword(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
        />
      )}
      {open && keyword.length >= 1 && (
        <div className="cwgsyw-listbox cwgsyw-listbox--overlay" role="listbox">
          {searchResults.length === 0 ? (
            <p className="cwgsyw-type-label-sm">无匹配结果</p>
          ) : (
            searchResults.map(inst => (
              <Button
                key={inst.id}
                type="button"
                variant="ghost"
                className="cwgsyw-picker-option"
                onClick={() => handleSelect(inst)}
              >
                <span>{inst.name}</span>
                <Badge label={inst.modelName} size="sm" />
              </Button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
