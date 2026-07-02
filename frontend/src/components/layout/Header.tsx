'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { buttonVariants } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { useCommandPalette } from '@/store/commandPaletteStore'

/** Topbar 头像入口：个人资料 / 修改密码 / 退出登录（SPEC 13.7）。 */
export function Header() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const openPalette = useCommandPalette((s) => s.setOpen)

  const fallbackChar = user?.realName?.[0] ?? user?.username?.[0] ?? 'U'

  return (
    <header className="sticky top-0 z-30 h-14 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="flex h-full min-w-0 items-center justify-between gap-4 px-4 md:px-6">
        <div className="min-w-0 shrink-0">
          <Breadcrumb />
        </div>

        <button
          type="button"
          onClick={() => openPalette(true)}
          className="hidden h-9 min-w-0 flex-1 max-w-xl items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">搜索 CI、共享文件、变更单、设备、用户、知识库…</span>
          <kbd className="ml-auto rounded border bg-background px-1.5 py-0.5 text-[11px]">⌘K</kbd>
        </button>

        <div className="flex shrink-0 items-center gap-3">
          <Link href="/change-docs/new" className={buttonVariants({ size: 'sm' })}>
            新建变更
          </Link>
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-1.5 py-1 outline-none hover:bg-muted/60">
              <Avatar className="h-8 w-8">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.realName || user.username} />}
                <AvatarFallback>{fallbackChar}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-24 truncate text-sm md:inline">{user?.realName || user?.username}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{user?.realName || '-'}</span>
                    <span className="text-xs text-muted-foreground">@{user?.username}</span>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/account/profile')}>个人资料</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/account/password')}>修改密码</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => logout()}>
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
