'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/design-system/figma-neutral/components'
import type { NavEntry } from './types'
import { isGroup, groupActiveChild } from './utils'

const CLOSE_DELAY = 200 // ms，鼠标移出后的宽限时间
const ANIM_MS = 200    // ms，与 CSS duration-200 对齐

/**
 * 折叠态下的一级条目：只显示图标。
 * - 单项（NavItem）：hover 显示标题 tooltip，点击直接跳转
 * - 分组（NavGroup）：hover 在右侧弹出 flyout 二级菜单
 *
 * flyout 用 fixed 定位，避免被侧栏 overflow 裁切。
 * 鼠标移出后延时 200ms 才收起，期间移入 flyout 可取消收起。
 */
export function CollapsedEntry({ entry, pathname, hasPermission, groupScope }: {
  entry: NavEntry
  pathname: string
  hasPermission: (r: string, a: string) => boolean
  groupScope: string
}) {
  const [mounted, setMounted] = useState(false)
  const [entered, setEntered] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const open = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (unmountTimer.current) clearTimeout(unmountTimer.current)
    const rect = ref.current?.getBoundingClientRect()
    if (rect) setCoords({ top: rect.top, left: rect.right })
    setMounted(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
  }

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      setEntered(false)
      unmountTimer.current = setTimeout(() => setMounted(false), ANIM_MS)
    }, CLOSE_DELAY)
  }

  const toggleOpen = () => {
    if (mounted) {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      if (unmountTimer.current) clearTimeout(unmountTimer.current)
      setEntered(false)
      setMounted(false)
      return
    }
    open()
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
      if (unmountTimer.current) clearTimeout(unmountTimer.current)
    }
  }, [])

  if (isGroup(entry)) {
    const visibleChildren = entry.children.filter(
      c => (!c.requiredScope || c.requiredScope === groupScope)
        && (!c.resource || !c.action || hasPermission(c.resource, c.action)),
    )
    if (visibleChildren.length === 0) return null
    const isActive = groupActiveChild(entry, pathname, hasPermission, groupScope)
    const Icon = entry.icon

    return (
      <div ref={ref} className="relative" onMouseEnter={open} onMouseLeave={scheduleClose}>
        <Button
          type="button"
          variant="ghost"
          onClick={toggleOpen}
          aria-expanded={mounted}
          aria-label={entry.label}
          className={cn(
            'flex h-11 w-full items-center justify-center rounded-lg transition-colors',
            isActive || mounted
              ? 'bg-[var(--cwgsyw-bg-surface-selected)] text-[var(--cwgsyw-text-primary)]'
              : 'text-[var(--cwgsyw-text-secondary)] hover:bg-[var(--cwgsyw-bg-surface-hover)] hover:text-[var(--cwgsyw-text-primary)]',
          )}
        >
          <Icon className="h-[22px] w-[22px]" />
        </Button>

        {mounted && (
          <div
            className="fixed z-50 pl-2"
            style={{ top: coords.top, left: coords.left }}
            onMouseEnter={open}
            onMouseLeave={scheduleClose}
          >
            <div
              className={cn(
                'w-56 origin-left overflow-hidden rounded-xl border border-[var(--cwgsyw-border-default)] bg-[var(--cwgsyw-bg-surface)] shadow-[var(--cwgsyw-elevation-lg)]',
                'transition-all duration-200 ease-out motion-reduce:transition-none',
                entered ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
              )}
            >
              <div className="border-b border-[var(--cwgsyw-border-subtle)] px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--cwgsyw-text-secondary)]">
                {entry.label}
              </div>
              <div className="space-y-0.5 p-1.5">
                {visibleChildren.map((item) => {
                  const childActive = item.exact
                    ? pathname === item.href
                    : pathname === item.href ||
                      pathname.startsWith(item.href + '/') ||
                      pathname.startsWith(item.href + '?')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMounted(false)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                        childActive
                          ? 'bg-[var(--cwgsyw-bg-surface-selected)] text-[var(--cwgsyw-text-primary)]'
                          : 'text-[var(--cwgsyw-text-secondary)] hover:bg-[var(--cwgsyw-bg-surface-hover)] hover:text-[var(--cwgsyw-text-primary)]',
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0 opacity-85" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-[var(--cwgsyw-status-danger-bg)] px-1.5 font-mono text-[11px] tabular-nums text-[var(--cwgsyw-status-danger-fg)]">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 单项
  const { href, label, icon: Icon, resource, action, badge } = entry
  if (resource && action && !hasPermission(resource, action)) return null
  const isActive = pathname === href

  return (
    <div ref={ref} className="relative" onMouseEnter={open} onMouseLeave={scheduleClose}>
      <Link
        href={href}
        className={cn(
          'flex h-11 w-full items-center justify-center rounded-lg transition-colors',
          isActive
            ? 'bg-[var(--cwgsyw-bg-surface-selected)] text-[var(--cwgsyw-text-primary)]'
            : 'text-[var(--cwgsyw-text-secondary)] hover:bg-[var(--cwgsyw-bg-surface-hover)] hover:text-[var(--cwgsyw-text-primary)]',
        )}
      >
        <Icon className="h-[22px] w-[22px]" />
        {badge !== undefined && badge > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-[var(--cwgsyw-status-danger-bg)] px-1 text-center font-[family-name:var(--cwgsyw-font-family-mono)] text-[9px] leading-4 text-[var(--cwgsyw-status-danger-fg)]">{badge > 99 ? '99+' : badge}</span>}
      </Link>
      {mounted && (
        <div className="fixed z-50 pl-2" style={{ top: coords.top + 8, left: coords.left }}>
          <div
            className={cn(
              'origin-left whitespace-nowrap rounded-lg border border-[var(--cwgsyw-border-default)] bg-[var(--cwgsyw-bg-surface)] px-3 py-1.5 text-sm text-[var(--cwgsyw-text-primary)] shadow-[var(--cwgsyw-elevation-lg)]',
              'transition-all duration-200 ease-out motion-reduce:transition-none',
              entered ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
            )}
          >
            {label}
          </div>
        </div>
      )}
    </div>
  )
}
