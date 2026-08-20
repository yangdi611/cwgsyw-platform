'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/lib/api-error'
import { listSpatialLayouts, listSpatialVersions, spatialQueryKeys } from '../api/spatial-api'
import api from '@/lib/api'
import {
  Alert,
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  NeutralAlertDialog,
  NeutralTooltip,
  PageHeader,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

export function SpatialVersionHistory({ roomId, canPublish }: { roomId: number; canPublish: boolean }) {
  const client = useQueryClient()
  const router = useRouter()
  const [restoring, setRestoring] = useState<string | null>(null)
  const {
    data: layouts = [],
    isLoading: isLayoutsLoading,
    isError: isLayoutsError,
    error: layoutsError,
    refetch: refetchLayouts,
  } = useQuery({ queryKey: spatialQueryKeys.layouts(true), queryFn: () => listSpatialLayouts(true) })
  const layout = layouts.find((item) => item.roomInstanceId === roomId)
  const { data: versions = [], isLoading, isError, error, refetch: refetchVersions } = useQuery({
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

  return (
    <>
      <DataManagementPage className="cwgsyw-cmdb-page cwgsyw-cmdb-spatial-versions"
        header={
          <div className="cwgsyw-cmdb-instance-page">
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="布局版本历史"
            subtitle={layout ? `${layout.name} · ${versions.length} 个已发布版本` : '查看已发布版本与恢复入口'}
            actions={<Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/spatial/rooms/${roomId}`)}>返回查看器</Button>}
          />
          </div>
        }
        content={
          isLayoutsLoading ? (
            <div className="cwgsyw-cmdb-spatial-versions__state"><LoadingState label="正在加载空间布局" /></div>
          ) : isLayoutsError ? (
            <div className="cwgsyw-cmdb-spatial-versions__state">
              <ErrorState
                title="空间布局加载失败"
                description={getApiErrorMessage(layoutsError, '请稍后重试')}
                retry={<Button type="button" size="sm" variant="secondary" onClick={() => void refetchLayouts()}>重试</Button>}
              />
            </div>
          ) : !layout ? (
            <div className="cwgsyw-cmdb-spatial-versions__state">
              <EmptyState
                title="未找到空间布局"
                description="该机房没有可查看的活动或归档空间布局。"
                action={<Button type="button" size="sm" variant="secondary" onClick={() => router.push('/cmdb/spatial')}>返回布局列表</Button>}
              />
            </div>
          ) : isLoading ? (
            <div className="cwgsyw-cmdb-spatial-versions__state"><LoadingState label="正在加载版本历史" /></div>
          ) : isError ? (
            <div className="cwgsyw-cmdb-spatial-versions__state">
              <ErrorState
                title="版本历史加载失败"
                description={getApiErrorMessage(error, '版本历史加载失败')}
                retry={<Button type="button" size="sm" variant="secondary" onClick={() => void refetchVersions()}>重试</Button>}
              />
            </div>
          ) : versions.length ? (
            <div className="cwgsyw-cmdb-spatial-versions__content">
              {restore.error ? <Alert tone="danger" title="恢复失败" description={getApiErrorMessage(restore.error, '恢复失败，当前可能存在未确认草稿')} showDismiss={false} /> : null}
              <Table
              className="cwgsyw-cmdb-table cwgsyw-cmdb-spatial-versions__table"
              density="compact"
              showSearch={false}
              columns={[
                { key: 'version', label: '版本' },
                { key: 'publishedAt', label: '发布时间' },
                { key: 'summary', label: '说明' },
                { key: 'count', label: '对象数' },
                { key: 'checksum', label: '校验码' },
                { key: 'actions', label: '' },
              ]}
              rows={versions.map((version) => ({
                id: version.versionId,
                cells: {
                  version: (
                    <div className="cwgsyw-cmdb-spatial-versions__version">
                      <span>V{version.versionNo}</span>
                      {version.state === 'PUBLISHED' ? <StatusBadge label="已发布" status="success" size="sm" /> : null}
                    </div>
                  ),
                  publishedAt: version.publishedAt ? <time dateTime={version.publishedAt}>{new Date(version.publishedAt).toLocaleString('zh-CN')}</time> : '-',
                  summary: version.changeSummary || '-',
                  count: String(version.elementCount),
                  checksum: <code>{version.checksum.slice(0, 12)}</code>,
                  actions: canPublish ? (
                    <NeutralTooltip content="恢复为草稿" className="cwgsyw-tooltip--pill" followCursor>
                      <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="cwgsyw-cmdb-spatial-versions__restore"
                        icon={<span aria-hidden="true" className="cwgsyw-cmdb-spatial-versions__restore-icon" />}
                        aria-label={`恢复版本 V${version.versionNo} 为草稿`}
                        disabled={restore.isPending}
                        onClick={() => setRestoring(version.versionId)}
                      />
                    </NeutralTooltip>
                  ) : null,
                },
              }))}
            />
            </div>
          ) : (
            <div className="cwgsyw-cmdb-spatial-versions__state">
              <EmptyState title="尚无已发布版本" description="发布空间布局后，版本记录会显示在这里。" />
            </div>
          )
        }
      />
      <NeutralAlertDialog
        open={restoring !== null}
        onOpenChange={(open) => { if (!open && !restore.isPending) setRestoring(null) }}
        title="恢复历史版本"
        description="将复制该版本为新草稿，不会立即改变当前已发布版本。"
        confirmLabel={restore.isPending ? '恢复中...' : '确认恢复'}
        onConfirm={() => restoring && restore.mutate(restoring)}
      />
    </>
  )
}
