'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { ChangeRecordItem, ChangeHistoryV2VO } from '@/components/cmdb/ChangeRecordItem'
import { EmptyState, LoadingState, Pagination } from '@/design-system/figma-neutral/components'

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

export function InstanceChangeHistoryTab({ instanceId }: Props) {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<PageData>({
    queryKey: ['cmdb-instance-history', instanceId, page],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}/history`, {
      params: { page, size: PAGE_SIZE },
    }).then((r) => r.data.data),
    enabled: !!instanceId,
  })

  const records = data?.records ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <section className="cwgsyw-cmdb-instance-tab__section cwgsyw-cmdb-instance-tab__history">
      <div className="cwgsyw-cmdb-instance-tab__head">
        <h2>变更历史</h2>
        <span>{total} 条记录</span>
      </div>
      <div className="cwgsyw-cmdb-instance-tab__body">
        {isLoading ? (
          <LoadingState label="加载变更历史" />
        ) : records.length === 0 ? (
          <EmptyState title="暂无变更记录" description="该实例还没有变更历史。" />
        ) : (
          <div className="cwgsyw-cmdb-instance-tab__history-list">
            {records.map((record) => (
              <ChangeRecordItem key={record.id} record={record} compact />
            ))}
          </div>
        )}
        <Pagination
          page={page}
          pageCount={totalPages}
          totalCount={total}
          density="compact"
          onPageChange={setPage}
        />
      </div>
    </section>
  )
}
