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

  return (
    <section className="cwgsyw-cmdb-instance-tab__section cwgsyw-cmdb-capacity">
      <div className="cwgsyw-cmdb-instance-tab__head">
        <h2>容量摘要</h2>
        <span>实时聚合（仅统计 worker 节点）</span>
      </div>
      <div className="cwgsyw-cmdb-capacity__grid">
        {tiles.map((t) => {
          const Icon = t.icon
          return (
            <div key={t.label} className="cwgsyw-cmdb-capacity__tile">
              <div className="cwgsyw-cmdb-capacity__label">
                <div className={`cwgsyw-cmdb-capacity__icon cwgsyw-cmdb-capacity__icon--${t.accent}`}>
                  <Icon aria-hidden="true" />
                </div>
                <span>{t.label}</span>
              </div>
              <div className="cwgsyw-cmdb-capacity__value">{t.value}</div>
              {t.sub && <div className="cwgsyw-cmdb-capacity__sub">{t.sub}</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
