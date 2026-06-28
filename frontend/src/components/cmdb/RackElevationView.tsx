'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { AlertTriangle, Server, Plus } from 'lucide-react'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'

/**
 * 2D 机柜视图（spec §5.3）。竖向机柜，U 位从下往上（1U 底、N U 顶）。
 * 后端：GET /cmdb/rack/{id}/layout → RackLayoutVO。块底色用模型 color，块高 = 跨 U 数。
 */
interface RackDevice {
  id: number
  modelId: string
  modelName: string
  name: string
  status: string
  assetNo: string | null
  uStart: number | null
  uEnd: number | null
  modelColor: string | null
}
interface RackWarning {
  type: string
  instanceId: number | null
  message: string
}
interface RackLayout {
  rackId: number
  rackName: string
  rackHeightU: number | null
  devices: RackDevice[]
  warnings: RackWarning[]
}

const U_PX = 22 // 单 U 像素高

export function RackElevationView({ rackId }: { rackId: string }) {
  const { hasPermission } = usePermission()
  const { data, isLoading, isError } = useQuery<RackLayout>({
    queryKey: ['rack-layout', rackId],
    queryFn: async () => {
      const r = await api.get(`/cmdb/rack/${rackId}/layout`)
      return r.data.data
    },
    enabled: typeof window !== 'undefined',
  })

  if (isLoading) return <p className="text-v2-muted">加载机柜布局…</p>
  if (isError || !data) return <p className="text-v2-danger">机柜布局加载失败</p>

  const height = data.rackHeightU && data.rackHeightU > 0 ? data.rackHeightU : 42
  const placed = data.devices.filter((d) => d.uStart != null && d.uEnd != null && d.uEnd >= d.uStart)
  const unplaced = data.devices.filter((d) => !(d.uStart != null && d.uEnd != null && d.uEnd >= d.uStart))

  // U 行从上往下渲染（顶部 = height U），用 absolute 定位设备块
  const rows = Array.from({ length: height }, (_, i) => height - i) // [height, ..., 1]

  return (
    <div className="space-y-4">
      {data.warnings.length > 0 && (
        <div className="rounded-lg border border-v2-danger-border bg-v2-danger-soft px-4 py-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-v2-danger">
            <AlertTriangle className="h-4 w-4" />
            布局告警（{data.warnings.length}）
          </div>
          <ul className="space-y-0.5 text-xs text-v2-danger">
            {data.warnings.map((w, i) => (
              <li key={i}>· {w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-v2-fg">{data.rackName} · 机柜视图</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-v2-muted">
            共 {height}U · 已安装 {placed.length} 台{unplaced.length > 0 && ` · 未定位 ${unplaced.length} 台`}
          </span>
          {hasPermission('cmdb_relation', 'create') && (
            <Link
              href={`/cmdb/instances/by-model/rack/${rackId}/associations/new`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-v2-md border border-v2-border bg-v2-surface text-sm font-semibold text-v2-fg shadow-v2-sm transition-colors hover:bg-v2-surface-hover"
            >
              <Plus className="h-4 w-4" />
              添加设备
            </Link>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {/* 机柜本体 */}
        <div className="inline-block rounded-xl border border-v2-border bg-v2-surface-soft p-3">
          <div className="relative" style={{ width: 280, height: height * U_PX }}>
            {/* U 刻度行背景 */}
            {rows.map((u) => (
              <div
                key={u}
                className="absolute left-0 flex w-full items-center border-t border-dashed border-v2-border/60"
                style={{ top: (height - u) * U_PX, height: U_PX }}
              >
                <span className="w-8 shrink-0 pr-1 text-right font-v2-mono text-[10px] text-v2-muted">
                  {u}
                </span>
              </div>
            ))}
            {/* 设备块 */}
            {placed.map((d) => {
              const span = (d.uEnd as number) - (d.uStart as number) + 1
              const top = (height - (d.uEnd as number)) * U_PX
              const color = d.modelColor || '#8C8C8C'
              return (
                <Link
                  key={d.id}
                  href={`/cmdb/instances/by-model/${d.modelId}/${d.id}`}
                  className="absolute left-8 flex flex-col justify-center overflow-hidden rounded-md border px-2 text-white shadow-v2-sm transition-opacity hover:opacity-90"
                  style={{
                    top: top + 1,
                    height: span * U_PX - 2,
                    width: 'calc(100% - 2.25rem)',
                    backgroundColor: color,
                    borderColor: color,
                  }}
                  title={`${d.name}（${d.modelName} · U${d.uStart}-${d.uEnd}）`}
                >
                  <span className="truncate text-xs font-semibold leading-tight">{d.name}</span>
                  {span > 1 && (
                    <span className="truncate text-[10px] leading-tight opacity-80">
                      {d.modelName}
                      {d.assetNo ? ` · ${d.assetNo}` : ''}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>

        {/* 未定位设备 */}
        {unplaced.length > 0 && (
          <div className="flex-1">
            <div className="mb-2 text-xs font-semibold text-v2-muted">未定位设备（缺 U 位）</div>
            <div className="space-y-1.5">
              {unplaced.map((d) => (
                <Link
                  key={d.id}
                  href={`/cmdb/instances/by-model/${d.modelId}/${d.id}`}
                  className="flex items-center gap-2 rounded-md border border-v2-border bg-v2-surface px-3 py-1.5 text-sm text-v2-fg hover:bg-v2-surface-hover"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: d.modelColor || '#8C8C8C' }}
                  />
                  <Server className="h-3.5 w-3.5 text-v2-muted" />
                  <span className="truncate">{d.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-v2-muted">{d.modelName}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
