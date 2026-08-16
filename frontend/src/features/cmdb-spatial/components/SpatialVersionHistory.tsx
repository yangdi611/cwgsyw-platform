'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/lib/api-error'
import { listSpatialLayouts, listSpatialVersions, spatialQueryKeys } from '../api/spatial-api'
import api from '@/lib/api'
import {
  Alert,
  Breadcrumb,
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
  LoadingState,
  NeutralAlertDialog,
  PageHeader,
  Table,
} from '@/design-system/figma-neutral/components'

export function SpatialVersionHistory({ roomId, canPublish }: { roomId: number; canPublish: boolean }) {
  const client = useQueryClient()
  const [restoring, setRestoring] = useState<string | null>(null)
  const { data: layouts = [] } = useQuery({ queryKey: spatialQueryKeys.layouts(true), queryFn: () => listSpatialLayouts(true) })
  const layout = layouts.find((item) => item.roomInstanceId === roomId)
  const { data: versions = [], isLoading, isError, error } = useQuery({
    queryKey: spatialQueryKeys.versions(layout?.layoutId ?? 0),
    queryFn: () => listSpatialVersions(layout!.layoutId),
    enabled: Boolean(layout),
  })
  const restore = useMutation({
    mutationFn: (versionId: string) => api.post(`/cmdb/spatial/layouts/${layout!.layoutId}/versions/${versionId}/restore`),
    onSuccess: () => {
      setRestoring(null)
      client.invalidateQueries({ queryKey: spatialQueryKeys.draft(layout!.layoutId) })
    },
  })

  if (!layout) return <LoadingState label="正在加载布局" />
  if (isLoading) return <LoadingState label="正在加载版本历史" />
  if (isError) return <ErrorState title="版本历史加载失败" description={getApiErrorMessage(error, '版本历史加载失败')} showRetry={false} />

  return (
    <>
      <DataManagementPage className="cwgsyw-cmdb-page"
        header={
          <div className="cwgsyw-cmdb-instance-page">
          <PageHeader
            showEyebrow={false}
            title="布局版本历史"
            subtitle={layout.name}
            breadcrumb={
              <Breadcrumb
                items={[
                  { href: '/cmdb/spatial', label: '空间布局' },
                  { href: `/cmdb/spatial/rooms/${roomId}`, label: '查看器' },
                  { label: '版本历史' },
                ]}
              />
            }
            actions={<Button type="button" variant="secondary" onClick={() => { window.location.href = `/cmdb/spatial/rooms/${roomId}` }}>返回查看器</Button>}
          />
          </div>
        }
        content={
          versions.length ? (
            <Table
              className="cwgsyw-cmdb-table"
              showSearch={false}
              columns={[
                { key: 'version', label: '版本' },
                { key: 'publishedAt', label: '发布时间' },
                { key: 'summary', label: '说明' },
                { key: 'count', label: '对象数' },
                { key: 'checksum', label: '校验和' },
                { key: 'actions', label: '' },
              ]}
              rows={versions.map((version) => ({
                id: version.versionId,
                cells: {
                  version: `V${version.versionNo}`,
                  publishedAt: version.publishedAt ? new Date(version.publishedAt).toLocaleString('zh-CN') : '-',
                  summary: version.changeSummary || '-',
                  count: String(version.elementCount),
                  checksum: version.checksum.slice(0, 12),
                  actions: canPublish ? (
                    <Button type="button" size="sm" variant="secondary" onClick={() => setRestoring(version.versionId)}>恢复为草稿</Button>
                  ) : null,
                },
              }))}
            />
          ) : (
            <EmptyState title="尚无已发布版本" />
          )
        }
      />
      <NeutralAlertDialog
        open={restoring !== null}
        onOpenChange={(open) => { if (!open) setRestoring(null) }}
        title="恢复历史版本"
        description="将复制该版本为新草稿，不会立即改变当前已发布版本。"
        confirmLabel={restore.isPending ? '恢复中...' : '确认恢复'}
        onConfirm={() => restoring && restore.mutate(restoring)}
      />
      {restore.error ? <Alert tone="danger" title="恢复失败" description={getApiErrorMessage(restore.error, '恢复失败，当前可能存在未确认草稿')} showDismiss={false} /> : null}
    </>
  )
}
