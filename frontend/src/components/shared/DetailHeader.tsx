import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DetailHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  status?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  backHref?: string
  onBack?: () => void
  backLabel?: string
  className?: string
}

/**
 * 详情/编辑页统一标题区。
 *
 * 返回按钮使用 Link 或显式回调二选一；组件不推断业务路由，也不负责加载详情数据。
 */
export function DetailHeader({
  actions,
  backHref,
  backLabel = '返回',
  className,
  eyebrow,
  meta,
  onBack,
  status,
  subtitle,
  title,
}: DetailHeaderProps) {
  const backControl = backHref ? (
    <Link
      href={backHref}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-v2-sm px-2.5 text-sm font-medium text-v2-muted transition-colors hover:bg-v2-surface-soft hover:text-v2-fg"
      aria-label={backLabel}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{backLabel}</span>
    </Link>
  ) : onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-v2-sm px-2.5 text-sm font-medium text-v2-muted transition-colors hover:bg-v2-surface-soft hover:text-v2-fg"
      aria-label={backLabel}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{backLabel}</span>
    </button>
  ) : null

  return (
    <header className={cn('flex min-w-0 flex-wrap items-start gap-3 sm:gap-4', className)}>
      {backControl}
      <div className="min-w-0 flex-1 basis-64">
        {eyebrow && <div className="mb-1 text-xs font-extrabold uppercase tracking-wider text-v2-primary">{eyebrow}</div>}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-2xl font-bold leading-tight text-v2-fg sm:text-3xl">{title}</h1>
          {status && <div className="shrink-0">{status}</div>}
        </div>
        {subtitle && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-v2-muted">{subtitle}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-v2-muted">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 basis-full flex-wrap items-center justify-start gap-2 sm:basis-auto sm:justify-end">{actions}</div>}
    </header>
  )
}
