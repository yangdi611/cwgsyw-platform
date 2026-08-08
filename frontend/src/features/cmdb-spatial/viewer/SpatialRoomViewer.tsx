'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Edit3, History, Layers3, Search, X } from 'lucide-react'
import { Button, Input } from '@/components/design-system'
import { RackElevationView } from '@/components/cmdb/RackElevationView'
import { DetailDrawer } from '@/components/shared/DetailDrawer'
import { getApiErrorMessage } from '@/lib/api-error'
import { getPublishedSpatialLayout, getSpatialRuntime, locateSpatial, spatialQueryKeys } from '../api/spatial-api'
import type { SpatialElement, SpatialLocateResult } from '../model/types'
import { SpatialSelectionPanel } from '../components/SpatialSelectionPanel'
import { SpatialViewerCanvas } from './SpatialViewerCanvas'
import type { SpatialLayer } from './SpatialCanvasStage'

interface SpatialRoomViewerProps { roomId: number; canUpdate: boolean }
const LAYERS: Array<{ value: SpatialLayer; label: string }> = [
  { value: 'layout', label: '布局' }, { value: 'status', label: '状态' }, { value: 'alert', label: '告警' }, { value: 'rackUtilization', label: '容量' }, { value: 'dataQuality', label: '质量' },
]
const RACK_STATE_LEGEND = [
  { label: '正常', color: 'bg-green-200 border-green-600' }, { label: '告警', color: 'bg-red-200 border-red-600' }, { label: '异常', color: 'bg-orange-100 border-orange-500' }, { label: '维护', color: 'bg-blue-200 border-blue-600' }, { label: '离线', color: 'bg-slate-200 border-slate-500' }, { label: '未知', color: 'bg-yellow-100 border-amber-600' }, { label: '空位', color: 'bg-white border-slate-400' }, { label: '预留', color: 'bg-amber-100 border-amber-600' }, { label: '不可用', color: 'bg-slate-200 border-slate-400' },
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
  const { data: version, isLoading, isError, error } = useQuery({ queryKey: spatialQueryKeys.published(roomId), queryFn: () => getPublishedSpatialLayout(roomId) })
  const { data: runtime } = useQuery({ queryKey: spatialQueryKeys.runtime(version?.layoutId ?? 0), queryFn: () => getSpatialRuntime(version!.layoutId), enabled: Boolean(version?.layoutId), refetchInterval: 60_000 })
  const { data: locations = [] } = useQuery({ queryKey: ['cmdb', 'spatial', 'locate', searchTerm], queryFn: () => locateSpatial(searchTerm), enabled: searchTerm.length > 0 })
  const highlighted = useMemo(() => locations.find((item) => item.roomInstanceId === roomId), [locations, roomId])
  const select = (element: SpatialElement) => { setSelected(element); setLocatedCi(undefined); setKeyword('') }
  const openLocation = (location: typeof locations[number]) => {
    if (location.roomInstanceId !== roomId) { router.push(`/cmdb/spatial/rooms/${location.roomInstanceId}`); return }
    const target = version?.document.elements.find((element) => element.id === location.elementId)
    if (!target) return
    setSelected(target); setLocatedCi(location); setFocusElementId(target.id); setKeyword(''); setSearchTerm('')
  }
  if (isLoading) return <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-sm text-v2-muted">正在加载空间布局...</div>
  if (isError) return <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-24 text-center"><AlertTriangle className="h-8 w-8 text-v2-danger" /><p className="text-sm text-v2-danger">{getApiErrorMessage(error, '空间布局加载失败')}</p><Link href="/cmdb/spatial" className="text-sm text-v2-primary">返回布局列表</Link></div>
  if (!version) return null
  return <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col md:-m-6">
    <header className="flex min-h-14 flex-wrap items-center gap-2 border-b border-v2-border bg-v2-surface px-4 py-2">
      <Link href="/cmdb/spatial" className="inline-flex h-8 w-8 items-center justify-center rounded-v2-sm text-v2-muted hover:bg-v2-surface-hover" title="返回布局列表"><ArrowLeft className="h-4 w-4" /></Link>
      <div className="min-w-[130px] flex-1"><p className="truncate text-sm font-semibold text-v2-fg">机房空间布局</p><p className="text-xs text-v2-muted">已发布版本 {version.versionNo}</p></div>
      <div className="relative order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto">
        <Search className="ml-2 h-4 w-4 shrink-0 text-v2-muted" />
        <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') setSearchTerm(keyword.trim()) }} placeholder="搜索机柜或设备" className="h-8 min-w-0 flex-1 sm:w-44 sm:flex-none" />
        {searchTerm && <Button variant="ghost" size="icon" title="清除搜索" onClick={() => { setSearchTerm(''); setKeyword('') }}><X className="h-4 w-4" /></Button>}
        {searchTerm && <div className="absolute right-0 top-full z-20 mt-2 max-h-52 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-v2-sm border border-v2-border bg-v2-surface shadow-v2-md">
          <div className="border-b border-v2-border px-3 py-2 text-xs text-v2-muted">搜索结果</div>
          {locations.length > 0 ? locations.map((item) => <button key={`${item.layoutId}-${item.elementId}-${item.targetCiInstanceId}`} className="block w-full px-3 py-2 text-left text-sm hover:bg-v2-surface-hover" onClick={() => openLocation(item)}><span className="block truncate text-v2-fg">{item.targetCiName}</span><span className="block truncate text-xs text-v2-muted">{item.pathLabel}</span></button>) : <p className="px-3 py-4 text-center text-sm text-v2-muted">未找到匹配的机柜或设备</p>}
        </div>}
      </div>
      <div className="flex rounded-v2-sm border border-v2-border p-0.5">{LAYERS.map((item) => <button key={item.value} onClick={() => setLayer(item.value)} className={layer === item.value ? 'h-7 rounded-v2-sm bg-v2-primary px-2 text-xs font-medium text-white' : 'h-7 rounded-v2-sm px-2 text-xs text-v2-muted hover:bg-v2-surface-hover'}>{item.label}</button>)}</div>
      <Link href={`/cmdb/spatial/rooms/${roomId}/versions`} className="inline-flex h-8 w-8 items-center justify-center rounded-v2-sm border border-v2-border text-v2-fg hover:bg-v2-surface-hover" title="版本历史"><History className="h-4 w-4" /></Link>
      {canUpdate && <Link href={`/cmdb/spatial/rooms/${roomId}/edit`} className="inline-flex h-8 items-center gap-1.5 rounded-v2-sm border border-v2-border px-3 text-sm font-medium text-v2-fg hover:bg-v2-surface-hover"><Edit3 className="h-4 w-4" />编辑</Link>}
    </header>
    <main className="flex min-h-0 flex-1 overflow-hidden"><section className="min-w-0 flex-1"><SpatialViewerCanvas document={version.document} runtime={runtime} layer={layer} selectedElementId={selected?.id} highlightedElementId={highlighted?.elementId} focusElementId={focusElementId} onSelect={select} /></section><aside className="hidden w-80 shrink-0 border-l border-v2-border bg-v2-surface md:block"><SpatialSelectionPanel element={selected} runtime={selected ? runtime?.elements[selected.id] : undefined} locatedCi={locatedCi} onClose={() => { setSelected(null); setLocatedCi(undefined) }} onOpenRackElevation={setRackElevationId} /></aside></main>
    {selected && <div className="border-t border-v2-border bg-v2-surface md:hidden"><div className="max-h-[42vh] overflow-y-auto"><SpatialSelectionPanel element={selected} runtime={runtime?.elements[selected.id]} locatedCi={locatedCi} onClose={() => { setSelected(null); setLocatedCi(undefined) }} onOpenRackElevation={setRackElevationId} /></div></div>}
    <DetailDrawer open={rackElevationId !== null} onClose={() => setRackElevationId(null)} width="min(760px, 100vw)" title="机柜视图" subtitle="当前机柜的 U 位设备布局">
      {rackElevationId !== null && <RackElevationView rackId={String(rackElevationId)} />}
    </DetailDrawer>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-v2-border bg-v2-surface px-4 py-2 text-xs text-v2-muted"><span className="flex items-center gap-2"><Layers3 className="h-4 w-4" />{layer === 'layout' ? '机柜状态' : `运行图层：${LAYERS.find((item) => item.value === layer)?.label}`}</span>{layer === 'layout' && <span className="flex flex-wrap items-center gap-x-2 gap-y-1">{RACK_STATE_LEGEND.map((item) => <span key={item.label} className="inline-flex items-center gap-1"><i aria-hidden className={`h-2.5 w-2.5 border ${item.color}`} />{item.label}</span>)}</span>}{runtime?.partial && <span className="text-v2-danger">部分运行数据暂不可用</span>}</div>
  </div>
}
