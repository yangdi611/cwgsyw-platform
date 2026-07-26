'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermission } from '@/hooks/usePermission'
import { SpatialLayoutIndex } from '@/features/cmdb-spatial/components/SpatialLayoutIndex'

export default function SpatialLayoutPage() {
  const router = useRouter(); const { hasPermission, isHydrated } = usePermission(); const canRead = hasPermission('cmdb_spatial', 'read') && hasPermission('cmdb_instance', 'read'); const canCreate = hasPermission('cmdb_spatial', 'create'); const canPublish = hasPermission('cmdb_spatial', 'publish')
  useEffect(() => { if (isHydrated && !canRead) router.replace('/') }, [canRead, isHydrated, router])
  if (!isHydrated || !canRead) return null
  return <SpatialLayoutIndex canCreate={canCreate} canPublish={canPublish} />
}
