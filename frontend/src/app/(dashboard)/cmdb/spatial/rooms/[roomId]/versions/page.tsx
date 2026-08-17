'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import { SpatialVersionHistory } from '@/features/cmdb-spatial/components/SpatialVersionHistory'
import {
  DashboardFeedbackPage,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/design-system/figma-neutral/components'

export default function SpatialVersionsPage() {
  const params = useParams<{ roomId: string }>()
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const roomId = Number(params.roomId)
  const canRead = hasPermission('cmdb_spatial', 'read') && hasPermission('cmdb_instance', 'read')
  const canPublish = hasPermission('cmdb_spatial', 'publish')
  useEffect(() => { if (isHydrated && (!canRead || !Number.isSafeInteger(roomId) || roomId <= 0)) router.replace('/cmdb/spatial') }, [canRead, isHydrated, roomId, router])

  if (!isHydrated || !canRead || !Number.isSafeInteger(roomId) || roomId <= 0) {
    const invalidRoomId = isHydrated && (!Number.isSafeInteger(roomId) || roomId <= 0)
    return (
      <DashboardFeedbackPage
        className="cwgsyw-cmdb-page cwgsyw-cmdb-spatial-versions"
        header={
          <div className="cwgsyw-cmdb-instance-page">
            <PageHeader
              showEyebrow={false}
              showBreadcrumb={false}
              title="布局版本历史"
              subtitle="查看已发布版本与恢复入口"
            />
          </div>
        }
        feedback={
          <div className="cwgsyw-cmdb-spatial-versions__state">
            {!isHydrated ? (
              <LoadingState label="正在准备布局版本历史" />
            ) : (
              <ErrorState
                title={invalidRoomId ? '机房参数无效' : '无权查看布局版本历史'}
                description={invalidRoomId ? '正在返回空间布局列表。' : '当前账号缺少空间布局或 CMDB 实例读取权限。'}
                showRetry={false}
              />
            )}
          </div>
        }
      />
    )
  }

  return <SpatialVersionHistory roomId={roomId} canPublish={canPublish} />
}
