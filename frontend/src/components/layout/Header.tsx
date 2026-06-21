'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button, buttonVariants } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { NotificationBell } from '@/components/layout/NotificationBell'

const MODULE_LABELS: Record<string, string> = {
  cmdb: 'CMDB',
  'change-docs': '变更文档',
  daily: '日报',
  devices: '设备密码库',
  files: '共享文档',
  ipam: 'IP 地址池',
  workflow: '流程中心',
  users: '用户管理',
  groups: '组管理',
  rbac: '角色权限',
  reports: '报表分析',
  admin: '系统管理',
  notifications: '通知中心',
}

export function Header() {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  const currentModule = useMemo(() => {
    const first = pathname.split('/').filter(Boolean)[0]
    return MODULE_LABELS[first] ?? '工作台'
  }, [pathname])

  return (
    <header className="sticky top-0 z-30 h-14 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex h-full min-w-0 items-center justify-between gap-4 px-4 md:px-6">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">当前位置</p>
          <p className="truncate text-sm font-semibold">{currentModule}</p>
        </div>

        <button
          type="button"
          className="hidden h-9 min-w-0 flex-1 max-w-xl items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">搜索 CI、变更单、设备、流程实例、用户…</span>
          <kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-[11px]">⌘K</kbd>
        </button>

        <div className="flex shrink-0 items-center gap-3">
          <Link href="/change-docs/new" className={buttonVariants({ size: 'sm' })}>
            新建变更
          </Link>
          <NotificationBell />
          <Avatar className="h-8 w-8">
            <AvatarFallback>{user?.realName?.[0] ?? 'U'}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-24 truncate text-sm md:inline">{user?.realName}</span>
          <Button variant="ghost" size="sm" onClick={logout}>
            退出
          </Button>
        </div>
      </div>
    </header>
  )
}