'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

export interface CiInstanceItem {
  id: number
  name: string
  modelName: string
}

interface CiInstanceMultiSelectProps {
  value: CiInstanceItem[]
  onChange: (selected: CiInstanceItem[]) => void
  disabled?: boolean
}

export function CiInstanceMultiSelect({ value, onChange, disabled }: CiInstanceMultiSelectProps) {
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
    if (value.some(v => v.id === inst.id)) return
    onChange([...value, { id: inst.id, name: inst.name, modelName: inst.modelName }])
    setKeyword('')
    setDebouncedKeyword('')
    setOpen(false)
  }, [value, onChange])

  const handleRemove = useCallback((id: number) => {
    onChange(value.filter(v => v.id !== id))
  }, [value, onChange])

  const selectedIds = new Set(value.map(v => v.id))

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
              key={item.id}
              className="flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 text-sm bg-muted/30"
            >
              <span>{item.name}</span>
              <Badge variant="outline" className="text-[10px]">{item.modelName}</Badge>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
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
