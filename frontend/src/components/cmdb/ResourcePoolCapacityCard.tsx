'use client'
import { Cpu, MemoryStick, Server, ShieldCheck } from 'lucide-react'

/**
 * 资源池容量摘要卡片。
 *
 * 后端 CiInstanceQueryService.getDetail() 在 model=resource_pool 时把这四个派生字段
 * 注入到 fieldsData（带 `_` 前缀，与用户属性键 `^[a-z][a-z0-9_]*$` 隔离）：
 *   _worker_count            // 工作节点总数（node_role='worker'）
 *   _schedulable_worker_count // 可调度的工作节点（scheduling_state='schedulable'）
 *   _worker_cpu_cores        // 工作节点 CPU 总核数
 *   _worker_memory_gb        // 工作节点内存总量 (GB)
 *
 * 本组件仅渲染聚合视图；这些字段在模型上没有声明，所以 InstanceBasicInfoTab 的
 * 通用属性表格也不会重复显示。
 */
type DerivedFields = {
  _worker_count?: number
  _schedulable_worker_count?: number
  _worker_cpu_cores?: number
  _worker_memory_gb?: number
}

function asInt(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number.parseInt(v, 10) || 0
  return 0
}

export function ResourcePoolCapacityCard({ fieldsData }: { fieldsData: Record<string, unknown> }) {
  const derived = fieldsData as DerivedFields
  const total = asInt(derived._worker_count)
  const schedulable = asInt(derived._schedulable_worker_count)
  const cpuCores = asInt(derived._worker_cpu_cores)
  const memGb = asInt(derived._worker_memory_gb)

  // worker 比例（避免除零）
  const schedulableRatio = total > 0 ? Math.round((schedulable / total) * 100) : 0

  const tiles: Array<{
    icon: typeof Server
    label: string
    value: string
    sub?: string
    accent: 'primary' | 'success' | 'neutral'
  }> = [
    {
      icon: Server,
      label: '工作节点',
      value: total.toString(),
      sub: total > 0 ? `共 ${total} 台` : '尚未关联主机',
      accent: 'primary',
    },
    {
      icon: ShieldCheck,
      label: '可调度节点',
      value: schedulable.toString(),
      sub: total > 0 ? `${schedulableRatio}% 可调度` : '—',
      accent: schedulable === total ? 'success' : 'neutral',
    },
    {
      icon: Cpu,
      label: 'CPU 核数（聚合）',
      value: cpuCores.toString(),
      sub: total > 0 ? `平均 ${(cpuCores / total).toFixed(1)} 核/节点` : '—',
      accent: 'neutral',
    },
    {
      icon: MemoryStick,
      label: '内存（聚合）',
      value: `${memGb} GB`,
      sub: total > 0 ? `平均 ${(memGb / total).toFixed(1)} GB/节点` : '—',
      accent: 'neutral',
    },
  ]

  const accentCls: Record<typeof tiles[number]['accent'], string> = {
    primary: 'border-v2-primary-border bg-v2-primary-soft text-v2-primary',
    success: 'border-v2-success-border bg-v2-success-soft text-v2-success',
    neutral: 'border-v2-border bg-v2-surface-soft text-v2-muted',
  }

  return (
    <div className="rounded-xl border border-v2-border bg-v2-surface p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-v2-fg">容量摘要</h3>
        <span className="text-xs text-v2-muted">实时聚合（仅统计 worker 节点）</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon
          return (
            <div
              key={t.label}
              className="rounded-lg border border-v2-border bg-v2-surface-soft px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <div className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${accentCls[t.accent]}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-medium text-v2-muted">{t.label}</span>
              </div>
              <div className="mt-2 text-2xl font-semibold text-v2-fg">{t.value}</div>
              {t.sub && <div className="mt-0.5 text-[11px] text-v2-muted">{t.sub}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
