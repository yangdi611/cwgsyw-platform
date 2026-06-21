'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { PageHeader, EmptyState } from '@/components/shared'
import { Bell, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { NotificationItem } from '@/components/notification/NotificationItem'

interface NotificationVO {
  id: number
  title: string
  content: string
  type: string
  ref_type: string | null
  ref_id: number | null
  is_read: boolean
  created_at: string
}

interface PageResult {
  records: NotificationVO[]
  total: number
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<PageResult>({
    queryKey: ['notifications'],
    queryFn: () =>
      api.get('/notifications', { params: { page: 1, size: 50 } }).then((r) => r.data.data),
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
  const unreadCount = records.filter((n) => !n.is_read).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="系统管理"
        title="通知中心"
        subtitle={unreadCount > 0 ? `${unreadCount} 条未读通知` : '查看系统与业务通知，点击标记已读。'}
        actions={
          unreadCount > 0 ? (
            <Button
              variant="secondary"
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
            >
              <CheckCheck className="h-4 w-4" />
              全部已读
            </Button>
          ) : undefined
        }
      />

      {isLoading ? null : records.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="h-5 w-5 text-v2-muted" />}
            title="暂无通知"
            description="系统与业务通知将在这里汇总。"
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {records.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={(id) => readMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
