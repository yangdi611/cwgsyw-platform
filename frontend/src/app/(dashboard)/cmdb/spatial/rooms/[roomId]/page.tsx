'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePermission } from '@/hooks/usePermission'
import { SpatialRoomViewer } from '@/features/cmdb-spatial/viewer/SpatialRoomViewer'

export default function SpatialRoomPage() {
  const params = useParams<{ roomId: string }>()
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const roomId = Number(params.roomId)
  const canRead = hasPermission('cmdb_spatial', 'read') && hasPermission('cmdb_instance', 'read')
  const canUpdate = hasPermission('cmdb_spatial', 'update')
  useEffect(() => { if (isHydrated && (!canRead || !Number.isSafeInteger(roomId) || roomId <= 0)) router.replace('/cmdb/spatial') }, [canRead, isHydrated, roomId, router])
  if (!isHydrated || !canRead || !Number.isSafeInteger(roomId) || roomId <= 0) return null
  return <SpatialRoomViewer roomId={roomId} canUpdate={canUpdate} />
}
