import type { MouseEventHandler, ReactNode } from 'react'

export interface CardProps {
  title?: string
  description?: string
  showDescription?: boolean
  showHeader?: boolean
  headerAction?: ReactNode
  footer?: ReactNode
  showFooter?: boolean
  variant?: 'static' | 'interactive' | 'selected'
  padding?: 'sm' | 'md' | 'lg'
  children?: ReactNode
  onClick?: MouseEventHandler<HTMLButtonElement>
}

export function Card({
  title,
  description,
  showDescription = Boolean(description),
  showHeader = true,
  headerAction,
  footer,
  showFooter = Boolean(footer),
  variant = 'static',
  padding = 'md',
  children,
  onClick,
}: CardProps) {
  const interactive = variant !== 'static'
  const Comp = interactive ? 'button' : 'article'
  return (
    <Comp
      className={['cwgsyw-card', `cwgsyw-card--${padding}`, variant === 'interactive' ? 'cwgsyw-card--interactive' : '', variant === 'selected' ? 'cwgsyw-card--selected' : ''].filter(Boolean).join(' ')}
      type={interactive ? 'button' : undefined}
      aria-pressed={variant === 'selected' || undefined}
      onClick={interactive ? onClick : undefined}
    >
      {showHeader ? (
        <header>
          {title ? <h3 className="cwgsyw-type-title-sm">{title}</h3> : null}
          {headerAction}
        </header>
      ) : null}
      {showDescription && description ? <p className="cwgsyw-type-body-sm">{description}</p> : null}
      {children}
      {showFooter ? <footer>{footer}</footer> : null}
    </Comp>
  )
}

export interface MetricCardProps {
  label: string
  value: string
  unit?: string
  description?: string
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  trendLabel?: string
  showTrend?: boolean
}

export function MetricCard({ label, value, unit, description, tone = 'neutral', trendLabel, showTrend }: MetricCardProps) {
  return (
    <article className="cwgsyw-card cwgsyw-metric" data-cwgsyw-metric={tone}>
      <div className="cwgsyw-type-label-xs">{label}</div>
      <div className="cwgsyw-type-title-sm cwgsyw-metric__value">
        {value}
        {unit ? <span className="cwgsyw-type-label-sm"> {unit}</span> : null}
      </div>
      {description ? <p className="cwgsyw-type-body-sm">{description}</p> : null}
      {showTrend && trendLabel ? <div className="cwgsyw-type-label-xs">{trendLabel}</div> : null}
    </article>
  )
}
