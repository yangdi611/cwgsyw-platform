'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import { SpatialRoomViewer } from '@/features/cmdb-spatial/viewer/SpatialRoomViewer'
import {
  DashboardFeedbackPage,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/design-system/figma-neutral/components'

export default function SpatialRoomPage() {
  const params = useParams<{ roomId: string }>()
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const roomId = Number(params.roomId)
  const canRead = hasPermission('cmdb_spatial', 'read') && hasPermission('cmdb_instance', 'read')
  const canUpdate = hasPermission('cmdb_spatial', 'update')
  useEffect(() => { if (isHydrated && (!canRead || !Number.isSafeInteger(roomId) || roomId <= 0)) router.replace('/cmdb/spatial') }, [canRead, isHydrated, roomId, router])

  if (!isHydrated || !canRead || !Number.isSafeInteger(roomId) || roomId <= 0) {
    const invalidRoomId = isHydrated && (!Number.isSafeInteger(roomId) || roomId <= 0)
    return (
      <DashboardFeedbackPage
        className="cwgsyw-cmdb-page cwgsyw-cmdb-spatial-room"
        header={
          <div className="cwgsyw-cmdb-instance-page">
            <PageHeader
              showEyebrow={false}
              showBreadcrumb={false}
              title="机房空间布局"
              subtitle="查看机房、机柜与设备位置"
            />
          </div>
        }
        feedback={
          <div className="cwgsyw-cmdb-spatial-room__state">
            {!isHydrated ? (
              <LoadingState label="正在准备机房空间布局" />
            ) : (
              <ErrorState
                title={invalidRoomId ? '机房参数无效' : '无权查看机房空间布局'}
                description={invalidRoomId ? '正在返回空间布局列表。' : '当前账号缺少空间布局或 CMDB 实例读取权限。'}
                showRetry={false}
              />
            )}
          </div>
        }
      />
    )
  }

  return <SpatialRoomViewer roomId={roomId} canUpdate={canUpdate} />
}
