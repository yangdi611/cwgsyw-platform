import type { CiAttributeVO } from './types'
import { Chip } from '@/design-system/figma-neutral/components'

export function renderDisplayValue(attr: CiAttributeVO, rawVal: unknown) {
  if (rawVal == null || rawVal === '') {
    return <span className="cwgsyw-type-body-sm">—</span>
  }
  const { fieldType, option } = attr
  if (fieldType === 'enum' && Array.isArray(option)) {
    const found = (option as { id: string; name: string }[]).find((o) => o.id === String(rawVal))
    return <Chip label={found?.name ?? String(rawVal)} />
  }
  if (fieldType === 'enummulti' && Array.isArray(option)) {
    let ids: string[] = []
    try { ids = JSON.parse(String(rawVal)) } catch { ids = [] }
    const opts = option as { id: string; name: string }[]
    if (ids.length === 0) return <span className="cwgsyw-type-body-sm">—</span>
    return (
      <div className="cwgsyw-inline-controls">
        {ids.map((id) => {
          const found = opts.find((o) => o.id === id)
          return <Chip key={id} label={found?.name ?? id} />
        })}
      </div>
    )
  }
  if (fieldType === 'bool') {
    return <span className="cwgsyw-type-body-sm">{String(rawVal) === 'true' ? '是' : '否'}</span>
  }
  if (fieldType === 'int' || fieldType === 'float') {
    return <span className="cwgsyw-type-body-sm">{String(rawVal)}</span>
  }
  if (fieldType === 'longchar') {
    return <p className="cwgsyw-type-body-sm">{String(rawVal)}</p>
  }
  return <span className="cwgsyw-type-body-sm">{String(rawVal)}</span>
}
