/**
 * 维保状态徽章（spec §6）。读后端注入的只读派生键 `_maint_status_derived`（active/expiring/expired），
 * 红黄绿标色。无该键（实例未填 maint_expire）则不渲染。
 */
export function MaintStatusBadge({ value, expire }: { value: unknown; expire: unknown }) {
  if (typeof value !== 'string' || !value) return null
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: '维保在保', cls: 'border-v2-success-border bg-v2-success-soft text-v2-success' },
    expiring: { label: '即将到期', cls: 'border-v2-warning-border bg-v2-warning-soft text-v2-warning' },
    expired: { label: '已过保', cls: 'border-v2-danger-border bg-v2-danger-soft text-v2-danger' },
  }
  const m = map[value]
  if (!m) return null
  const expireStr = typeof expire === 'string' && expire ? expire.slice(0, 10) : null
  return (
    <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${m.cls}`}>
      {m.label}
      {expireStr && <span className="font-normal opacity-80">· 到期 {expireStr}</span>}
    </div>
  )
}

/**
 * 基线完整度徽章（§6 P2）。读后端注入的 `_baseline_completeness`（0-100 必填字段填充率）。
 * ≥90 绿 / ≥60 黄 / 否则红。无该键（模型无必填字段）则不渲染。
 */
export function BaselineBadge({ value }: { value: unknown }) {
  if (typeof value !== 'number') return null
  const cls = value >= 90
    ? 'border-v2-success-border bg-v2-success-soft text-v2-success'
    : value >= 60
      ? 'border-v2-warning-border bg-v2-warning-soft text-v2-warning'
      : 'border-v2-danger-border bg-v2-danger-soft text-v2-danger'
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${cls}`}>
      基线完整度 {value}%
    </div>
  )
}
