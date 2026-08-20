'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/design-system/figma-neutral/components'
import { CmdbInstancePreview } from '@/components/cmdb/CmdbInstancePreview'
import { FACILITY_TYPE_LABELS, type SpatialElement, type SpatialLocateResult, type SpatialRuntimeElement } from '../model/types'
import { elementLabel } from '../model/geometry'

interface SpatialSelectionPanelProps {
  element: SpatialElement | null
  runtime?: SpatialRuntimeElement
  locatedCi?: SpatialLocateResult
  onOpenRackElevation?: (rackId: number) => void
}

export function SpatialSelectionPanel({ element, runtime, locatedCi, onOpenRackElevation }: SpatialSelectionPanelProps) {
  const router = useRouter()
  if (!element) return <p className="cwgsyw-type-body-sm">选择机柜、设施或区域查看详情。</p>
  const ciId = runtime?.ciInstanceId ?? element.binding?.ciInstanceId
  const isRack = element.type === 'RACK_SLOT' && runtime?.ciModelId === 'rack'
  const targetIsDifferentCi = locatedCi && locatedCi.targetCiInstanceId !== ciId
  const fields = [
    { label: '类型', value: typeLabel(element) },
    ...(element.type === 'RACK_SLOT' ? [
      { label: '位置', value: `${element.rack?.rowCode || '-'}列 / ${element.rack?.positionNo || elementLabel(element)}` },
      { label: '占用状态', value: slotStateLabel(element.rack?.slotState) },
    ] : []),
    { label: '绑定 CI', value: runtime?.ciName || (ciId ? '正在加载 CI 运行数据' : '未绑定 CI') },
    ...(runtime ? [
      { label: '模型编码', value: runtime.ciModelId || '-' },
      { label: '状态', value: statusLabel(runtime.ciStatus) },
      ...(runtime.rack ? [
        { label: '机柜容量', value: `${runtime.rack.heightU}U · 已用 ${runtime.rack.usedU}U · 空闲 ${runtime.rack.freeU}U` },
        { label: '设备数量', value: `${runtime.rack.deviceCount} 台` },
      ] : []),
      { label: '活动告警', value: runtime.activeAlertCount ? `${runtime.activeAlertCount} 条` : '无' },
      { label: '数据质量', value: runtime.qualityIssues.length > 0 ? '存在异常' : '正常' },
    ] : []),
    ...(targetIsDifferentCi ? [{ label: '定位目标', value: `${locatedCi.targetCiName} · 位于当前机柜` }] : []),
  ]
  return (
    <CmdbInstancePreview
      fields={fields}
      actions={(
        <>
        {isRack && typeof ciId === 'number' ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="cwgsyw-cmdb-spatial-room__rack-view-cta"
            onClick={() => onOpenRackElevation?.(ciId)}
          >
            机柜视图
          </Button>
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
        </>
      )}
    />
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
