'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { CiSnapshot } from './types'
import '@/design-system/figma-neutral/index.css'
import { Button, NeutralDialog, SearchInput } from '@/design-system/figma-neutral/components'

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
      api.get('/cmdb/instances/search', {
        params: { keyword: ciSearchKeyword, page: 1, size: 20 },
      }).then((response) => response.data.data),
    enabled: open && ciSearchKeyword.length >= 2,
  })

  return (
    <NeutralDialog
      open={open}
      onOpenChange={(next) => { if (!next) onClose() }}
      title="选择关联 CI"
      description="搜索 CI 名称，至少输入 2 个字符。"
      size="lg"
      footer={<Button type="button" variant="secondary" onClick={onClose}>关闭</Button>}
    >
      <div className="cwgsyw-form">
        <SearchInput
          aria-label="搜索 CI 名称"
          value={ciSearchKeyword}
          placeholder="搜索 CI 名称…（至少2个字符）"
          onChange={(event) => setCiSearchKeyword(event.target.value)}
          onClear={() => setCiSearchKeyword('')}
        />
        {!ciSearchKeyword ? <p>请输入关键词搜索 CI</p> : null}
        {ciSearchKeyword.length > 0 && ciSearchKeyword.length < 2 ? <p>请至少输入 2 个字符开始搜索</p> : null}
        <div className="cwgsyw-change-doc-ci-selector__results">
          {ciSearchResult?.records?.map((ci) => {
            const selected = selectedCis.some((item) => item.instanceId === ci.id)
            return (
              <Button
                key={ci.id}
                type="button"
                variant={selected ? 'primary' : 'secondary'}
                size="sm"
                onClick={() =>
                  onToggle({
                    instanceId: ci.id,
                    instanceName: ci.name,
                    modelName: ci.modelName,
                    modelId: ci.modelId,
                  })
                }
              >
                {ci.name} {ci.modelName}
              </Button>
            )
          })}
        </div>
        {ciSearchResult?.records?.length === 0 ? <p>未匹配到 CI</p> : null}
      </div>
    </NeutralDialog>
  )
}
