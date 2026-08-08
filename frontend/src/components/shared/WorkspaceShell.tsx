import { HTMLAttributes, ReactNode, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type WorkspaceHeight = 'viewport' | 'parent' | 'auto'

export interface WorkspaceShellProps extends HTMLAttributes<HTMLDivElement> {
  /** 工作区顶部工具栏；工具栏本身不会参与画布滚动。 */
  toolbar?: ReactNode
  /** 工作区高度策略。viewport 适合独立画布页，parent 适合已有高度约束的模块布局。 */
  height?: WorkspaceHeight
  /** 工作区主体 className，用于控制画布或面板的 overflow。 */
  contentClassName?: string
}

const heightClasses: Record<WorkspaceHeight, string> = {
  // Dashboard content starts below the 3.5rem header; page padding is
  // canceled by workspace callers with a matching negative margin.
  viewport: 'h-[calc(100dvh-3.5rem)] min-h-[32rem]',
  parent: 'h-full',
  auto: 'min-h-0',
}

/**
 * 全宽复杂工作区的统一外壳。
 *
 * 画布、编辑器和预览页应通过显式 height/overflow 管理滚动，不依赖父级负边距。
 */
export const WorkspaceShell = forwardRef<HTMLDivElement, WorkspaceShellProps>(
  ({ children, className, contentClassName, height = 'viewport', toolbar, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex min-w-0 flex-col overflow-hidden bg-v2-bg', heightClasses[height], className)}
      {...props}
    >
      {toolbar}
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', contentClassName)}>{children}</div>
    </div>
  ),
)

WorkspaceShell.displayName = 'WorkspaceShell'

export interface WorkspaceToolbarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  leading?: ReactNode
  title?: ReactNode
  subtitle?: ReactNode
  /** 工具栏右侧主要操作。 */
  actions?: ReactNode
  /** 工具栏中间的筛选、视图或模式控制。 */
  controls?: ReactNode
  ariaLabel?: string
}

/**
 * 画布/编辑器工具栏模板：标题、控制项和操作区在窄屏下允许换行。
 */
export const WorkspaceToolbar = forwardRef<HTMLDivElement, WorkspaceToolbarProps>(
  (
    {
      actions,
      ariaLabel = '工作区工具栏',
      className,
      controls,
      leading,
      subtitle,
      title,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      role="toolbar"
      aria-label={ariaLabel}
      className={cn(
        'flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b border-v2-border bg-v2-surface px-3 py-2 sm:gap-3 sm:px-4',
        className,
      )}
      {...props}
    >
      {leading && <div className="flex shrink-0 items-center">{leading}</div>}
      {(title || subtitle) && (
        <div className="min-w-[9rem] flex-1 basis-48">
          {title && <div className="break-words text-sm font-semibold text-v2-fg">{title}</div>}
          {subtitle && <div className="break-words text-xs text-v2-muted">{subtitle}</div>}
        </div>
      )}
      {controls && <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{controls}</div>}
      {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  ),
)

WorkspaceToolbar.displayName = 'WorkspaceToolbar'
