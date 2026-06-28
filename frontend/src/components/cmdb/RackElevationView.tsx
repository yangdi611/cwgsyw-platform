'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { AlertTriangle, Server, Plus } from 'lucide-react'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'

/**
 * 2D 机柜视图（spec §5.3）。SVG 矢量机架：深色金属面板 + cage-nut 导轨孔条 + 跟随悬停浮卡。
 * 后端：GET /cmdb/rack/{id}/layout → RackLayoutVO。U 位从下往上（1U 底、N U 顶）。
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
  innerIp: string | null
  sn: string | null
}
interface RackWarning { type: string; instanceId: number | null; message: string }
interface RackLayout {
  rackId: number
  rackName: string
  rackHeightU: number | null
  devices: RackDevice[]
  warnings: RackWarning[]
}

// ---- SVG 几何（user units）----
const U_H = 22       // 单 U 高
const NUM_W = 20     // U 编号栏宽（左右各一）
const RAIL_W = 26    // 导轨立柱宽（含孔条）
const BAY_W = 300    // 设备区宽
const FRAME = 14     // 上下机架边框
const BAY_X = NUM_W + RAIL_W
const TOTAL_W = NUM_W + RAIL_W + BAY_W + RAIL_W + NUM_W

// 状态 → LED 颜色 + 中文。运行=绿 / 告警=琥珀 / 宕机=红 / 其余=灰。
function statusMeta(status: string): { color: string; label: string } {
  const s = (status || '').toLowerCase()
  if (['running', 'online', 'normal', 'up', '在线', '运行', '正常'].some((k) => s.includes(k)))
    return { color: '#22c55e', label: '运行中' }
  if (['warning', 'warn', 'degraded', '告警', '降级'].some((k) => s.includes(k)))
    return { color: '#f59e0b', label: '告警' }
  if (['down', 'offline', 'error', 'fault', 'stopped', '宕机', '离线', '故障', '停机'].some((k) => s.includes(k)))
    return { color: '#ef4444', label: '异常' }
  return { color: '#94a3b8', label: status || '未知' }
}

// modelId → 面板形态：服务器/网络/电源/存储/其他。决定面板上画什么纹理。
type Form = 'server' | 'network' | 'power' | 'storage' | 'generic'
function deviceForm(modelId: string): Form {
  const m = (modelId || '').toLowerCase()
  if (/(switch|router|firewall|网络|交换|路由|防火)/.test(m)) return 'network'
  if (/(pdu|power|ups|电源|配电)/.test(m)) return 'power'
  if (/(storage|disk|nas|san|存储|磁盘)/.test(m)) return 'storage'
  if (/(host|server|gpu|vm|主机|服务器|虚机)/.test(m)) return 'server'
  return 'generic'
}

/**
 * 面板纹理：按设备形态画一小簇矢量图元，居中靠右（LED 左侧）。cx 为纹理簇中心 x，cy 为面板中心 y。
 * 1U 也能放下——元素紧凑、纵向不超过 ~12px。
 */
function Texture({ form, cx, cy }: { form: Form; cx: number; cy: number }) {
  const ink = 'rgba(255,255,255,0.32)'
  if (form === 'network') {
    // 端口阵列：两排小方块
    const ports = []
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 6; c++)
        ports.push(<rect key={`${r}-${c}`} x={cx - 30 + c * 10} y={cy - 6 + r * 7} width={6} height={5} rx={1} fill={ink} />)
    return <g>{ports}</g>
  }
  if (form === 'power') {
    // 插座：一排圆
    return <g>{Array.from({ length: 6 }, (_, i) => (
      <circle key={i} cx={cx - 30 + i * 12} cy={cy} r={3.2} fill="none" stroke={ink} strokeWidth={1.4} />
    ))}</g>
  }
  if (form === 'storage') {
    // 磁盘托架点阵
    const dots = []
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 8; c++)
        dots.push(<circle key={`${r}-${c}`} cx={cx - 35 + c * 10} cy={cy - 4 + r * 8} r={1.8} fill={ink} />)
    return <g>{dots}</g>
  }
  if (form === 'server') {
    // 硬盘托架竖条
    return <g>{Array.from({ length: 8 }, (_, i) => (
      <rect key={i} x={cx - 36 + i * 9} y={cy - 6} width={5} height={12} rx={1} fill={ink} />
    ))}</g>
  }
  // generic：散热栅格横线
  return <g>{Array.from({ length: 4 }, (_, i) => (
    <line key={i} x1={cx - 34} y1={cy - 6 + i * 4} x2={cx + 34} y2={cy - 6 + i * 4} stroke={ink} strokeWidth={1.2} />
  ))}</g>
}

