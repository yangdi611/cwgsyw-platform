'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

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
            <div
              key={n.id}
              onClick={() => !n.is_read && readMutation.mutate(n.id)}
              className={cn(
                'p-4 border rounded-lg transition-colors',
                n.is_read
                  ? 'bg-card cursor-default'
                  : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/30'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-2 min-w-0">
                  {!n.is_read && (
                    <span className="mt-1.5 inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className={cn('font-medium text-sm', !n.is_read && 'text-foreground')}>{n.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.content}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {new Date(n.created_at).toLocaleString('zh-CN', {
                    month: 'numeric', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
