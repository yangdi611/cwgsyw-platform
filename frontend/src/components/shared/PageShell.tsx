import { HTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type PageShellWidth = 'full' | 'content' | 'form' | 'wide'
export type PageShellDensity = 'comfortable' | 'compact'

export interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  /** 页面内容宽度；普通列表默认使用 full，表单/详情按页面类型选择约束宽度。 */
  width?: PageShellWidth
  /** 页面主要区块之间的垂直节奏。 */
  density?: PageShellDensity
}

const widthClasses: Record<PageShellWidth, string> = {
  full: 'w-full max-w-none',
  content: 'mx-auto w-full max-w-6xl',
  form: 'mx-auto w-full max-w-4xl',
  wide: 'mx-auto w-full max-w-[1600px]',
}

const densityClasses: Record<PageShellDensity, string> = {
  comfortable: 'space-y-6',
  compact: 'space-y-4',
}

/**
 * 普通页面的统一内容边界。
 *
 * 组件只负责宽度和页面级间距，不包含 API、权限或业务状态，便于旧页面按批次接入。
 */
export const PageShell = forwardRef<HTMLDivElement, PageShellProps>(
  ({ className, width = 'full', density = 'comfortable', ...props }, ref) => (
    <div
      ref={ref}
      className={cn('min-w-0', widthClasses[width], densityClasses[density], className)}
      {...props}
    />
  ),
)

PageShell.displayName = 'PageShell'

export interface FormShellProps extends Omit<PageShellProps, 'density'> {
  /** 表单底部操作区。未提供时不渲染额外 footer。 */
  footer?: ReactNode
  /** 是否让操作区在页面滚动时保持可见。 */
  stickyFooter?: boolean
}

/**
 * 表单页面模板：稳定约束内容宽度，并为保存/取消操作提供统一承载区。
 */
export const FormShell = forwardRef<HTMLDivElement, FormShellProps>(
  (
    {
      children,
      className,
      footer,
      stickyFooter = false,
      width = 'form',
      ...props
    },
    ref,
  ) => (
    <div ref={ref} className={cn('min-w-0', widthClasses[width], className)} {...props}>
      <div className="space-y-6">{children}</div>
      {footer && (
        <div
          className={cn(
            'mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-v2-border bg-v2-surface-soft px-4 py-3 sm:px-5',
            stickyFooter && 'sticky bottom-0 z-10 shadow-[0_-2px_8px_rgba(16,24,40,0.06)]',
          )}
        >
          {footer}
        </div>
      )}
    </div>
  ),
)

FormShell.displayName = 'FormShell'
