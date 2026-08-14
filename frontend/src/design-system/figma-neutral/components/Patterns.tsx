import type { ReactNode } from 'react'

export type PatternLayout = 'default' | 'compact'

export function Breadcrumb({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="cwgsyw-breadcrumb" aria-label="面包屑">
      {items.map((item, index) => {
        const current = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`}>
            {item.href && !current ? <a href={item.href}>{item.label}</a> : <span aria-current={current ? 'page' : undefined}>{item.label}</span>}
            {current ? null : <span aria-hidden="true">/</span>}
          </span>
        )
      })}
    </nav>
  )
}

export function PageHeader({
  eyebrow = '资源管理',
  title = '实例管理',
  subtitle = '统一查看、筛选和维护基础设施实例。',
  showEyebrow = true,
  showSubtitle = true,
  showBreadcrumb = true,
  breadcrumb,
  status,
  actions,
  layout = 'default',
}: {
  eyebrow?: string
  title?: string
  subtitle?: string
  showEyebrow?: boolean
  showSubtitle?: boolean
  showBreadcrumb?: boolean
  breadcrumb?: ReactNode
  status?: ReactNode
  actions?: ReactNode
  layout?: PatternLayout
}) {
  return (
    <header className="cwgsyw-page-header" data-layout={layout}>
      {showBreadcrumb ? breadcrumb : null}
      {showEyebrow ? <div className="cwgsyw-type-label-xs cwgsyw-eyebrow">{eyebrow}</div> : null}
      <div className="cwgsyw-page-header__row">
        <h1 className="cwgsyw-type-title-md">{title}</h1>
        {status}
        {actions}
      </div>
      {showSubtitle ? <p className="cwgsyw-type-body-sm">{subtitle}</p> : null}
    </header>
  )
}

export function DetailHeader(props: Parameters<typeof PageHeader>[0] & { identity?: ReactNode; metadata?: ReactNode; tabs?: ReactNode }) {
  return (
    <div className="cwgsyw-detail-header">
      <PageHeader {...props} />
      {props.identity}
      {props.metadata}
      {props.tabs}
    </div>
  )
}

export function Toolbar({
  leading,
  filters,
  actions,
  showLeading = true,
  showFilters = true,
  showActions = true,
  layout = 'default',
}: {
  leading?: ReactNode
  filters?: ReactNode
  actions?: ReactNode
  showLeading?: boolean
  showFilters?: boolean
  showActions?: boolean
  layout?: PatternLayout
}) {
  return (
    <div className="cwgsyw-toolbar" data-layout={layout}>
      {showLeading ? leading : null}
      {showFilters ? filters : null}
      {showActions ? actions : null}
    </div>
  )
}

export function WorkspaceToolbar(props: Parameters<typeof Toolbar>[0]) {
  return <Toolbar {...props} />
}

export function FilterBar({
  search,
  filterItems,
  reset,
  actions,
  layout = 'default',
}: {
  search?: ReactNode
  filterItems?: ReactNode
  reset?: ReactNode
  actions?: ReactNode
  layout?: PatternLayout
}) {
  return (
    <div className="cwgsyw-filter-bar" data-layout={layout}>
      {search}
      {filterItems}
      {reset}
      {actions}
    </div>
  )
}

function PageShell({
  layout = 'default',
  header,
  children,
  embedded = false,
  centered = false,
}: {
  layout?: PatternLayout
  header?: ReactNode
  children: ReactNode
  embedded?: boolean
  centered?: boolean
}) {
  return (
    <div
      className={['cwgsyw-page', `cwgsyw-page--${layout}`, embedded ? 'cwgsyw-page--embedded' : '', centered ? 'cwgsyw-page--centered' : ''].filter(Boolean).join(' ')}
      data-cwgsyw-layout={layout}
    >
      {header}
      {children}
    </div>
  )
}

export function FormSettingsPage({
  layout,
  header,
  form,
  supporting,
  embedded = false,
  centered = false,
}: {
  layout?: PatternLayout
  header?: ReactNode
  form?: ReactNode
  supporting?: ReactNode
  embedded?: boolean
  centered?: boolean
}) {
  return (
    <PageShell layout={layout} header={header} embedded={embedded} centered={centered}>
      <div className="cwgsyw-page__grid">
        <section>{form}</section>
        {supporting ? <aside>{supporting}</aside> : null}
      </div>
    </PageShell>
  )
}

export function DataManagementPage({
  layout,
  header,
  toolbar,
  filter,
  content,
  embedded = false,
}: {
  layout?: PatternLayout
  header?: ReactNode
  toolbar?: ReactNode
  filter?: ReactNode
  content?: ReactNode
  embedded?: boolean
}) {
  return (
    <PageShell layout={layout} header={header} embedded={embedded}>
      {toolbar}
      {filter}
      <section>{content}</section>
    </PageShell>
  )
}

export function DetailDrawerPage({
  layout,
  header,
  workspaceToolbar,
  content,
  drawer,
  embedded = false,
}: {
  layout?: PatternLayout
  header?: ReactNode
  workspaceToolbar?: ReactNode
  content?: ReactNode
  drawer?: ReactNode
  embedded?: boolean
}) {
  return (
    <PageShell layout={layout} header={header} embedded={embedded}>
      {workspaceToolbar}
      <div className="cwgsyw-page__grid">
        <section>{content}</section>
        {drawer}
      </div>
    </PageShell>
  )
}

export function DashboardFeedbackPage({
  layout,
  header,
  metrics,
  feedback,
  supporting,
}: {
  layout?: PatternLayout
  header?: ReactNode
  metrics?: ReactNode
  feedback?: ReactNode
  supporting?: ReactNode
}) {
  return (
    <PageShell layout={layout} header={header}>
      <section className="cwgsyw-page__metrics">{metrics}</section>
      {feedback}
      {supporting}
    </PageShell>
  )
}

export function OverlayDestructivePage({
  layout,
  header,
  contextMenu,
  overlay,
  confirmation,
  embedded = false,
}: {
  layout?: PatternLayout
  header?: ReactNode
  contextMenu?: ReactNode
  overlay?: ReactNode
  confirmation?: ReactNode
  embedded?: boolean
}) {
  return (
    <PageShell layout={layout} header={header} embedded={embedded}>
      {contextMenu}
      {overlay}
      {confirmation}
    </PageShell>
  )
}
