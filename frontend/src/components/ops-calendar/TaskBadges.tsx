'use client'

import { statusLabel, statusTone, taskTypeLabel, taskTypeColor } from '@/lib/opsCalendar'

const TONE_STYLE: Record<string, { bg: string; fg: string }> = {
  ok:      { bg: 'rgba(34,197,94,0.12)',  fg: '#16a34a' },
  warn:    { bg: 'rgba(245,158,11,0.14)', fg: '#d97706' },
  danger:  { bg: 'rgba(239,68,68,0.12)',  fg: '#dc2626' },
  neutral: { bg: 'rgba(148,163,184,0.16)', fg: '#64748b' },
}

/** 任务状态徽标 */
export function TaskStatusBadge({ status }: { status: string }) {
  const tone = TONE_STYLE[statusTone(status)] ?? TONE_STYLE.neutral
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.fg }} />
      {statusLabel(status)}
    </span>
  )
}

/** 任务类型徽标 */
export function TaskTypeBadge({ taskType }: { taskType: string }) {
  const color = taskTypeColor(taskType)
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ background: `${color}1f`, color }}
    >
      {taskTypeLabel(taskType)}
    </span>
  )
}
