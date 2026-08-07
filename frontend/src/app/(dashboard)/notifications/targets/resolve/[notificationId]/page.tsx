'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { FileQuestion } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/design-system'
import { EmptyState, LoadingState } from '@/components/shared'

interface NotificationTarget {
  available: boolean
  href: string | null
}

export default function NotificationTargetResolverPage() {
  const { notificationId } = useParams<{ notificationId: string }>()
  const router = useRouter()
  const id = Number(notificationId)
  const { data, isLoading } = useQuery<NotificationTarget>({
    queryKey: ['notification-target', id],
    queryFn: () => {
      if (!Number.isInteger(id) || id <= 0) return Promise.resolve({ available: false, href: null })
      return api.get(`/notifications/${id}/target`).then((response) => response.data.data as NotificationTarget)
    },
    retry: false,
  })

  useEffect(() => {
    if (data?.available && data.href) router.replace(data.href)
  }, [data, router])

  if (data?.available && data.href) {
    return <LoadingState label="正在打开通知目标…" minHeight={180} />
  }
  if (isLoading) {
    return <LoadingState label="正在验证通知目标…" minHeight={180} />
  }
  return (
    <EmptyState
      icon={<FileQuestion className="h-5 w-5 text-v2-muted" />}
      title="通知目标不可用"
      description="该目标可能已删除、您没有访问权限，或通知引用类型暂不支持。"
      action={<Button variant="secondary" onClick={() => router.replace('/notifications')}>返回通知中心</Button>}
    />
  )
}
