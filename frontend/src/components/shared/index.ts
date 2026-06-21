/**
 * Shared Layout Components
 *
 * 跨多个页面复用的业务布局组件。
 *
 * 这些组件比 v2/ 中的基础组件更具体，承载页面级别的 UX 模式：
 * - 列表管理页：PageHeader + FilterBar + Toolbar + DataTable + DetailDrawer
 * - 通用状态：LoadingState + ErrorState + EmptyState
 * - 数据展示：MetricCard
 */

export { PageHeader, type PageHeaderProps } from './PageHeader'
export { FilterBar, FilterChip, type FilterBarProps, type FilterChipProps } from './FilterBar'
export { EmptyState, type EmptyStateProps } from './EmptyState'
export { Toolbar, type ToolbarProps } from './Toolbar'
export { DataTable, type DataTableProps, type ColumnDef } from './DataTable'
export { DetailDrawer, type DetailDrawerProps } from './DetailDrawer'
export { LoadingState, type LoadingStateProps } from './LoadingState'
export { ErrorState, type ErrorStateProps } from './ErrorState'
export { MetricCard, type MetricCardProps } from './MetricCard'
export { Pagination, type PaginationProps } from './Pagination'
