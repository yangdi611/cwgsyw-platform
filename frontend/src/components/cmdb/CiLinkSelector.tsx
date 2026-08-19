'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Badge, Button, Input, Select } from '@/design-system/figma-neutral/components'

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

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

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
    <div className="cwgsyw-change-doc-ci-flow">
      <MotionConfig reducedMotion="user">
      <motion.div
        ref={containerRef}
        layout="size"
        className="cwgsyw-change-doc-ci-flow__search"
        data-open={open && debouncedKeyword.length >= 1 ? 'true' : undefined}
        transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.8 }}
      >
        <Input size="sm"
          aria-label="搜索 CI 实例"
          placeholder="输入关键词搜索 CI 实例..."
          value={keyword}
          onChange={e => { setKeyword(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
        />
        <AnimatePresence initial={false}>
          {open && debouncedKeyword.length >= 1 ? (
            <motion.div
              key="ci-results"
              role="listbox"
              aria-label="CI 实例搜索结果"
              className="cwgsyw-listbox cwgsyw-change-doc-ci-flow__list"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            >
              {searchResults.length === 0 ? (
                <p className="cwgsyw-type-label-sm">无匹配结果</p>
              ) : (
                (searchResults as { id: number; name: string; modelName: string }[]).map(inst => {
                  const alreadySelected = selectedIds.has(inst.id)
                  return (
                    <Button
                      key={inst.id}
                      type="button"
                      variant="ghost"
                      className="cwgsyw-picker-option"
                      disabled={alreadySelected || disabled}
                      onClick={() => !alreadySelected && handleSelect(inst)}
                    >
                      <span>{inst.name}</span>
                      <span className="cwgsyw-inline-controls">
                        <Badge label={inst.modelName} size="sm" />
                        {alreadySelected ? <span className="cwgsyw-type-label-xs">已选</span> : null}
                      </span>
                    </Button>
                  )
                })
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
      </MotionConfig>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="cwgsyw-change-doc-ci-flow__selected">
          {value.map(item => (
            <div
              key={item.instanceId}
              className="cwgsyw-chip cwgsyw-chip--md cwgsyw-inline-controls"
            >
              <span>{item.instanceName}</span>
              <Badge label={item.modelName} />
              <Select size="sm" overlay
                value={item.impactLevel ?? ''}
                disabled={disabled}
                options={IMPACT_OPTIONS}
                onChange={(v) => handleImpactChange(item.instanceId, v)}
              />
              {!disabled && (
                <Button type="button" size="sm" variant="ghost" onClick={() => handleRemove(item.instanceId)}>
                  移除
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
