import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/v2/Button'
import { cn } from '@/lib/utils'

export interface ErrorStateProps {
  /** 错误标题 */
  title?: string
  /** 错误描述 */
  description?: string
  /** 重试回调 */
  onRetry?: () => void
  /** 重试按钮文案 */
  retryLabel?: string
  className?: string
}

/**
 * 错误状态展示
 *
 * UX 设计：
 * - 红色图标传达错误语义
 * - 描述说明问题，重试按钮提供恢复路径
 * - 与 EmptyState 风格统一但意图明确不同
 */
export function ErrorState({
  title = '加载失败',
  description = '请检查网络后重试，或联系系统管理员',
  onRetry,
  retryLabel = '重试',
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-6 py-12 text-center',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-v2-danger-soft text-v2-danger">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-v2-fg">{title}</h3>
        <p className="text-sm text-v2-muted">{description}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
