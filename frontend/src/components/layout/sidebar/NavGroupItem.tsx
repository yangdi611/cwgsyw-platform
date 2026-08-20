'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Icon, MenuTriggerButton } from '@/design-system/figma-neutral/components'
import type { NavGroup } from './types'
import { groupActiveChild } from './utils'

export function NavGroupItem({ group, pathname, hasPermission, isOpen, onToggle, groupScope, onNavigate }: {
  group: NavGroup
  pathname: string
  hasPermission: (r: string, a: string) => boolean
  isOpen: boolean
  onToggle: () => void
  groupScope: string
  onNavigate?: () => void
}) {
  const visibleChildren = group.children.filter(c =>
    (!c.requiredScope || c.requiredScope === groupScope)
      && (!c.resource || !c.action || hasPermission(c.resource, c.action))
  )
  if (visibleChildren.length === 0) return null

  const isAnyChildActive = groupActiveChild(group, pathname, hasPermission, groupScope)

  return (
    <div className="cwgsyw-sidebar__group">
      <MenuTriggerButton
        type="button"
        size="sm"
        variant="ghost"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={group.label}
        className={cn(
          'cwgsyw-sidebar__group-trigger',
          isAnyChildActive && 'is-active',
        )}
      >
        <group.icon className="size-4 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <Icon
          name="chevron-down"
          size="sm"
          className={cn(
            'transition-transform duration-200 ease-out motion-reduce:transition-none',
            isOpen ? 'rotate-0' : '-rotate-90',
          )}
        />
      </MenuTriggerButton>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden min-h-0">
          <div className="cwgsyw-sidebar__subitems">
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
                  onClick={onNavigate}
                  className={cn(
                    'cwgsyw-sidebar__subitem',
                    isActive && 'is-active',
                  )}
                >
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
