'use client'

import Link from 'next/link'
import { AlertTriangle, Box, ExternalLink, Network, Server, X } from 'lucide-react'
import { Button } from '@/components/design-system'
import { FACILITY_TYPE_LABELS, type SpatialElement, type SpatialLocateResult, type SpatialRuntimeElement } from '../model/types'
import { elementLabel } from '../model/geometry'

interface SpatialSelectionPanelProps { element: SpatialElement | null; runtime?: SpatialRuntimeElement; locatedCi?: SpatialLocateResult; onClose: () => void; onOpenRackElevation?: (rackId: number) => void }

export function SpatialSelectionPanel({ element, runtime, locatedCi, onClose, onOpenRackElevation }: SpatialSelectionPanelProps) {
  if (!element) return <div className="p-4 text-sm text-v2-muted">选择机柜、设施或区域查看详情。</div>
  const ciId = runtime?.ciInstanceId ?? element.binding?.ciInstanceId
  const isRack = element.type === 'RACK_SLOT' && runtime?.ciModelId === 'rack'
  const targetIsDifferentCi = locatedCi && locatedCi.targetCiInstanceId !== ciId
  return <div className="flex h-full flex-col">
    <div className="flex items-center justify-between border-b border-v2-border px-4 py-3">
      <div className="min-w-0"><p className="truncate text-sm font-semibold text-v2-fg">{elementLabel(element)}</p><p className="text-xs text-v2-muted">{typeLabel(element)}</p></div>
      <Button variant="ghost" size="icon" title="关闭详情" onClick={onClose}><X className="h-4 w-4" /></Button>
    </div>
    <div className="space-y-5 overflow-y-auto p-4 text-sm">
      {element.type === 'RACK_SLOT' && <section className="space-y-1"><p className="text-xs font-medium text-v2-muted">位置</p><p>{element.rack?.rowCode || '-'}列 / {element.rack?.positionNo || elementLabel(element)} / {slotStateLabel(element.rack?.slotState)}</p></section>}
      {runtime ? <>
        <section className="space-y-1"><p className="text-xs font-medium text-v2-muted">CI</p><p className="font-medium text-v2-fg">{runtime.ciName || 'CI 已删除或无权读取'}</p><p className="text-xs text-v2-muted">{runtime.ciModelId || '-'} / {statusLabel(runtime.ciStatus)}</p></section>
        {runtime.rack && <section className="space-y-1"><p className="text-xs font-medium text-v2-muted">容量</p><p>{runtime.rack.heightU}U / 已用 {runtime.rack.usedU}U / 空闲 {runtime.rack.freeU}U</p><p className="text-xs text-v2-muted">{runtime.rack.deviceCount} 台设备</p></section>}
        <section className="space-y-1"><p className="text-xs font-medium text-v2-muted">告警</p><p className={runtime.activeAlertCount ? 'font-medium text-v2-danger' : ''}>{runtime.activeAlertCount ? `${runtime.activeAlertCount} 条活动告警` : '无活动告警'}</p></section>
        {runtime.qualityIssues.length > 0 && <div className="flex items-start gap-2 border-l-2 border-v2-danger px-3 py-1 text-xs text-v2-danger"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />CI 数据存在异常</div>}
      </> : <section className="space-y-1"><p className="text-xs font-medium text-v2-muted">绑定状态</p><p>{ciId ? '正在加载 CI 运行数据' : '未绑定 CI'}</p></section>}
      {targetIsDifferentCi && <section className="space-y-1 border-l-2 border-v2-primary px-3 py-1"><p className="text-xs font-medium text-v2-muted">搜索目标设备</p><p className="font-medium text-v2-fg">{locatedCi.targetCiName}</p><p className="text-xs text-v2-muted">位于当前机柜</p></section>}
    </div>
    {(ciId || targetIsDifferentCi) && <div className="grid gap-2 border-t border-v2-border p-4">
      {isRack && <Button variant="outline" onClick={() => { if (typeof ciId === 'number') onOpenRackElevation?.(ciId) }}><Server className="mr-1.5 h-4 w-4" />机柜视图</Button>}
      {ciId && <><Link href={`/cmdb/instances/by-model/${runtime?.ciModelId || 'rack'}/${ciId}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-v2-sm border border-v2-border text-sm font-medium text-v2-fg hover:bg-v2-surface-hover"><Box className="h-4 w-4" />机柜 CI 详情<ExternalLink className="h-3.5 w-3.5" /></Link>
      <Link href={`/cmdb/topology/${ciId}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-v2-sm border border-v2-border text-sm font-medium text-v2-fg hover:bg-v2-surface-hover"><Network className="h-4 w-4" />机柜关系拓扑</Link></>}
      {targetIsDifferentCi && <Link href={`/cmdb/instances/by-model/${locatedCi.targetModelId}/${locatedCi.targetCiInstanceId}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-v2-sm border border-v2-primary bg-v2-primary px-3 text-sm font-medium text-white hover:opacity-90"><Box className="h-4 w-4" />查看目标设备<ExternalLink className="h-3.5 w-3.5" /></Link>}
    </div>}
  </div>
}

function typeLabel(element: SpatialElement) { if (element.type === 'FACILITY') return FACILITY_TYPE_LABELS[element.facility?.facilityType || 'GENERAL']; return ({ ROOM_OUTLINE: '机房外轮廓', WALL: '墙体', DOOR: '门', RACK_ROW: '机柜列', RACK_SLOT: '机柜位', AISLE: '通道', ZONE: '功能区域', TEXT: '文字标注' })[element.type] }
function slotStateLabel(state?: string) { return ({ EMPTY: '空位', RESERVED: '预留', OCCUPIED: '已占用', DISABLED: '不可用' })[state || ''] || '-' }
function statusLabel(status?: string | null) { return ({ online: '在线', running: '运行中', active: '运行中', offline: '离线', stopped: '已停止', maintenance: '维护中' })[status || ''] || status || '-' }
