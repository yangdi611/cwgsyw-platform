'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Search } from 'lucide-react'
import api from '@/lib/api'
import type { CiSnapshot } from './types'

interface CiSelectorModalProps {
  open: boolean
  selectedCis: CiSnapshot[]
  onClose: () => void
  onToggle: (ci: CiSnapshot) => void
}

interface CiInstanceVO {
  id: number
  name: string
  modelName: string
  modelId: number
}

export function CiSelectorModal({ open, selectedCis, onClose, onToggle }: CiSelectorModalProps) {
  const [ciSearchKeyword, setCiSearchKeyword] = useState('')

  const { data: ciSearchResult } = useQuery<{ records: CiInstanceVO[]; total: number }>({
    queryKey: ['ci-search-for-change-doc', ciSearchKeyword],
    queryFn: () =>
      api
        .get('/cmdb/instances/search', {
          params: { keyword: ciSearchKeyword, page: 1, size: 20 },
        })
        .then((r) => r.data.data),
    enabled: open && ciSearchKeyword.length >= 2,
  })

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-v2-md border border-v2-border bg-v2-surface p-4 shadow-v2-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-v2-fg">选择关联 CI</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            关闭
          </Button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-v2-muted" />
          <Input
            className="pl-8"
            placeholder="搜索 CI 名称…（至少2个字符）"
            value={ciSearchKeyword}
            onChange={(e) => setCiSearchKeyword(e.target.value)}
          />
        </div>

        <div className="max-h-96 space-y-1 overflow-y-auto">
          {!ciSearchKeyword && (
            <p className="py-8 text-center text-sm text-v2-muted">请输入关键词搜索 CI</p>
          )}
          {ciSearchKeyword.length > 0 && ciSearchKeyword.length < 2 && (
            <p className="py-8 text-center text-sm text-v2-muted">
              请至少输入 2 个字符开始搜索
            </p>
          )}
          {ciSearchResult?.records?.map((ci) => {
            const selected = selectedCis.some((s) => s.instanceId === ci.id)
            return (
              <button
                key={ci.id}
                type="button"
                onClick={() =>
                  onToggle({
                    instanceId: ci.id,
                    instanceName: ci.name,
                    modelName: ci.modelName,
                    modelId: ci.modelId,
                  })
                }
                className={
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ' +
                  (selected
                    ? 'bg-v2-primary-soft text-v2-primary'
                    : 'hover:bg-v2-surface-hover')
                }
              >
                <span className="font-medium">{ci.name}</span>
                <span className="text-xs text-v2-muted">{ci.modelName}</span>
              </button>
            )
          })}
          {ciSearchResult?.records?.length === 0 && (
            <p className="py-4 text-center text-sm text-v2-muted">未匹配到 CI</p>
          )}
        </div>
      </div>
    </div>
  )
}
