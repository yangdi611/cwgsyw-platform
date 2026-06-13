'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
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
    queryFn: () => api.get('/notifications', { params: { page: 1, size: 50 } })
      .then(r => r.data.data),
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
  const unreadCount = records.filter(n => !n.is_read).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">通知中心</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{unreadCount} 条未读</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}>
            <CheckCheck className="h-4 w-4 mr-1" />全部已读
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">加载中...</p>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground gap-3">
          <Bell className="h-10 w-10 opacity-30" />
          <p>暂无通知</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(n => (
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
