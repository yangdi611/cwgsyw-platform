'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import '@/design-system/figma-neutral/index.css'
import { Button, EmptyState, LoadingState } from '@/design-system/figma-neutral/components'

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
    return <LoadingState label="正在打开通知目标…" />
  }
  if (isLoading) {
    return <LoadingState label="正在验证通知目标…" />
  }
  return (
    <EmptyState
      title="通知目标不可用"
      description="该目标可能已删除、您没有访问权限，或通知引用类型暂不支持。"
      action={
        <Button type="button" variant="secondary" onClick={() => router.replace('/notifications')}>
          返回通知中心
        </Button>
      }
    />
  )
}
