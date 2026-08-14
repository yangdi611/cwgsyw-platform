import { StatusBadge } from '@/design-system/figma-neutral/components'

export function MaintStatusBadge({ value, expire }: { value: unknown; expire: unknown }) {
  if (typeof value !== 'string' || !value) return null
  const map: Record<string, { label: string; status: 'success' | 'warning' | 'danger' }> = {
    active: { label: '维保在保', status: 'success' },
    expiring: { label: '即将到期', status: 'warning' },
    expired: { label: '已过保', status: 'danger' },
  }
  const m = map[value]
  if (!m) return null
  const expireStr = typeof expire === 'string' && expire ? expire.slice(0, 10) : null
  return <StatusBadge label={expireStr ? `${m.label} · 到期 ${expireStr}` : m.label} status={m.status} />
}

export function BaselineBadge({ value }: { value: unknown }) {
  if (typeof value !== 'number') return null
  const status = value >= 90 ? 'success' : value >= 60 ? 'warning' : 'danger'
  return <StatusBadge label={`基线完整度 ${value}%`} status={status} />
}
