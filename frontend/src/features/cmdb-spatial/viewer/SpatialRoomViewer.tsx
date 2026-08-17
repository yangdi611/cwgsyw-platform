'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { motion, MotionConfig } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Drawer as DrawerPrimitive } from 'vaul'
import { getApiErrorMessage } from '@/lib/api-error'
import { getPublishedSpatialLayout, getSpatialRuntime, locateSpatial, spatialQueryKeys } from '../api/spatial-api'
import type { SpatialElement, SpatialLocateResult } from '../model/types'
import { elementLabel } from '../model/geometry'
import { SpatialSelectionPanel } from '../components/SpatialSelectionPanel'
import { SpatialViewerCanvas } from './SpatialViewerCanvas'
import { RACK_STATE_LEGEND, type SpatialLayer } from './SpatialCanvasStage'
import { RackElevationView } from '@/components/cmdb/RackElevationView'
import { DrawerContent, DrawerDescription, DrawerTitle } from '@/design-system/figma-neutral/components/Drawer'
import {
  Alert,
  Button,
  DetailDrawerPage,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  NeutralDrawer,
  PageHeader,
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

export function SpatialRoomViewer({ roomId, canUpdate }: SpatialRoomViewerProps) {
  const [layer, setLayer] = useState<SpatialLayer>('layout')
  const [selected, setSelected] = useState<SpatialElement | null>(null)
  const [keyword, setKeyword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [focusElementId, setFocusElementId] = useState<string | undefined>()
  const [locatedCi, setLocatedCi] = useState<SpatialLocateResult | undefined>()
  const [rackElevationId, setRackElevationId] = useState<number | null>(null)
  const router = useRouter()
  const { data: version, isLoading, isError, error, refetch: refetchVersion } = useQuery({ queryKey: spatialQueryKeys.published(roomId), queryFn: () => getPublishedSpatialLayout(roomId) })
  const {
    data: runtime,
    isLoading: isRuntimeLoading,
    isError: isRuntimeError,
    error: runtimeError,
    refetch: refetchRuntime,
  } = useQuery({ queryKey: spatialQueryKeys.runtime(version?.layoutId ?? 0), queryFn: () => getSpatialRuntime(version!.layoutId), enabled: Boolean(version?.layoutId), refetchInterval: 60_000 })
  const {
    data: locations = [],
    isLoading: isLocateLoading,
    isError: isLocateError,
    error: locateError,
    refetch: refetchLocations,
  } = useQuery({ queryKey: ['cmdb', 'spatial', 'locate', searchTerm], queryFn: () => locateSpatial(searchTerm), enabled: searchTerm.length > 0 })
  const highlighted = useMemo(() => locations.find((item) => item.roomInstanceId === roomId), [locations, roomId])
  const closeSelection = () => {
    setRackElevationId(null)
    setSelected(null)
    setLocatedCi(undefined)
  }
  const select = (element: SpatialElement) => { setRackElevationId(null); setSelected(element); setLocatedCi(undefined); setKeyword('') }
  const clearSearch = () => { setSearchTerm(''); setKeyword('') }
  const submitSearch = () => {
    const next = keyword.trim()
    setSearchTerm(next)
    if (!next) setLocatedCi(undefined)
  }
  const openLocation = (location: (typeof locations)[number]) => {
    if (location.roomInstanceId !== roomId) { router.push(`/cmdb/spatial/rooms/${location.roomInstanceId}`); return }
    const target = version?.document.elements.find((element) => element.id === location.elementId)
    if (!target) return
    setSelected(target); setLocatedCi(location); setFocusElementId(target.id); setKeyword(''); setSearchTerm('')
  }

  return (
    <>
      <DetailDrawerPage
        className="cwgsyw-cmdb-page cwgsyw-cmdb-spatial-room"
        header={
          <div className="cwgsyw-cmdb-instance-page">
            <PageHeader
              showEyebrow={false}
              showBreadcrumb={false}
              title="机房空间布局"
              subtitle={version ? `已发布版本 ${version.versionNo} · 查看机房、机柜与设备位置` : '查看机房、机柜与设备位置'}
              actions={
                <div className="cwgsyw-inline-controls cwgsyw-cmdb-spatial-room__header-actions">
                  <Button type="button" size="sm" variant="secondary" onClick={() => router.push('/cmdb/spatial')}>返回布局列表</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/spatial/rooms/${roomId}/versions`)}>版本历史</Button>
                  {canUpdate ? <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/cmdb/spatial/rooms/${roomId}/edit`)}>编辑</Button> : null}
                </div>
              }
            />
          </div>
        }
        workspaceToolbar={
          <div className="cwgsyw-cmdb-spatial-room__toolbar">
            <SearchInput
              size="sm"
              aria-label="搜索机柜或设备"
              value={keyword}
              placeholder="搜索机柜或设备"
              onChange={(event) => setKeyword(event.target.value)}
              onClear={clearSearch}
              onKeyDown={(event) => { if (event.key === 'Enter') submitSearch() }}
            />
            <MotionConfig reducedMotion="user">
              <div className="cwgsyw-cmdb-spatial-room__layers" role="tablist" aria-label="空间布局图层">
                {LAYERS.map((item) => {
                  const active = layer === item.value
                  return (
                    <Button
                      key={item.value}
                      id={`spatial-room-layer-tab-${item.value}`}
                      type="button"
                      size="sm"
                      variant="ghost"
                      role="tab"
                      className={`cwgsyw-cmdb-spatial-room__layer-tab${active ? ' is-active' : ''}`}
                      aria-selected={active}
                      aria-controls="spatial-room-layer-panel"
                      onClick={() => setLayer(item.value)}
                    >
                      {active ? (
                        <motion.span
                          layoutId="spatial-room-layer-indicator"
                          aria-hidden="true"
                          className="cwgsyw-cmdb-spatial-room__layer-indicator"
                          transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.6 }}
                        />
                      ) : null}
                      <span className="cwgsyw-cmdb-spatial-room__layer-label">{item.label}</span>
                    </Button>
                  )
                })}
              </div>
            </MotionConfig>
          </div>
        }
        content={
          isLoading ? (
            <div className="cwgsyw-cmdb-spatial-room__state"><LoadingState label="正在加载空间布局" /></div>
          ) : isError ? (
            <div className="cwgsyw-cmdb-spatial-room__state">
              <ErrorState
                title="空间布局加载失败"
                description={getApiErrorMessage(error, '空间布局加载失败')}
                retry={<Button type="button" size="sm" variant="secondary" onClick={() => void refetchVersion()}>重新加载</Button>}
              />
            </div>
          ) : !version ? (
            <div className="cwgsyw-cmdb-spatial-room__state">
              <EmptyState
                title="未找到已发布布局"
                description="请先在编辑页发布一个空间布局版本。"
                action={<Button type="button" size="sm" variant="secondary" onClick={() => router.push('/cmdb/spatial')}>返回布局列表</Button>}
              />
            </div>
          ) : (
            <div className="cwgsyw-cmdb-spatial-room__content">
              {isRuntimeError ? (
                <Alert
                  tone="warning"
                  title="运行数据暂不可用"
                  description={getApiErrorMessage(runtimeError, '布局仍可查看，状态、告警和容量信息可能不完整。')}
                  action={<Button type="button" size="sm" variant="secondary" onClick={() => void refetchRuntime()}>重试</Button>}
                  showDismiss={false}
                />
              ) : null}
              {searchTerm ? (
                <section className="cwgsyw-cmdb-spatial-room__search-results" aria-label="空间定位结果" aria-live="polite">
                  <div className="cwgsyw-cmdb-spatial-room__section-header">
                    <div>
                      <h2>定位结果</h2>
                      <p>关键词“{searchTerm}”</p>
                    </div>
                    <Button type="button" size="sm" variant="ghost" onClick={clearSearch}>清除搜索</Button>
                  </div>
                  {isLocateLoading ? (
                    <LoadingState layout="compact" label="正在搜索机柜或设备" />
                  ) : isLocateError ? (
                    <ErrorState
                      layout="compact"
                      title="空间定位失败"
                      description={getApiErrorMessage(locateError, '请稍后重试')}
                      retry={<Button type="button" size="sm" variant="secondary" onClick={() => void refetchLocations()}>重试</Button>}
                    />
                  ) : locations.length > 0 ? (
                    <div className="cwgsyw-cmdb-spatial-room__location-list">
                      {locations.map((item) => (
                        <Button className="cwgsyw-cmdb-spatial-room__location" key={`${item.layoutId}-${item.elementId}-${item.targetCiInstanceId}`} type="button" size="sm" variant="ghost" onClick={() => openLocation(item)}>
                          {item.targetCiName} · {item.pathLabel}
                        </Button>
                      ))}
                    </div>
                  ) : <EmptyState layout="compact" title="未找到匹配的机柜或设备" description="请更换关键词后重试。" />}
                </section>
              ) : null}
              <div
                id="spatial-room-layer-panel"
                role="tabpanel"
                aria-labelledby={`spatial-room-layer-tab-${layer}`}
                className="cwgsyw-cmdb-spatial-room__canvas-frame"
              >
                <SpatialViewerCanvas document={version.document} runtime={runtime} layer={layer} selectedElementId={selected?.id} highlightedElementId={highlighted?.elementId} focusElementId={focusElementId} onSelect={select} />
              </div>
              <p className="cwgsyw-cmdb-spatial-room__legend">
                {layer === 'layout' ? (
                  <>
                    <span>机柜状态：</span>
                    {RACK_STATE_LEGEND.map((item, index) => (
                      <span key={item.key}>
                        {index > 0 ? <span aria-hidden="true"> / </span> : null}
                        <span className="cwgsyw-cmdb-spatial-room__legend-item" style={{ color: item.color }}>{item.label}</span>
                      </span>
                    ))}
                  </>
                ) : `运行图层：${LAYERS.find((item) => item.value === layer)?.label}`}
                {isRuntimeLoading ? ' · 正在同步运行数据' : ''}
                {runtime?.partial ? ' · 部分运行数据暂不可用' : ''}
              </p>
            </div>
          )
        }
      />
      <NeutralDrawer
        open={selected !== null}
        onOpenChange={(open) => { if (!open) closeSelection() }}
        title={selected ? elementLabel(selected) : '空间对象详情'}
        description="空间对象与绑定 CI 信息"
        className="cwgsyw-cmdb-preview-drawer cwgsyw-cmdb-spatial-room__selection-drawer"
        showClose
      >
        <SpatialSelectionPanel element={selected} runtime={selected ? runtime?.elements[selected.id] : undefined} locatedCi={locatedCi} onOpenRackElevation={setRackElevationId} />
        <SpatialNestedDrawer
          open={rackElevationId !== null}
          onOpenChange={(open) => { if (!open) setRackElevationId(null) }}
          title="机柜视图"
          description={selected ? `${elementLabel(selected)} 的 U 位与设备占用情况` : undefined}
        >
          {rackElevationId !== null ? <RackElevationView rackId={String(rackElevationId)} /> : null}
        </SpatialNestedDrawer>
      </NeutralDrawer>
    </>
  )
}

function SpatialNestedDrawer({ open, onOpenChange, title, description, children }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <DrawerPrimitive.NestedRoot open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="cwgsyw-drawer cwgsyw-drawer--right cwgsyw-cmdb-spatial-room__rack-drawer">
        <div className="cwgsyw-drawer__header">
          <div className="cwgsyw-drawer__title-group">
            <DrawerTitle className="cwgsyw-type-title-sm">{title}</DrawerTitle>
            {description ? <DrawerDescription className="cwgsyw-type-body-sm">{description}</DrawerDescription> : null}
          </div>
          <IconButton type="button" variant="ghost" size="sm" icon="close" aria-label="关闭机柜视图" onClick={() => onOpenChange(false)} />
        </div>
        {children ? <div className="cwgsyw-drawer__body">{children}</div> : null}
      </DrawerContent>
    </DrawerPrimitive.NestedRoot>
  )
}