// __MAIN__

interface HoverState { d: RackDevice; x: number; y: number }

export function RackElevationView({ rackId }: { rackId: string }) {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<HoverState | null>(null)

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

  // 占用统计
  const occupied = new Set<number>()
  placed.forEach((d) => {
    for (let u = Math.max(1, d.uStart as number); u <= Math.min(height, d.uEnd as number); u++) occupied.add(u)
  })
  const freeU = height - occupied.size

  const bodyH = height * U_H
  const svgH = bodyH + FRAME * 2
  const rows = Array.from({ length: height }, (_, i) => height - i) // [height..1] 顶→底

  function onMove(e: React.MouseEvent, d: RackDevice) {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    setHover({ d, x: e.clientX - box.left, y: e.clientY - box.top })
  }

  // __RENDER__
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

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-v2-fg">{data.rackName} · 机柜视图</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-v2-muted">
            共 {height}U · 已装 {placed.length} 台 · 空 {freeU}U
            {unplaced.length > 0 && ` · 未定位 ${unplaced.length} 台`}
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

      <div className="flex flex-wrap gap-5">
        {/* __RACKSVG__ */}
        <div ref={wrapRef} className="relative shrink-0">
          <svg
            viewBox={`0 0 ${TOTAL_W} ${svgH}`}
            style={{ height: 'min(70vh, 920px)', width: 'auto', maxWidth: '100%' }}
            role="img"
            aria-label={`${data.rackName} 机柜视图，共 ${height}U`}
          >
            <defs>
              <linearGradient id="rk-frame" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#0b0f17" />
                <stop offset="0.5" stopColor="#1b212e" />
                <stop offset="1" stopColor="#0b0f17" />
              </linearGradient>
              <linearGradient id="rk-rail" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#2a3140" />
                <stop offset="0.5" stopColor="#3a4253" />
                <stop offset="1" stopColor="#222836" />
              </linearGradient>
              <linearGradient id="rk-face" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3c4456" />
                <stop offset="0.5" stopColor="#2e3543" />
                <stop offset="1" stopColor="#262c38" />
              </linearGradient>
            </defs>

            {/* 机架外框 */}
            <rect x="0" y="0" width={TOTAL_W} height={svgH} rx="10" fill="url(#rk-frame)" />
            {/* 设备内腔（暗） */}
            <rect x={BAY_X} y={FRAME} width={BAY_W} height={bodyH} fill="#0a0d14" />

            {/* __RAILS__ */}
            {/* 左右导轨立柱 */}
            <rect x={NUM_W} y={FRAME} width={RAIL_W} height={bodyH} fill="url(#rk-rail)" />
            <rect x={NUM_W + RAIL_W + BAY_W} y={FRAME} width={RAIL_W} height={bodyH} fill="url(#rk-rail)" />
            {rows.map((u) => {
              const top = FRAME + (height - u) * U_H
              const cy = top + U_H / 2
              const holes = [cy - 6, cy, cy + 6]
              const leftHoleX = NUM_W + RAIL_W / 2
              const rightHoleX = NUM_W + RAIL_W + BAY_W + RAIL_W / 2
              return (
                <g key={u}>
                  {/* U 分隔线 */}
                  <line x1={BAY_X} y1={top} x2={BAY_X + BAY_W} y2={top} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                  {/* cage-nut 方孔（左右各 3） */}
                  {holes.map((hy, i) => (
                    <rect key={`l${i}`} x={leftHoleX - 2.5} y={hy - 2.5} width={5} height={5} rx={1} fill="#0a0d14" stroke="rgba(0,0,0,0.6)" strokeWidth={0.5} />
                  ))}
                  {holes.map((hy, i) => (
                    <rect key={`r${i}`} x={rightHoleX - 2.5} y={hy - 2.5} width={5} height={5} rx={1} fill="#0a0d14" stroke="rgba(0,0,0,0.6)" strokeWidth={0.5} />
                  ))}
                  {/* U 编号（两侧） */}
                  <text x={NUM_W - 4} y={cy + 3} textAnchor="end" fontSize={9} fontFamily="var(--v2-font-mono)" fill="#64748b">{u}</text>
                  <text x={TOTAL_W - NUM_W + 4} y={cy + 3} textAnchor="start" fontSize={9} fontFamily="var(--v2-font-mono)" fill="#64748b">{u}</text>
                </g>
              )
            })}
            {/* __DEVICES__ */}
            {placed.map((d) => {
              const span = (d.uEnd as number) - (d.uStart as number) + 1
              const top = FRAME + (height - (d.uEnd as number)) * U_H
              const h = span * U_H
              const cy = top + h / 2
              const stripe = d.modelColor || '#64748b'
              const st = statusMeta(d.status)
              const form = deviceForm(d.modelId)
              return (
                <g
                  key={d.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`${d.name}，${d.modelName}，U${d.uStart}-${d.uEnd}，${st.label}`}
                  className="cursor-pointer outline-none [&:focus-visible_.rk-focus]:opacity-100"
                  onClick={() => router.push(`/cmdb/instances/by-model/${d.modelId}/${d.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/cmdb/instances/by-model/${d.modelId}/${d.id}`) } }}
                  onMouseEnter={(e) => onMove(e, d)}
                  onMouseMove={(e) => onMove(e, d)}
                  onMouseLeave={() => setHover(null)}
                >
                  {/* 面板 */}
                  <rect x={BAY_X + 2} y={top + 1.5} width={BAY_W - 4} height={h - 3} rx={3} fill="url(#rk-face)" stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
                  {/* 上缘高光 */}
                  <line x1={BAY_X + 5} y1={top + 2.5} x2={BAY_X + BAY_W - 5} y2={top + 2.5} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
                  {/* 型号色条 */}
                  <rect x={BAY_X + 2} y={top + 1.5} width={5} height={h - 3} rx={2} fill={stripe} />
                  {/* 名称 */}
                  <text x={BAY_X + 16} y={cy - (span > 1 ? 4 : -3.5)} fontSize={span > 1 ? 12 : 11} fontFamily="var(--v2-font-mono)" fontWeight={600} fill="#e2e8f0">{d.name}</text>
                  {span > 1 && (
                    <text x={BAY_X + 16} y={cy + 11} fontSize={9} fontFamily="var(--v2-font-mono)" fill="#94a3b8">
                      {d.modelName}{d.assetNo ? ` · ${d.assetNo}` : ''}
                    </text>
                  )}
                  {/* 纹理（中右） */}
                  <Texture form={form} cx={BAY_X + BAY_W - 110} cy={cy} />
                  {/* 状态 LED + 呼吸光晕 */}
                  <circle cx={BAY_X + BAY_W - 16} cy={cy} r={6} fill={st.color} opacity={0.22}>
                    <animate attributeName="r" values="6;9;6" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={BAY_X + BAY_W - 16} cy={cy} r={3.2} fill={st.color} stroke="rgba(255,255,255,0.5)" strokeWidth={0.6} />
                  {/* focus 环 */}
                  <rect className="rk-focus opacity-0" x={BAY_X + 2} y={top + 1.5} width={BAY_W - 4} height={h - 3} rx={3} fill="none" stroke="#60a5fa" strokeWidth={2} />
                </g>
              )
            })}
          </svg>
          {/* __TOOLTIP__ */}
          {hover && (
            <div
              className="pointer-events-none absolute z-50 w-60 rounded-lg border border-white/10 bg-[#11161f] p-3 text-xs shadow-xl"
              style={{
                left: Math.min(hover.x + 16, (wrapRef.current?.clientWidth ?? 300) - 248),
                top: hover.y + 12,
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate font-semibold text-slate-100">{hover.d.name}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-300">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: statusMeta(hover.d.status).color }} />
                  {statusMeta(hover.d.status).label}
                </span>
              </div>
              <dl className="space-y-1 font-mono text-slate-400">
                <div className="flex justify-between gap-3"><dt className="text-slate-500">型号</dt><dd className="truncate text-slate-200">{hover.d.modelName}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">U 位</dt><dd className="text-slate-200">U{hover.d.uStart}–{hover.d.uEnd}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">IP</dt><dd className="truncate text-slate-200">{hover.d.innerIp || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">资产号</dt><dd className="truncate text-slate-200">{hover.d.assetNo || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">SN</dt><dd className="truncate text-slate-200">{hover.d.sn || '—'}</dd></div>
              </dl>
              <div className="mt-2 border-t border-white/10 pt-1.5 text-[10px] text-slate-500">点击查看详情</div>
            </div>
          )}
        </div>

        {/* 未定位设备 */}
        {unplaced.length > 0 && (
          <div className="min-w-[220px] flex-1">
            <div className="mb-2 text-xs font-semibold text-v2-muted">未定位设备（缺 U 位）</div>
            <div className="space-y-1.5">
              {unplaced.map((d) => (
                <Link
                  key={d.id}
                  href={`/cmdb/instances/by-model/${d.modelId}/${d.id}`}
                  className="flex items-center gap-2 rounded-md border border-v2-border bg-v2-surface px-3 py-1.5 text-sm text-v2-fg hover:bg-v2-surface-hover"
                >
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.modelColor || '#8C8C8C' }} />
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


