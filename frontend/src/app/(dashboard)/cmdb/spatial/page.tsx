'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermission } from '@/hooks/usePermission'
import { SpatialLayoutIndex } from '@/features/cmdb-spatial/components/SpatialLayoutIndex'
import {
  DashboardFeedbackPage,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/design-system/figma-neutral/components'
import '@/design-system/figma-neutral/index.css'

export default function SpatialLayoutPage() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const canRead = isHydrated && hasPermission('cmdb_spatial', 'read') && hasPermission('cmdb_instance', 'read')
  const canCreate = isHydrated && hasPermission('cmdb_spatial', 'create')
  const canPublish = isHydrated && hasPermission('cmdb_spatial', 'publish')

  useEffect(() => {
    if (isHydrated && !canRead) router.replace('/')
  }, [canRead, isHydrated, router])

  if (!isHydrated || !canRead) {
    return (
      <DashboardFeedbackPage
        className="cwgsyw-cmdb-page cwgsyw-cmdb-spatial-index"
        header={
          <div className="cwgsyw-cmdb-instance-page">
            <PageHeader
              showEyebrow={false}
              showBreadcrumb={false}
              title="空间布局"
              subtitle="机房与机柜位置"
            />
          </div>
        }
        feedback={
          <div className="cwgsyw-cmdb-spatial-index__state">
            {!isHydrated ? (
              <LoadingState label="准备空间布局" />
            ) : (
              <ErrorState
                title="无权查看空间布局"
                description="当前账号缺少空间布局或 CMDB 实例读取权限。"
                showRetry={false}
              />
            )}
          </div>
        }
      />
    )
  }

  return <SpatialLayoutIndex canCreate={canCreate} canPublish={canPublish} />
}
