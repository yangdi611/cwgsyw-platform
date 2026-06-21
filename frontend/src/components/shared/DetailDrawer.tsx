'use client'
import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** 副标题 / 状态行 */
  subtitle?: ReactNode
  /** 头部右侧操作按钮 */
  actions?: ReactNode
  children: ReactNode
  /** 抽屉宽度（默认 480px） */
  width?: number | string
  /** 底部固定区（保存 / 取消等） */
  footer?: ReactNode
  className?: string
}

/**
 * 右侧详情抽屉
 *
 * UX 设计：
 * - 列表页点击行时打开，保留列表上下文
 * - ESC 键关闭，点击遮罩关闭
 * - 头部固定 + 底部固定 + 中间滚动，长内容不影响操作
 * - 抽屉滑入动画 200ms
 */
export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
  width = 480,
  footer,
  className,
}: DetailDrawerProps) {
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          'flex h-full flex-col border-l border-v2-border bg-v2-surface shadow-v2-lg',
          'animate-in slide-in-from-right duration-200',
          className
        )}
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        {(title || actions) && (
          <header className="flex items-start justify-between gap-3 border-b border-v2-border px-5 py-4">
            <div className="min-w-0 flex-1">
              {title && <h3 className="truncate text-base font-semibold text-v2-fg">{title}</h3>}
              {subtitle && <div className="mt-1 text-sm text-v2-muted">{subtitle}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <button
                type="button"
                onClick={onClose}
                className="-mr-1 rounded-md p-1.5 text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="border-t border-v2-border bg-v2-surface-soft px-5 py-3">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  )
}
