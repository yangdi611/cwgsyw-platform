'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { NotificationItem } from '@/components/notification/NotificationItem'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/design-system/figma-neutral/components'

interface NotificationVO {
  id: number
  title: string
  content: string
  type: string
  refType: string | null
  refId: number | null
  isRead: boolean
  createdAt: string
}

interface PageResult {
  records: NotificationVO[]
  total: number
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery<PageResult>({
    queryKey: ['notifications'],
    queryFn: () =>
      api.get('/notifications', { params: { page: 1, size: 50 } }).then((response) => response.data.data),
  })

  const readMutation = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notification-unread'] })
    },
  })

  const readAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      toast.success('已全部标记为已读')
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notification-unread'] })
    },
  })

  const records = data?.records ?? []
  const unreadCount = records.filter((item) => !item.isRead).length

  return (
    <DataManagementPage
      embedded
      header={
        <PageHeader
          eyebrow="系统管理"
          title="通知中心"
          subtitle={unreadCount > 0 ? `${unreadCount} 条未读通知` : '查看系统与业务通知，点击标记已读。'}
          breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: '通知中心' }]} />}
          actions={
            unreadCount > 0 ? (
              <Button type="button" variant="secondary" loading={readAllMutation.isPending} onClick={() => readAllMutation.mutate()}>
                全部已读
              </Button>
            ) : null
          }
        />
      }
      content={
        isLoading ? (
          <LoadingState label="正在加载通知…" />
        ) : isError ? (
          <ErrorState
            title="通知加载失败"
            description="无法读取通知中心，请重试。"
            retry={
              <Button type="button" variant="secondary" onClick={() => void refetch()}>
                重试
              </Button>
            }
          />
        ) : records.length === 0 ? (
          <EmptyState title="暂无通知" description="系统与业务通知将在这里汇总。" showAction={false} />
        ) : (
          <div className="cwgsyw-form">
            {records.map((item) => (
              <NotificationItem key={item.id} notification={item} onMarkRead={(id) => readMutation.mutate(id)} />
            ))}
          </div>
        )
      }
    />
  )
}
