'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
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
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isAnyChildActive
            ? 'bg-white/10 text-v2-sidebar-fg'
            : 'text-v2-sidebar-muted hover:bg-white/6 hover:text-v2-sidebar-fg'
        )}
      >
        <group.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none',
            isOpen ? 'rotate-0' : '-rotate-90',
          )}
        />
      </button>

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
                      ? 'bg-blue-600/30 text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.22)]'
                      : 'text-slate-300 hover:bg-white/6 hover:text-white'
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0 opacity-85" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-white/10 text-blue-200 text-[11px] font-mono tabular-nums">
                      {item.badge}
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
