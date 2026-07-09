import type { CiAttributeVO } from './types'

export function renderDisplayValue(attr: CiAttributeVO, rawVal: unknown) {
  if (rawVal == null || rawVal === '') {
    return <span className="text-sm text-v2-subtle">—</span>
  }
  const { fieldType, option } = attr
  if (fieldType === 'enum' && Array.isArray(option)) {
    const found = (option as { id: string; name: string }[]).find(o => o.id === String(rawVal))
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-v2-border bg-v2-surface text-xs font-medium text-v2-fg">
        {found?.name ?? String(rawVal)}
      </span>
    )
  }
  if (fieldType === 'enummulti' && Array.isArray(option)) {
    let ids: string[] = []
    try { ids = JSON.parse(String(rawVal)) } catch { ids = [] }
    const opts = option as { id: string; name: string }[]
    if (ids.length === 0) return <span className="text-sm text-v2-subtle">—</span>
    return (
      <div className="flex flex-wrap gap-1.5">
        {ids.map(id => {
          const found = opts.find(o => o.id === id)
          return (
            <span key={id} className="inline-flex items-center px-2 py-0.5 rounded-md border border-v2-border bg-v2-surface text-xs font-medium text-v2-fg">
              {found?.name ?? id}
            </span>
          )
        })}
      </div>
    )
  }
  if (fieldType === 'bool') {
    return <span className="text-sm text-v2-fg">{String(rawVal) === 'true' ? '是' : '否'}</span>
  }
  if (fieldType === 'int' || fieldType === 'float') {
    return <span className="font-v2-mono tabular-nums text-sm text-v2-fg">{String(rawVal)}</span>
  }
  if (fieldType === 'longchar') {
    return <p className="text-sm text-v2-fg whitespace-pre-wrap break-words leading-relaxed">{String(rawVal)}</p>
  }
  return <span className="text-sm text-v2-fg break-words">{String(rawVal)}</span>
}
