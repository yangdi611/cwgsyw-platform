'use client'
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

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
    queryFn: () => value
      ? api.get(`/cmdb/instances/search`, { params: { keyword: String(value), size: 1 } })
          .then(r => {
            const records = r.data.data?.records ?? []
            return records.find((i: CiInstanceOption) => i.id === value) ?? null
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
    onChange(inst.id)
    setKeyword('')
    setOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setKeyword('')
  }

  // Display label for selected value
  const label = selectedInstance
    ? `${selectedInstance.name} (${selectedInstance.modelName})`
    : value ? `实例 #${value}` : null

  return (
    <div ref={containerRef} className="relative">
      {value && !open ? (
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm">
          <span className="flex-1 truncate">{label}</span>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <Input
          placeholder="输入关键词搜索 CMDB 实例..."
          value={keyword}
          onChange={e => { setKeyword(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
        />
      )}
      {open && keyword.length >= 1 && (
        <div className="absolute z-50 w-full mt-1 border rounded-md bg-background shadow-lg max-h-48 overflow-auto">
          {searchResults.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">无匹配结果</p>
          ) : (
            searchResults.map(inst => (
              <button
                key={inst.id}
                type="button"
                onClick={() => handleSelect(inst)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-muted text-left"
              >
                <span>{inst.name}</span>
                <Badge variant="outline" className="text-xs ml-2">{inst.modelName}</Badge>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
