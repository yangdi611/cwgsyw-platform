'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/design-system/figma-neutral/components'
import { FACILITY_TYPE_LABELS, type SpatialElement, type SpatialLocateResult, type SpatialRuntimeElement } from '../model/types'
import { elementLabel } from '../model/geometry'

interface SpatialSelectionPanelProps {
  element: SpatialElement | null
  runtime?: SpatialRuntimeElement
  locatedCi?: SpatialLocateResult
  onClose: () => void
  onOpenRackElevation?: (rackId: number) => void
}

export function SpatialSelectionPanel({ element, runtime, locatedCi, onClose, onOpenRackElevation }: SpatialSelectionPanelProps) {
  const router = useRouter()
  if (!element) return <p className="cwgsyw-type-body-sm">选择机柜、设施或区域查看详情。</p>
  const ciId = runtime?.ciInstanceId ?? element.binding?.ciInstanceId
  const isRack = element.type === 'RACK_SLOT' && runtime?.ciModelId === 'rack'
  const targetIsDifferentCi = locatedCi && locatedCi.targetCiInstanceId !== ciId
  return (
    <div className="cwgsyw-stack-list">
      <div className="cwgsyw-inline-controls">
        <div>
          <p className="cwgsyw-type-title-sm">{elementLabel(element)}</p>
          <p className="cwgsyw-type-label-sm">{typeLabel(element)}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>关闭</Button>
      </div>
      {element.type === 'RACK_SLOT' ? (
        <p className="cwgsyw-type-body-sm">{element.rack?.rowCode || '-'}列 / {element.rack?.positionNo || elementLabel(element)} / {slotStateLabel(element.rack?.slotState)}</p>
      ) : null}
      {runtime ? (
        <>
          <p className="cwgsyw-type-body-sm">{runtime.ciName || 'CI 已删除或无权读取'}</p>
          <p className="cwgsyw-type-label-sm">{runtime.ciModelId || '-'} / {statusLabel(runtime.ciStatus)}</p>
          {runtime.rack ? <p className="cwgsyw-type-label-sm">{runtime.rack.heightU}U / 已用 {runtime.rack.usedU}U / 空闲 {runtime.rack.freeU}U · {runtime.rack.deviceCount} 台设备</p> : null}
          <p className="cwgsyw-type-label-sm">{runtime.activeAlertCount ? `${runtime.activeAlertCount} 条活动告警` : '无活动告警'}</p>
          {runtime.qualityIssues.length > 0 ? <p className="cwgsyw-type-label-sm">CI 数据存在异常</p> : null}
        </>
      ) : (
        <p className="cwgsyw-type-body-sm">{ciId ? '正在加载 CI 运行数据' : '未绑定 CI'}</p>
      )}
      {targetIsDifferentCi ? (
        <p className="cwgsyw-type-body-sm">搜索目标设备 {locatedCi.targetCiName}，位于当前机柜</p>
      ) : null}
      <div className="cwgsyw-inline-controls">
        {isRack && typeof ciId === 'number' ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => onOpenRackElevation?.(ciId)}>机柜视图</Button>
        ) : null}
        {ciId ? (
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/instances/by-model/${runtime?.ciModelId || 'rack'}/${ciId}`)}>机柜 CI 详情</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/topology/${ciId}`)}>机柜关系拓扑</Button>
          </>
        ) : null}
        {targetIsDifferentCi ? (
          <Button type="button" size="sm" onClick={() => router.push(`/cmdb/instances/by-model/${locatedCi.targetModelId}/${locatedCi.targetCiInstanceId}`)}>查看目标设备</Button>
        ) : null}
      </div>
    </div>
  )
}

function typeLabel(element: SpatialElement) {
  if (element.type === 'FACILITY') return FACILITY_TYPE_LABELS[element.facility?.facilityType || 'GENERAL']
  return ({ ROOM_OUTLINE: '机房外轮廓', WALL: '墙体', DOOR: '门', RACK_ROW: '机柜列', RACK_SLOT: '机柜位', AISLE: '通道', ZONE: '功能区域', TEXT: '文字标注' })[element.type]
}
function slotStateLabel(state?: string) {
  return ({ EMPTY: '空位', RESERVED: '预留', OCCUPIED: '已占用', DISABLED: '不可用' })[state || ''] || '-'
}
function statusLabel(status?: string | null) {
  return ({ online: '在线', running: '运行中', active: '运行中', offline: '离线', stopped: '已停止', maintenance: '维护中' })[status || ''] || status || '-'
}
