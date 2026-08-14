'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button, Icon } from '@/design-system/figma-neutral/components'
import type { NavGroup } from './types'
import { groupActiveChild } from './utils'

export function NavGroupItem({ group, pathname, hasPermission, isOpen, onToggle, groupScope }: {
  group: NavGroup
  pathname: string
  hasPermission: (r: string, a: string) => boolean
  isOpen: boolean
  onToggle: () => void
  groupScope: string
}) {
  const visibleChildren = group.children.filter(c =>
    (!c.requiredScope || c.requiredScope === groupScope)
      && (!c.resource || !c.action || hasPermission(c.resource, c.action))
  )
  if (visibleChildren.length === 0) return null

  const isAnyChildActive = groupActiveChild(group, pathname, hasPermission, groupScope)

  return (
    <div className="mb-1">
      <Button
        type="button"
        variant="ghost"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={group.label}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isAnyChildActive
            ? 'bg-[var(--cwgsyw-bg-surface-selected)] text-[var(--cwgsyw-text-primary)]'
            : 'text-[var(--cwgsyw-text-secondary)] hover:bg-[var(--cwgsyw-bg-surface-hover)] hover:text-[var(--cwgsyw-text-primary)]'
        )}
      >
        <group.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <Icon
          name="chevron-down"
          size="sm"
          className={cn(
            'transition-transform duration-200 ease-out motion-reduce:transition-none',
            isOpen ? 'rotate-0' : '-rotate-90',
          )}
        />
      </Button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden min-h-0">
          <div className="mt-1 space-y-0.5">
            {visibleChildren.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(item.href + '/') ||
                  pathname.startsWith(item.href + '?')

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ml-3',
                    isActive
                      ? 'bg-[var(--cwgsyw-bg-surface-selected)] text-[var(--cwgsyw-text-primary)]'
                      : 'text-[var(--cwgsyw-text-secondary)] hover:bg-[var(--cwgsyw-bg-surface-hover)] hover:text-[var(--cwgsyw-text-primary)]'
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0 opacity-85" />
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
    </div>
  )
}
