'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import {
  buildInstanceShareView,
  sharePercent,
  type CmdbShareModelInput,
  type CmdbShareView,
} from '@/lib/cmdb-instance-share'
import { Button, EmptyState, ErrorState, LoadingState } from '@/design-system/figma-neutral/components'
import './cmdb-instance-share-chart.css'

function rnd(i: number, k: number): number {
  return Math.abs(((i * 73856093) ^ (k * 19349663)) % 1000) / 1000
}

function polar(cx: number, cy: number, radius: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)]
}

function arcPath(cx: number, cy: number, inner: number, outer: number, startDeg: number, endDeg: number): string {
  const large = endDeg - startDeg > 180 ? 1 : 0
  const [x0, y0] = polar(cx, cy, outer, startDeg)
  const [x1, y1] = polar(cx, cy, outer, endDeg)
  const [x2, y2] = polar(cx, cy, inner, endDeg)
  const [x3, y3] = polar(cx, cy, inner, startDeg)
  return `M${x0} ${y0} A${outer} ${outer} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${inner} ${inner} 0 ${large} 0 ${x3} ${y3} Z`
}

function extractModels(payload: unknown): CmdbShareModelInput[] {
  if (!payload || typeof payload !== 'object') return []
  const records = (payload as { records?: unknown }).records
  return Array.isArray(records) ? records as CmdbShareModelInput[] : []
}

export function CmdbInstanceShareChart() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const canReadModels = hasPermission('cmdb_model', 'read')
  const [hotKey, setHotKey] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['cmdb-models-dashboard-share'],
    queryFn: () => api.get('/cmdb/models', { params: { page: 1, size: 200 } }).then((response) => response.data.data),
    enabled: isHydrated && canReadModels,
  })
  const view = useMemo(() => buildInstanceShareView(extractModels(query.data)), [query.data])

  if (!canReadModels) return null

  return (
    <section className="cwgsyw-home__panel cwgsyw-home__chart-panel" aria-labelledby="home-cmdb-share-title">
      <header>
        <h2 id="home-cmdb-share-title">CI 实例构成</h2>
        <Button type="button" size="sm" variant="secondary" onClick={() => router.push('/cmdb')}>
          查看 CMDB
        </Button>
      </header>
      <div className="cwgsyw-home__panel-body">
        {!isHydrated || query.isLoading ? (
          <LoadingState label="加载 CI 实例构成" />
        ) : query.isError ? (
          <ErrorState
            title="实例构成加载失败"
            description="无法读取各模型下的 CI 实例数量。"
            retry={<Button type="button" size="sm" variant="secondary" onClick={() => void query.refetch()}>重试</Button>}
          />
        ) : view.total === 0 ? (
          <EmptyState showIcon={false} title="暂无 CI 实例" description="模型已经就绪，但还没有可统计的实例。" />
        ) : (
          <div className="cwgsyw-cmdb-share">
            <div className="cwgsyw-cmdb-share__legend-row" role="list">
              {view.slices.map((slice) => (
                <Link
                  key={slice.key}
                  href={slice.href}
                  className={`cwgsyw-cmdb-share__chip${hotKey === slice.key ? ' is-hot' : ''}`}
                  role="listitem"
                  onPointerEnter={() => setHotKey(slice.key)}
                  onPointerLeave={() => setHotKey((current) => (current === slice.key ? null : current))}
                >
                  <span className="cwgsyw-cmdb-share__swatch" aria-hidden="true" />
                  <span className="cwgsyw-cmdb-share__chip-label">{slice.label}</span>
                  <span className="cwgsyw-cmdb-share__chip-value">{sharePercent(slice.count, view.total)}%</span>
                </Link>
              ))}
            </div>
            <div className="cwgsyw-home__chart-canvas">
              <TickDonut view={view} hotKey={hotKey} onHotKeyChange={setHotKey} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function TickDonut({
  view,
  hotKey,
  onHotKeyChange,
}: {
  view: CmdbShareView
  hotKey: string | null
  onHotKeyChange: (key: string | null) => void
}) {
  const router = useRouter()
  const cx = 140
  const cy = 140
  const innerRadius = 58
  let cursor = 0
  const arcs: Array<{
    key: string
    label: string
    href: string
    percent: number
    count: number
    start: number
    end: number
    ticks: Array<{ key: string; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number; delay: number }>
  }> = []

  view.slices.forEach((slice, sliceIndex) => {
    const tickCount = view.ticks[sliceIndex] ?? 0
    const start = cursor * 3.6 - 90
    const ticks: Array<{ key: string; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number; delay: number }> = []
    for (let step = 0; step < tickCount; step += 1) {
      const index = cursor + step
      const angle = index * 3.6 - 90
      const length = 14 + rnd(index + 1, sliceIndex + 2) * 8
      const [x1, y1] = polar(cx, cy, innerRadius, angle)
      const [x2, y2] = polar(cx, cy, innerRadius + length, angle)
      const [x3, y3] = polar(cx, cy, innerRadius + length + 9, angle)
      ticks.push({ key: `${slice.key}-${index}`, x1, y1, x2, y2, x3, y3, delay: index * 0.012 })
    }
    cursor += tickCount
    const end = cursor * 3.6 - 90
    arcs.push({
      key: slice.key,
      label: slice.label,
      href: slice.href,
      percent: sharePercent(slice.count, view.total),
      count: slice.count,
      start,
      end: end === start ? start + 3.6 : end,
      ticks,
    })
  })

  const hot = arcs.find((arc) => arc.key === hotKey) ?? null

  return (
    <svg className="cwgsyw-cmdb-share__svg" viewBox="0 0 280 280" role="img" aria-label={view.conclusion}>
      {arcs.map((arc, index) => {
        const state = !hotKey ? '' : hotKey === arc.key ? ' is-hot' : ' is-dim'
        return (
          <g
            key={arc.key}
            className={`cwgsyw-cmdb-share__arc${state}`}
            style={{ ['--share-opacity' as string]: String(1 - index * 0.14) }}
          >
            {arc.ticks.map((tick) => (
              <g key={tick.key}>
                <line
                  className="cwgsyw-cmdb-share__tick"
                  x1={tick.x1}
                  y1={tick.y1}
                  x2={tick.x2}
                  y2={tick.y2}
                  stroke="currentColor"
                  style={{ animationDelay: `${tick.delay}s` }}
                />
                <line
                  className="cwgsyw-cmdb-share__tick-ext"
                  x1={tick.x2}
                  y1={tick.y2}
                  x2={tick.x3}
                  y2={tick.y3}
                  stroke="currentColor"
                />
              </g>
            ))}
            <path
              className="cwgsyw-cmdb-share__hit"
              d={arcPath(cx, cy, innerRadius - 10, innerRadius + 36, arc.start, arc.end)}
              onPointerEnter={() => onHotKeyChange(arc.key)}
              onPointerLeave={() => onHotKeyChange(null)}
              onClick={() => router.push(arc.href)}
            >
              <title>{`${arc.label} · ${arc.count} · ${arc.percent}%`}</title>
            </path>
          </g>
        )
      })}
      <text className="cwgsyw-cmdb-share__total" x={cx} y={cy - 2} fontSize={22} fontWeight={600} textAnchor="middle">
        {hot ? hot.count : view.total}
      </text>
      <text className="cwgsyw-cmdb-share__unit" x={cx} y={cy + 16} fontSize={10} fontWeight={400} textAnchor="middle">
        {hot ? hot.label : '实例'}
      </text>
    </svg>
  )
}
