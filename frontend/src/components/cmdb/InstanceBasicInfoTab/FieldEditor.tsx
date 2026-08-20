import { Checkbox, Input, Select, Textarea } from '@/design-system/figma-neutral/components'
import type { CiAttributeVO } from './types'

export function renderEditField(attr: CiAttributeVO, value: string, onChange: (v: string) => void) {
  const { fieldType, option, placeholder } = attr
  const ph = placeholder ?? ''
  if (fieldType === 'longchar') {
    return <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
  }
  if (fieldType === 'enum' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    return (
      <Select size="sm" overlay
        value={value}
        placeholder="请选择"
        options={opts.map((o) => ({ value: o.id, label: o.name }))}
        onChange={onChange}
      />
    )
  }
  if (fieldType === 'enummulti' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    const selected: string[] = (() => { try { return JSON.parse(value || '[]') } catch { return [] } })()
    const toggle = (id: string) => {
      const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
      onChange(JSON.stringify(next))
    }
    return (
      <div className="cwgsyw-inline-controls">
        {opts.map((o) => (
          <Checkbox
            key={o.id}
            label={o.name}
            checked={selected.includes(o.id)}
            onChange={() => toggle(o.id)}
          />
        ))}
      </div>
    )
  }
  if (fieldType === 'bool') {
    return (
      <Select size="sm" overlay
        value={value}
        placeholder="请选择"
        options={[
          { value: 'true', label: '是' },
          { value: 'false', label: '否' },
        ]}
        onChange={onChange}
      />
    )
  }
  if (fieldType === 'date') return <Input size="sm" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  if (fieldType === 'int' || fieldType === 'float') {
    return <Input size="sm" type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} />
  }
  return <Input size="sm" value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} />
}
