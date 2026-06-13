'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'

export interface CiLinkItem {
  instanceId: number
  instanceName: string
  modelName: string
  impactLevel?: string
}

interface CiLinkSelectorProps {
  value: Array<CiLinkItem>
  onChange: (selected: Array<CiLinkItem>) => void
  disabled?: boolean
}

const IMPACT_OPTIONS = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

export function CiLinkSelector({ value, onChange, disabled }: CiLinkSelectorProps) {
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 300)
    return () => clearTimeout(timer)
  }, [keyword])

  const { data: searchResults = [] } = useQuery({
    queryKey: ['cmdb-instance-search', debouncedKeyword],
    queryFn: () => api.get('/cmdb/instances/search', {
      params: { keyword: debouncedKeyword, size: 10 },
    }).then(r => r.data.data?.records ?? []),
    enabled: debouncedKeyword.length >= 1 && open,
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

  const handleSelect = useCallback((inst: { id: number; name: string; modelName: string }) => {
    // Avoid duplicates
    if (value.some(v => v.instanceId === inst.id)) return
    onChange([...value, {
      instanceId: inst.id,
      instanceName: inst.name,
      modelName: inst.modelName,
      impactLevel: undefined,
    }])
    setKeyword('')
    setDebouncedKeyword('')
    setOpen(false)
  }, [value, onChange])

  const handleRemove = useCallback((instanceId: number) => {
    onChange(value.filter(v => v.instanceId !== instanceId))
  }, [value, onChange])

  const handleImpactChange = useCallback((instanceId: number, impactLevel: string) => {
    onChange(value.map(v =>
      v.instanceId === instanceId ? { ...v, impactLevel } : v
    ))
  }, [value, onChange])

  const selectedIds = new Set(value.map(v => v.instanceId))

  return (
    <div className="space-y-3">
      {/* Search input + dropdown */}
      <div ref={containerRef} className="relative">
        <Input
          placeholder="输入关键词搜索 CI 实例..."
          value={keyword}
          onChange={e => { setKeyword(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
        />
        {open && debouncedKeyword.length >= 1 && (
          <div className="absolute z-50 w-full mt-1 border rounded-md bg-background shadow-lg max-h-48 overflow-auto">
            {searchResults.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">无匹配结果</p>
            ) : (
              (searchResults as { id: number; name: string; modelName: string }[]).map(inst => {
                const alreadySelected = selectedIds.has(inst.id)
                return (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => !alreadySelected && handleSelect(inst)}
                    disabled={alreadySelected || disabled}
                    className={`flex items-center justify-between w-full px-3 py-2 text-sm text-left ${
                      alreadySelected
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-muted cursor-pointer'
                    }`}
                  >
                    <span>{inst.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{inst.modelName}</Badge>
                      {alreadySelected && <span className="text-xs text-muted-foreground">已选</span>}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map(item => (
            <div
              key={item.instanceId}
              className="flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 text-sm bg-muted/30"
            >
              <span>{item.instanceName}</span>
              <Badge variant="outline" className="text-[10px]">{item.modelName}</Badge>
              <Select
                value={item.impactLevel ?? ''}
                onValueChange={v => handleImpactChange(item.instanceId, v ?? '')}
                disabled={disabled}
              >
                <SelectTrigger className="h-6 w-16 text-xs border-0 p-0 pl-1 shadow-none">
                  <SelectValue placeholder="影响" />
                </SelectTrigger>
                <SelectContent>
                  {IMPACT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(item.instanceId)}
                  className="text-muted-foreground hover:text-foreground ml-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
