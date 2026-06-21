'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ChangeRecordItem, ChangeHistoryV2VO } from '@/components/cmdb/ChangeRecordItem'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PageData {
  records: ChangeHistoryV2VO[]
  total: number
  page: number
  size: number
}

interface Props {
  instanceId: string
}

const PAGE_SIZE = 20

/**
 * Per-instance change-history timeline. Backed by the V2 history endpoint
 * (`GET /cmdb/instances/{id}/history`). Each record is rendered via the shared
 * {@link ChangeRecordItem} with field-level JSONB diff on expand.
 */
export function InstanceChangeHistoryTab({ instanceId }: Props) {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<PageData>({
    queryKey: ['cmdb-instance-history', instanceId, page],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}/history`, {
      params: { page, size: PAGE_SIZE },
    }).then(r => r.data.data),
    enabled: !!instanceId,
  })

  const records = data?.records ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="border rounded-lg p-5">
      {isLoading ? (
        <p className="text-sm text-v2-muted py-8 text-center">加载中...</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-v2-muted py-8 text-center">暂无变更记录</p>
      ) : (
        <div className="space-y-3">
          {records.map(record => (
            <ChangeRecordItem key={record.id} record={record} compact />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t">
        <span className="text-sm text-v2-muted">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
