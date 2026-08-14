'use client'

import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useAuth } from '@/hooks/useAuth'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { useCommandPalette } from '@/store/commandPaletteStore'
import { Avatar, Button, DropdownMenu, MenuItem } from '@/design-system/figma-neutral/components'

export function Header() {
  const { user, logout } = useAuth()
  const { setTheme, theme } = useTheme()
  const router = useRouter()
  const openPalette = useCommandPalette((s) => s.setOpen)
  const fallbackChar = user?.realName?.[0] ?? user?.username?.[0] ?? 'U'

  return (
    <header className="cwgsyw-page-header" style={{ position: 'sticky', top: 0, zIndex: 30 }}>
      <div className="cwgsyw-inline-controls">
        <div className="cwgsyw-page-header__row" style={{ flex: 1, minWidth: 0 }}>
          <Breadcrumb />
        </div>
        <Button type="button" size="sm" variant="secondary" leadingIcon="search" onClick={() => openPalette(true)}>
          搜索
        </Button>
        <Button type="button" size="sm" onClick={() => router.push('/change-docs/new')}>
          新建变更
        </Button>
        <NotificationBell />
        <DropdownMenu
          trigger={
            <Button type="button" variant="ghost" className="cwgsyw-inline-controls" aria-label="打开用户菜单">
              <Avatar
                type={user?.avatarUrl ? 'image' : 'initials'}
                src={user?.avatarUrl}
                alt={user?.realName || user?.username}
                initials={fallbackChar}
              />
              <span className="cwgsyw-type-label-sm">{user?.realName || user?.username}</span>
            </Button>
          }
        >
          <div className="cwgsyw-stack-list">
            <p className="cwgsyw-type-body-sm">{user?.realName || '-'}</p>
            <p className="cwgsyw-type-label-sm">@{user?.username}</p>
            <MenuItem label={theme === 'light' ? '浅色（当前）' : '浅色'} selected={theme === 'light'} onClick={() => setTheme('light')} />
            <MenuItem label={theme === 'dark' ? '深色（当前）' : '深色'} selected={theme === 'dark'} onClick={() => setTheme('dark')} />
            <MenuItem label={theme === 'system' ? '跟随系统（当前）' : '跟随系统'} selected={theme === 'system'} onClick={() => setTheme('system')} />
            <MenuItem label="个人资料" onClick={() => router.push('/account/profile')} />
            <MenuItem label="修改密码" onClick={() => router.push('/account/password')} />
            <MenuItem label="退出登录" type="destructive" onClick={() => logout()} />
          </div>
        </DropdownMenu>
      </div>
    </header>
  )
}
