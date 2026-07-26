'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePermission } from '@/hooks/usePermission'
import { SpatialVersionHistory } from '@/features/cmdb-spatial/components/SpatialVersionHistory'

export default function SpatialVersionsPage() {
  const params = useParams<{ roomId: string }>(); const router = useRouter(); const { hasPermission, isHydrated } = usePermission(); const roomId = Number(params.roomId); const canRead = hasPermission('cmdb_spatial', 'read') && hasPermission('cmdb_instance', 'read'); const canPublish = hasPermission('cmdb_spatial', 'publish')
  useEffect(() => { if (isHydrated && (!canRead || !Number.isSafeInteger(roomId) || roomId <= 0)) router.replace('/cmdb/spatial') }, [canRead, isHydrated, roomId, router])
  if (!isHydrated || !canRead || !Number.isSafeInteger(roomId) || roomId <= 0) return null
  return <SpatialVersionHistory roomId={roomId} canPublish={canPublish} />
}
