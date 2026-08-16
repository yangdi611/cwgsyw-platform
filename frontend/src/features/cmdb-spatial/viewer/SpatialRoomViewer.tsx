'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/lib/api-error'
import { getPublishedSpatialLayout, getSpatialRuntime, locateSpatial, spatialQueryKeys } from '../api/spatial-api'
import type { SpatialElement, SpatialLocateResult } from '../model/types'
import { SpatialSelectionPanel } from '../components/SpatialSelectionPanel'
import { SpatialViewerCanvas } from './SpatialViewerCanvas'
import type { SpatialLayer } from './SpatialCanvasStage'
import { RackElevationView } from '@/components/cmdb/RackElevationView'
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  NeutralDrawer,
  SearchInput,
} from '@/design-system/figma-neutral/components'

interface SpatialRoomViewerProps { roomId: number; canUpdate: boolean }
const LAYERS: Array<{ value: SpatialLayer; label: string }> = [
  { value: 'layout', label: '布局' },
  { value: 'status', label: '状态' },
  { value: 'alert', label: '告警' },
  { value: 'rackUtilization', label: '容量' },
  { value: 'dataQuality', label: '质量' },
]
const RACK_STATE_LEGEND = ['正常', '告警', '异常', '维护', '离线', '未知', '空位', '预留', '不可用']

export function SpatialRoomViewer({ roomId, canUpdate }: SpatialRoomViewerProps) {
  const [layer, setLayer] = useState<SpatialLayer>('layout')
  const [selected, setSelected] = useState<SpatialElement | null>(null)
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [focusElementId, setFocusElementId] = useState<string | undefined>()
  const [locatedCi, setLocatedCi] = useState<SpatialLocateResult | undefined>()
  const [rackElevationId, setRackElevationId] = useState<number | null>(null)
  const router = useRouter()
  const { data: version, isLoading, isError, error } = useQuery({ queryKey: spatialQueryKeys.published(roomId), queryFn: () => getPublishedSpatialLayout(roomId) })
  const { data: runtime } = useQuery({ queryKey: spatialQueryKeys.runtime(version?.layoutId ?? 0), queryFn: () => getSpatialRuntime(version!.layoutId), enabled: Boolean(version?.layoutId), refetchInterval: 60_000 })
  const { data: locations = [] } = useQuery({ queryKey: ['cmdb', 'spatial', 'locate', searchTerm], queryFn: () => locateSpatial(searchTerm), enabled: searchTerm.length > 0 })
  const highlighted = useMemo(() => locations.find((item) => item.roomInstanceId === roomId), [locations, roomId])
  const select = (element: SpatialElement) => { setSelected(element); setLocatedCi(undefined); setKeyword('') }
  const openLocation = (location: (typeof locations)[number]) => {
    if (location.roomInstanceId !== roomId) { router.push(`/cmdb/spatial/rooms/${location.roomInstanceId}`); return }
    const target = version?.document.elements.find((element) => element.id === location.elementId)
    if (!target) return
    setSelected(target); setLocatedCi(location); setFocusElementId(target.id); setKeyword(''); setSearchTerm('')
  }

  if (isLoading) return <LoadingState label="正在加载空间布局" />
  if (isError) {
    return (
      <ErrorState
        title="空间布局加载失败"
        description={getApiErrorMessage(error, '空间布局加载失败')}
        retry={<Button type="button" variant="secondary" onClick={() => router.push('/cmdb/spatial')}>返回布局列表</Button>}
      />
    )
  }
  if (!version) return <EmptyState title="未找到已发布布局" />

  return (
    <div className="cwgsyw-cmdb-page cwgsyw-stack-list">
      <div className="cwgsyw-inline-controls">
        <Button type="button" size="sm" variant="ghost" onClick={() => router.push('/cmdb/spatial')}>返回布局列表</Button>
        <div>
          <p className="cwgsyw-type-title-sm">机房空间布局</p>
          <p className="cwgsyw-type-label-sm">已发布版本 {version.versionNo}</p>
        </div>
        <SearchInput size="sm"
          value={keyword}
          placeholder="搜索机柜或设备"
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') setSearchTerm(keyword.trim()) }}
        />
        {searchTerm ? <Button type="button" size="sm" variant="ghost" onClick={() => { setSearchTerm(''); setKeyword('') }}>清除搜索</Button> : null}
        {LAYERS.map((item) => (
          <Chip key={item.value} label={item.label} selected={layer === item.value} onClick={() => setLayer(item.value)} />
        ))}
        <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/spatial/rooms/${roomId}/versions`)}>版本历史</Button>
        {canUpdate ? <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/spatial/rooms/${roomId}/edit`)}>编辑</Button> : null}
      </div>
      {searchTerm ? (
        <div className="cwgsyw-stack-list">
          {locations.length > 0 ? locations.map((item) => (
            <Button key={`${item.layoutId}-${item.elementId}-${item.targetCiInstanceId}`} type="button" size="sm" variant="ghost" onClick={() => openLocation(item)}>
              {item.targetCiName} · {item.pathLabel}
            </Button>
          )) : <EmptyState title="未找到匹配的机柜或设备" />}
        </div>
      ) : null}
      <div className="cwgsyw-page__grid">
        <SpatialViewerCanvas document={version.document} runtime={runtime} layer={layer} selectedElementId={selected?.id} highlightedElementId={highlighted?.elementId} focusElementId={focusElementId} onSelect={select} />
        <SpatialSelectionPanel element={selected} runtime={selected ? runtime?.elements[selected.id] : undefined} locatedCi={locatedCi} onClose={() => { setSelected(null); setLocatedCi(undefined) }} onOpenRackElevation={setRackElevationId} />
      </div>
      <p className="cwgsyw-type-label-sm">
        {layer === 'layout' ? `机柜状态：${RACK_STATE_LEGEND.join(' / ')}` : `运行图层：${LAYERS.find((item) => item.value === layer)?.label}`}
        {runtime?.partial ? ' · 部分运行数据暂不可用' : ''}
      </p>
      <NeutralDrawer open={rackElevationId !== null} onOpenChange={(open) => { if (!open) setRackElevationId(null) }} title="机柜视图">
        {rackElevationId !== null ? <RackElevationView rackId={String(rackElevationId)} /> : null}
      </NeutralDrawer>
    </div>
  )
}
