'use client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="h-14 border-b flex items-center justify-between px-6 bg-background">
      <div />
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{user?.realName?.[0] ?? 'U'}</AvatarFallback>
        </Avatar>
        <span className="text-sm">{user?.realName}</span>
        <Button variant="ghost" size="sm" onClick={logout}>
          退出
        </Button>
      </div>
    </header>
  )
}
