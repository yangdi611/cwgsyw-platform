import type { ReactNode } from 'react'

/**
 * SOS 报告页的内容模块：1px 外框、34px 浅灰标题行、12px 正文，与设备和 CMDB 详情页相同。
 * 放表格时用 flush，表格贴满模块，不再多画一层边框。
 */
export function SosPanel({ title, flush = false, children }: { title: string; flush?: boolean; children: ReactNode }) {
  return (
    <section className="cwgsyw-devices-panel">
      <header className="cwgsyw-devices-panel__head">{title}</header>
      <div className={flush ? 'cwgsyw-sos-report__panel-flush' : 'cwgsyw-devices-panel__body'}>{children}</div>
    </section>
  )
}
