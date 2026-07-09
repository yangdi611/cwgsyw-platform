import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CiAttributeVO } from './types'

export function renderEditField(attr: CiAttributeVO, value: string, onChange: (v: string) => void) {
  const { fieldType, option, placeholder } = attr
  const ph = placeholder ?? ''
  if (fieldType === 'longchar') return <Textarea value={value} onChange={e => onChange(e.target.value)} rows={3} />
  if (fieldType === 'enum' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    return (
      <Select value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger><SelectValue placeholder="请选择">{(v: string) => opts.find(o => o.id === v)?.name ?? '请选择'}</SelectValue></SelectTrigger>
        <SelectContent>{opts.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
      </Select>
    )
  }
  if (fieldType === 'enummulti' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    const selected: string[] = (() => { try { return JSON.parse(value || '[]') } catch { return [] } })()
    const toggle = (id: string) => {
      const next = selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]
      onChange(JSON.stringify(next))
    }
    return (
      <div className="flex flex-wrap gap-3 pt-2">
        {opts.map(o => (
          <label key={o.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} className="rounded" />
            {o.name}
          </label>
        ))}
      </div>
    )
  }
  if (fieldType === 'bool') {
    return (
      <Select value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger>
          <SelectValue>{(v: string) => (v === 'true' ? '是' : v === 'false' ? '否' : '')}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">是</SelectItem>
          <SelectItem value="false">否</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  if (fieldType === 'date') return <Input type="date" value={value} onChange={e => onChange(e.target.value)} />
  if (fieldType === 'int' || fieldType === 'float') return <Input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />
  return <Input value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />
}
