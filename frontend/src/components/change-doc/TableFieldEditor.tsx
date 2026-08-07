'use client'
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@/components/design-system'
import { Plus, Trash2 } from 'lucide-react'
import type { TableFieldConfig, TableRow } from './tableFieldTypes'
import { createBlankRow } from './tableFieldTypes'

interface Props {
  config: TableFieldConfig
  rows: TableRow[]
  onChange: (rows: TableRow[]) => void
  disabled?: boolean
}

export function TableFieldEditor({ config, rows, onChange, disabled }: Props) {
  const canAdd = config.allowAddRow && (config.maxRows === undefined || rows.length < config.maxRows)
  const canDelete = config.allowDeleteRow && (config.minRows === undefined || rows.length > config.minRows)

  const addRow = () => onChange([...rows, createBlankRow(config)])
  const removeRow = (rowId: string) => onChange(rows.filter((r) => r.rowId !== rowId))
  const updateCell = (rowId: string, key: string, value: unknown) =>
    onChange(rows.map((r) => (r.rowId === rowId ? { ...r, [key]: value } : r)))

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-v2-md border border-v2-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-v2-border bg-v2-surface-soft">
              {config.columns.map((col) => (
                <th key={col.key} className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-v2-fg">
                  {col.label}
                  {col.required && <span className="ml-0.5 text-v2-danger">*</span>}
                </th>
              ))}
              {!disabled && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={config.columns.length + 1} className="py-4 text-center text-xs text-v2-muted">
                  暂无数据{!disabled && canAdd ? '，点击下方"添加行"' : ''}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.rowId} className="border-b border-v2-border last:border-0">
                {config.columns.map((col) => (
                  <td key={col.key} className="p-1.5 align-top">
                    {renderCell(col, row[col.key], disabled ?? false, (v) => updateCell(row.rowId, col.key, v))}
                  </td>
                ))}
                {!disabled && (
                  <td className="p-1.5 align-top">
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-v2-danger"
                        onClick={() => removeRow(row.rowId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && canAdd && (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addRow}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          添加行
        </Button>
      )}
    </div>
  )
}

function renderCell(
  col: TableFieldConfig['columns'][number],
  value: unknown,
  disabled: boolean,
  onChange: (v: unknown) => void,
) {
  if (disabled) {
    if (col.type === 'checkbox') return <span className="text-xs text-v2-fg">{value ? '是' : '否'}</span>
    if (col.type === 'select') {
      const opt = col.options?.find((o) => o.value === String(value))
      return <span className="text-xs text-v2-fg">{opt ? opt.label : String(value ?? '—')}</span>
    }
    return <span className="whitespace-pre-wrap text-xs text-v2-fg">{value ? String(value) : '—'}</span>
  }

  switch (col.type) {
    case 'textarea':
      return (
        <Textarea
          className="min-w-[10rem] text-xs"
          rows={2}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={col.placeholder ?? undefined}
        />
      )
    case 'number':
      return (
        <Input
          type="number"
          className="min-w-[6rem] text-xs"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={col.placeholder ?? undefined}
        />
      )
    case 'date':
      return (
        <Input
          type="date"
          className="min-w-[9rem] text-xs"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'datetime':
      return (
        <Input
          type="datetime-local"
          className="min-w-[11rem] text-xs"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-v2-border"
        />
      )
    case 'select':
      return (
        <Select value={String(value ?? '')} onValueChange={(v) => onChange(v ?? '')}>
          <SelectTrigger className="h-8 min-w-[8rem] text-xs"><SelectValue placeholder="请选择" /></SelectTrigger>
          <SelectContent>
            {(col.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    default:
      return (
        <Input
          className="min-w-[8rem] text-xs"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={col.placeholder ?? undefined}
        />
      )
  }
}
