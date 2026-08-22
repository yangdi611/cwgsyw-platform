'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  NotificationEmpty,
  NOTIFICATION_UNLINK_ICON,
  NOTIFICATION_UNLINK_NODE,
} from '@/components/notification/NotificationEmpty'
import '@/design-system/figma-neutral/index.css'
import '@/components/notification/notifications.css'
import { Button, DetailDrawerPage, LoadingState, PageHeader } from '@/design-system/figma-neutral/components'

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

  const isOpening = Boolean(data?.available && data.href)

  return (
    <DetailDrawerPage
      embedded
      className="cwgsyw-notifications-page"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title="目标解析"
          subtitle="正在核对通知指向的业务对象。"
          actions={
            <div className="cwgsyw-inline-controls cwgsyw-notifications__header-actions">
              <Button type="button" size="sm" variant="secondary" onClick={() => router.replace('/notifications')}>
                返回通知中心
              </Button>
            </div>
          }
        />
      }
      content={
        isOpening || isLoading ? (
          <LoadingState label={isOpening ? '正在打开通知目标…' : '正在验证通知目标…'} />
        ) : (
          <NotificationEmpty
            iconSrc={NOTIFICATION_UNLINK_ICON}
            figmaNode={NOTIFICATION_UNLINK_NODE}
            title="通知目标不可用"
            description="该目标可能已删除、您没有访问权限，或通知引用类型暂不支持。"
          />
        )
      }
    />
  )
}
