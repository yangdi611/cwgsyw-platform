export const CMDB_SHARE_TICK_COUNT = 100
export const CMDB_SHARE_MAX_SLICES = 6
export const CMDB_SHARE_NAMED_LIMIT = 5
export const CMDB_SHARE_OTHER_KEY = '__other__'

export interface CmdbShareModelInput {
  modelId: string
  name?: string
  displayName?: string
  instanceCount?: number | null
}

export interface CmdbShareSlice {
  key: string
  label: string
  count: number
  href: string
}

export interface CmdbShareView {
  slices: CmdbShareSlice[]
  ticks: number[]
  total: number
  collapsed: boolean
  remainderTicks: number
  conclusion: string
}

function modelLabel(model: CmdbShareModelInput): string {
  const label = model.displayName || model.name || model.modelId
  return label.trim() || model.modelId
}

export function allocateTicks(counts: number[], totalTicks = CMDB_SHARE_TICK_COUNT): number[] {
  const sum = counts.reduce((acc, count) => acc + count, 0)
  if (counts.length === 0 || sum <= 0) return counts.map(() => 0)

  const raw = counts.map((count) => (count / sum) * totalTicks)
  const ticks = raw.map((value) => Math.floor(value))
  let remaining = totalTicks - ticks.reduce((acc, count) => acc + count, 0)
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)

  for (let step = 0; remaining > 0 && order.length > 0; step += 1) {
    ticks[order[step % order.length].index] += 1
    remaining -= 1
  }

  return ticks
}

export function buildInstanceShareView(models: CmdbShareModelInput[]): CmdbShareView {
  const populated = models
    .map((model) => ({
      key: model.modelId,
      label: modelLabel(model),
      count: Math.max(0, model.instanceCount ?? 0),
      href: `/cmdb/instances/by-model/${model.modelId}`,
    }))
    .filter((slice) => slice.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'zh-CN'))

  const total = populated.reduce((acc, slice) => acc + slice.count, 0)
  const collapsed = populated.length > CMDB_SHARE_MAX_SLICES
  const named = collapsed ? populated.slice(0, CMDB_SHARE_NAMED_LIMIT) : populated
  const rest = collapsed ? populated.slice(CMDB_SHARE_NAMED_LIMIT) : []
  const slices = rest.length > 0
    ? named.concat([{
        key: CMDB_SHARE_OTHER_KEY,
        label: '其他',
        count: rest.reduce((acc, slice) => acc + slice.count, 0),
        href: '/cmdb',
      }])
    : named

  const ticks = allocateTicks(slices.map((slice) => slice.count))
  const remainderTicks = Math.max(0, CMDB_SHARE_TICK_COUNT - ticks.reduce((acc, count) => acc + count, 0))

  return {
    slices,
    ticks,
    total,
    collapsed,
    remainderTicks,
    conclusion: shareConclusion(slices, total, collapsed),
  }
}

export function sharePercent(count: number, total: number): number {
  if (total <= 0 || count <= 0) return 0
  return Math.round((count / total) * 1000) / 10
}

function shareConclusion(slices: CmdbShareSlice[], total: number, collapsed: boolean): string {
  if (total <= 0 || slices.length === 0) return '还没有可统计的 CI 实例'
  const lead = slices[0]
  const percent = Math.round((lead.count / total) * 100)
  if (slices.length === 1) return `${lead.label}覆盖了全部 ${total} 个 CI`
  if (percent >= 50) return `${lead.label}占全部 CI 的 ${percent}%`
  if (collapsed) return `实例集中在前 ${CMDB_SHARE_NAMED_LIMIT} 个模型，其余已合并`
  return `CI 分布在 ${slices.length} 个模型中`
}
