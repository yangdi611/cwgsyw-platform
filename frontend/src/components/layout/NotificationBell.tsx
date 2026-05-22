'use client'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

export function NotificationBell() {
  const { data: count = 0 } = useQuery<number>({
    queryKey: ['notification-unread'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  return (
    <Link
      href="/notifications"
      className="relative inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors"
    >
      <Bell className="h-5 w-5 text-muted-foreground" />
      {count > 0 && (
        <span className={cn(
          'absolute -top-0.5 -right-0.5 inline-flex items-center justify-center',
          'min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold',
          'bg-red-500 text-white leading-none'
        )}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
