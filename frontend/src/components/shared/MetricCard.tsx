import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger'

const toneStyles: Record<Tone, { iconBg: string; iconFg: string }> = {
  default: { iconBg: 'bg-v2-surface-soft', iconFg: 'text-v2-muted' },
  primary: { iconBg: 'bg-v2-primary-soft', iconFg: 'text-v2-primary' },
  success: { iconBg: 'bg-v2-success-soft', iconFg: 'text-v2-success' },
  warning: { iconBg: 'bg-v2-warning-soft', iconFg: 'text-v2-warning' },
  danger: { iconBg: 'bg-v2-danger-soft', iconFg: 'text-v2-danger' },
}

export interface MetricCardProps {
  /** 指标标题 */
  label: string
  /** 主数值 */
  value: string | number
  /** 数值单位 */
  unit?: string
  /** 副标题/描述 */
  description?: string
  /** 趋势：正数=上升，负数=下降，0=持平 */
  trend?: number
  /** 趋势文案，例如 "比上周" */
  trendLabel?: string
  /** 上升是否为正面（例如告警数上升是负面）。默认 true */
  trendPositive?: boolean
  /** 图标 */
  icon?: LucideIcon
  /** 色调 */
  tone?: Tone
  /** 点击事件 */
  onClick?: () => void
  className?: string
}

/**
 * 指标卡片
 *
 * UX 设计：
 * - 工作台首页和模块概览页的核心元素
 * - 主数值大字号突出，描述和趋势辅助信息
 * - 趋势颜色根据语义反转（告警数上升 = 红色）
 * - 可点击跳转到详情视图
 */
export function MetricCard({
  label,
  value,
  unit,
  description,
  trend,
  trendLabel,
  trendPositive = true,
  icon: Icon,
  tone = 'default',
  onClick,
  className,
}: MetricCardProps) {
  const styles = toneStyles[tone]
  const isClickable = !!onClick
  const trendIsUp = trend !== undefined && trend > 0
  const trendIsDown = trend !== undefined && trend < 0
  const trendIsFlat = trend === 0

  // 趋势颜色：根据 trendPositive 决定上升是绿还是红
  const trendColor = trendIsFlat
    ? 'text-v2-muted'
    : trendIsUp
      ? trendPositive ? 'text-v2-success' : 'text-v2-danger'
      : trendPositive ? 'text-v2-danger' : 'text-v2-success'

  const TrendIcon = trendIsFlat ? Minus : trendIsUp ? TrendingUp : TrendingDown

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-v2-md border border-v2 bg-v2-surface p-5 shadow-v2-sm',
        isClickable && 'cursor-pointer transition-shadow hover:shadow-v2-md',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-v2-muted">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-v2-fg">{value}</span>
            {unit && <span className="text-sm text-v2-muted">{unit}</span>}
          </div>
        </div>
        {Icon && (
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-v2-sm', styles.iconBg, styles.iconFg)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {(description || trend !== undefined) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend !== undefined && (
            <span className={cn('flex items-center gap-1 font-medium', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trend)}%
            </span>
          )}
          {description && <span className="text-v2-muted">{description}</span>}
          {trendLabel && <span className="text-v2-muted">{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}
