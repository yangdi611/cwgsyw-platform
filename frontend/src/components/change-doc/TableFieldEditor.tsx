'use client'

import type { TableFieldConfig, TableRow } from './tableFieldTypes'
import { createBlankRow } from './tableFieldTypes'
import '@/design-system/figma-neutral/index.css'
import { Button, Checkbox, IconButton, Input, Select, Textarea } from '@/design-system/figma-neutral/components'

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
  const removeRow = (rowId: string) => onChange(rows.filter((row) => row.rowId !== rowId))
  const updateCell = (rowId: string, key: string, value: unknown) =>
    onChange(rows.map((row) => (row.rowId === rowId ? { ...row, [key]: value } : row)))

  return (
    <div className="cwgsyw-form">
      <table className="cwgsyw-table">
        <thead>
          <tr>
            {config.columns.map((column) => (
              <th key={column.key}>
                {column.label}
                {column.required ? ' *' : ''}
              </th>
            ))}
            {!disabled ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={config.columns.length + 1}>
                暂无数据{!disabled && canAdd ? '，点击下方"添加行"' : ''}
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr key={row.rowId}>
              {config.columns.map((column) => (
                <td key={column.key}>
                  {renderCell(column, row[column.key], disabled ?? false, (value) => updateCell(row.rowId, column.key, value))}
                </td>
              ))}
              {!disabled ? (
                <td>
                  {canDelete ? (
                    <IconButton type="button" variant="ghost" size="sm" icon="trash" aria-label="删除行" onClick={() => removeRow(row.rowId)} />
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {!disabled && canAdd ? (
        <Button type="button" variant="ghost" size="sm" onClick={addRow}>
          添加行
        </Button>
      ) : null}
    </div>
  )
}

function renderCell(
  column: TableFieldConfig['columns'][number],
  value: unknown,
  disabled: boolean,
  onChange: (value: unknown) => void,
) {
  if (disabled) {
    if (column.type === 'checkbox') return <span>{value ? '是' : '否'}</span>
    if (column.type === 'select') {
      const option = column.options?.find((item) => item.value === String(value))
      return <span>{option ? option.label : String(value ?? '—')}</span>
    }
    return <span>{value ? String(value) : '—'}</span>
  }

  switch (column.type) {
    case 'textarea':
      return (
        <Textarea
          rows={2}
          value={String(value ?? '')}
          placeholder={column.placeholder ?? undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )
    case 'number':
      return (
        <Input
          type="number"
          value={String(value ?? '')}
          placeholder={column.placeholder ?? undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )
    case 'date':
      return <Input type="date" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
    case 'datetime':
      return <Input type="datetime-local" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} />
    case 'checkbox':
      return <Checkbox label="勾选" showLabel={false} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
    case 'select':
      return (
        <Select
          value={String(value ?? '')}
          placeholder="请选择"
          options={column.options ?? []}
          onChange={(next) => onChange(next)}
        />
      )
    default:
      return (
        <Input
          value={String(value ?? '')}
          placeholder={column.placeholder ?? undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )
  }
}
