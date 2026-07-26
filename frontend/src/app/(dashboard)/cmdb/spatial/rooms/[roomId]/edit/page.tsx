'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { usePermission } from '@/hooks/usePermission'
import { listSpatialLayouts, spatialQueryKeys } from '@/features/cmdb-spatial/api/spatial-api'
import { SpatialEditor } from '@/features/cmdb-spatial/editor/SpatialEditor'

export default function SpatialEditPage() {
  const params = useParams<{ roomId: string }>(); const router = useRouter(); const { hasPermission, isHydrated } = usePermission(); const roomId = Number(params.roomId); const canEdit = hasPermission('cmdb_spatial', 'update') && hasPermission('cmdb_instance', 'read'); const canPublish = hasPermission('cmdb_spatial', 'publish')
  const { data: layouts = [] } = useQuery({ queryKey: spatialQueryKeys.layouts(), queryFn: () => listSpatialLayouts(), enabled: isHydrated && canEdit && Number.isSafeInteger(roomId) && roomId > 0 })
  useEffect(() => { if (isHydrated && (!canEdit || !Number.isSafeInteger(roomId) || roomId <= 0)) router.replace('/cmdb/spatial') }, [canEdit, isHydrated, roomId, router])
  if (!isHydrated || !canEdit || !Number.isSafeInteger(roomId) || roomId <= 0) return null
  const layout = layouts.find((item) => item.roomInstanceId === roomId)
  if (!layout) return <div className="py-20 text-center text-sm text-v2-muted">正在加载布局草稿...</div>
  return <SpatialEditor roomId={roomId} layoutId={layout.layoutId} canPublish={canPublish} />
}
