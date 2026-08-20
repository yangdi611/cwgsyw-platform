'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { usePermission } from '@/hooks/usePermission'
import { getApiErrorMessage } from '@/lib/api-error'
import { listSpatialLayouts, listSpatialRooms, spatialQueryKeys } from '@/features/cmdb-spatial/api/spatial-api'
import '@/design-system/figma-neutral/index.css'
import { SpatialEditor } from '@/features/cmdb-spatial/editor/SpatialEditor'
import {
  Button,
  DashboardFeedbackPage,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/design-system/figma-neutral/components'

export default function SpatialEditPage() {
  const params = useParams<{ roomId: string }>()
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const roomId = Number(params.roomId)
  const canEdit = hasPermission('cmdb_spatial', 'update') && hasPermission('cmdb_instance', 'read')
  const canPublish = hasPermission('cmdb_spatial', 'publish')
  const { data: layouts = [], isLoading, isError, error, refetch } = useQuery({ queryKey: spatialQueryKeys.layouts(), queryFn: () => listSpatialLayouts(), enabled: isHydrated && canEdit && Number.isSafeInteger(roomId) && roomId > 0 })
  const { data: rooms = [] } = useQuery({ queryKey: spatialQueryKeys.rooms('', true), queryFn: () => listSpatialRooms('', true), enabled: isHydrated && canEdit && Number.isSafeInteger(roomId) && roomId > 0 })
  useEffect(() => { if (isHydrated && (!canEdit || !Number.isSafeInteger(roomId) || roomId <= 0)) router.replace('/cmdb/spatial') }, [canEdit, isHydrated, roomId, router])
  const layout = layouts.find((item) => item.roomInstanceId === roomId)
  const roomName = rooms.find((item) => item.roomInstanceId === roomId)?.name

  if (!isHydrated || !canEdit || !Number.isSafeInteger(roomId) || roomId <= 0 || isLoading || isError || !layout) {
    const invalidRoomId = isHydrated && (!Number.isSafeInteger(roomId) || roomId <= 0)
    return (
      <DashboardFeedbackPage
        className="cwgsyw-cmdb-page cwgsyw-cmdb-spatial-editor-state"
        header={
          <div className="cwgsyw-cmdb-instance-page">
            <PageHeader
              showEyebrow={false}
              showBreadcrumb={false}
              title="编辑空间布局"
              subtitle="维护机房、机柜与设施位置"
            />
          </div>
        }
        feedback={
          <div className="cwgsyw-cmdb-spatial-editor-state__content">
            {!isHydrated || isLoading ? (
              <LoadingState label={!isHydrated ? '正在准备空间布局编辑器' : '正在加载空间布局'} />
            ) : !canEdit || invalidRoomId ? (
              <ErrorState
                title={invalidRoomId ? '机房参数无效' : '无权编辑空间布局'}
                description={invalidRoomId ? '正在返回空间布局列表。' : '当前账号缺少空间布局更新或 CMDB 实例读取权限。'}
                showRetry={false}
              />
            ) : isError ? (
              <ErrorState
                title="空间布局列表加载失败"
                description={getApiErrorMessage(error, '请稍后重试')}
                retry={<Button type="button" size="sm" variant="secondary" onClick={() => void refetch()}>重试</Button>}
              />
            ) : (
              <EmptyState
                title="未找到可编辑的活动布局"
                description="该机房当前没有活动空间布局，请返回列表创建或恢复布局。"
                action={<Button type="button" size="sm" variant="secondary" onClick={() => router.push('/cmdb/spatial')}>返回布局列表</Button>}
              />
            )}
          </div>
        }
      />
    )
  }

  return <SpatialEditor roomId={roomId} roomName={roomName ?? layout.name.replace(/逻辑布局$/, '')} layoutId={layout.layoutId} canPublish={canPublish} />
}
