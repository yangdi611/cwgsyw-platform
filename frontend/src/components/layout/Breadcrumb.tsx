'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/design-system/figma-neutral/components'
import { resolveBreadcrumb } from '@/lib/breadcrumb-config'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import { cn } from '@/lib/utils'

/**
 * Top bar 面包屑（A 安静轨迹方案）。
 * - 根模块：侧栏同款图标 + 宝蓝高亮，boldness 全压在这里
 * - 祖先层级：灰色可点跳转，hover 转墨色
 * - 当前页（末段）：墨色加粗，不可点
 * - 分隔符：Neutral chevron-right
 * 动态末段名由详情页通过 useBreadcrumbStore.setDynamicLabel 注册。
 */
export function Breadcrumb() {
  const pathname = usePathname()
  const labels = useBreadcrumbStore((s) => s.labels)
  const prune = useBreadcrumbStore((s) => s.prune)

  // 路由变化时清理过期注册，避免串台
  useEffect(() => {
    prune(pathname)
  }, [pathname, prune])

  const crumbs = resolveBreadcrumb(pathname, labels[pathname])
  const lastIdx = crumbs.length - 1

  return (
    <nav aria-label="面包屑" className="flex min-w-0 items-center">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const isLast = i === lastIdx
          const RootIcon = i === 0 ? c.icon : undefined
          return (
            <li key={i} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && (
                <Icon
                  name="chevron-right"
                  size="sm"
                  className="shrink-0 text-[var(--cwgsyw-text-tertiary)]"
                />
              )}
              {c.href && !isLast ? (
                <Link
                  href={c.href}
                  className="cwgsyw-app-header__crumb-link flex min-w-0 items-center gap-1.5 truncate text-[var(--cwgsyw-text-secondary)] transition-colors hover:text-[var(--cwgsyw-text-primary)]"
                >
                  {RootIcon ? (
                    <RootIcon className="h-4 w-4 shrink-0 text-[var(--cwgsyw-action-primary)]" aria-hidden />
                  ) : null}
                  {c.label}
                </Link>
              ) : (
                <>
                  {RootIcon ? (
                    <RootIcon className="h-4 w-4 shrink-0 text-[var(--cwgsyw-action-primary)]" aria-hidden />
                  ) : null}
                  <span
                    className={cn(
                      'truncate',
                      isLast ? 'font-semibold text-[var(--cwgsyw-text-primary)]' : 'text-[var(--cwgsyw-text-secondary)]',
                    )}
                    aria-current={isLast ? 'page' : undefined}
                  >
                    {c.label}
                  </span>
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
