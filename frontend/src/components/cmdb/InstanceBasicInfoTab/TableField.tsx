import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/design-system'
import { Plus, X } from 'lucide-react'
import { schemaCols, rowKeyOf, genRowId } from './types'

export function TableFieldDisplay({ schema, rows }: { schema: unknown; rows: Record<string, unknown>[] }) {
  const cols = schemaCols(schema).filter(c => !c.system)
  if (!rows || rows.length === 0) return <span className="text-sm text-v2-subtle">—</span>
  if (cols.length === 0) return <span className="text-sm text-v2-muted">{rows.length} 项</span>
  return (
    <div className="overflow-x-auto rounded-md border border-v2-border">
      <table className="w-full text-xs">
        <thead className="bg-v2-surface-soft">
          <tr>{cols.map(c => <th key={c.key} className="px-2 py-1 text-left font-medium text-v2-muted">{c.name}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-v2-border">
              {cols.map(c => {
                const v = row[c.key]
                const disp = c.type === 'enum' && Array.isArray(c.options)
                  ? (c.options.find(o => o.id === String(v))?.name ?? (v == null ? '—' : String(v)))
                  : (v == null || v === '' ? '—' : String(v))
                return <td key={c.key} className="px-2 py-1 text-v2-fg">{disp}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TableFieldEditor({
  schema, rows, onChange,
}: { schema: unknown; rows: Record<string, unknown>[]; onChange: (rows: Record<string, unknown>[]) => void }) {
  const cols = schemaCols(schema)
  const rowKey = rowKeyOf(schema)
  const visibleCols = cols.filter(c => !c.system)

  const updateCell = (rowIdx: number, key: string, val: unknown) => {
    const next = rows.map((r, i) => (i === rowIdx ? { ...r, [key]: val } : r))
    onChange(next)
  }
  const addRow = () => {
    const blank: Record<string, unknown> = { [rowKey]: genRowId() }
    for (const c of visibleCols) blank[c.key] = ''
    onChange([...rows, blank])
  }
  const removeRow = (rowIdx: number) => onChange(rows.filter((_, i) => i !== rowIdx))

  if (visibleCols.length === 0) {
    return <p className="text-xs text-v2-danger">该表格字段尚未配置子列 schema（请在模型属性编辑里设置）。</p>
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-v2-border">
        <table className="w-full text-xs">
          <thead className="bg-v2-surface-soft">
            <tr>
              {visibleCols.map(c => (
                <th key={c.key} className="px-2 py-1 text-left font-medium text-v2-muted">
                  {c.name}{c.required && <span className="text-v2-danger">*</span>}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={String(row[rowKey] ?? i)} className="border-t border-v2-border">
                {visibleCols.map(c => (
                  <td key={c.key} className="px-1 py-1">
                    {c.type === 'enum' && Array.isArray(c.options) ? (
                      <Select value={String(row[c.key] ?? '')} onValueChange={v => updateCell(i, c.key, v ?? '')}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="选择">{(v: string) => c.options?.find(o => o.id === v)?.name ?? '选择'}</SelectValue></SelectTrigger>
                        <SelectContent>{c.options.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : c.type === 'bool' ? (
                      <Select value={String(row[c.key] ?? '')} onValueChange={v => updateCell(i, c.key, v === 'true')}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="—">
                            {(v: string) => (v === 'true' ? '是' : v === 'false' ? '否' : '—')}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent><SelectItem value="true">是</SelectItem><SelectItem value="false">否</SelectItem></SelectContent>
                      </Select>
                    ) : c.type === 'int' || c.type === 'float' ? (
                      <Input className="h-8" type="number" value={String(row[c.key] ?? '')} onChange={e => updateCell(i, c.key, e.target.value)} />
                    ) : (
                      <Input className="h-8" value={String(row[c.key] ?? '')} onChange={e => updateCell(i, c.key, e.target.value)} />
                    )}
                  </td>
                ))}
                <td className="px-1 py-1 text-center">
                  <button type="button" onClick={() => removeRow(i)} className="text-v2-danger hover:opacity-70" title="删除行">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={visibleCols.length + 1} className="px-2 py-3 text-center text-v2-subtle">暂无数据，点击下方添加行</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={addRow}>
        <Plus className="h-3.5 w-3.5 mr-1" />添加行
      </Button>
    </div>
  )
}
