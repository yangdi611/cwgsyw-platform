'use client'

import { useCallback, useState } from 'react'
import type { TableColumnConfig, TableFieldConfig } from './tableFieldTypes'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Checkbox,
  Field,
  IconButton,
  Input,
  Select,
  Textarea,
} from '@/design-system/figma-neutral/components'

const COLUMN_TYPES: { value: TableColumnConfig['type']; label: string }[] = [
  { value: 'text', label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'number', label: '数字' },
  { value: 'date', label: '日期' },
  { value: 'datetime', label: '日期时间' },
  { value: 'select', label: '下拉选择' },
  { value: 'checkbox', label: '布尔值（勾选）' },
]

interface Props {
  value: TableFieldConfig
  onChange: (next: TableFieldConfig) => void
}

function emptyColumn(): TableColumnConfig {
  return { key: '', label: '', type: 'text', required: false }
}

export function TableConfigEditor({ value, onChange }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const setColumns = useCallback(
    (cols: TableColumnConfig[]) => onChange({ ...value, columns: cols }),
    [value, onChange],
  )

  const addColumn = () => {
    setColumns([...value.columns, emptyColumn()])
    setExpandedIdx(value.columns.length)
  }

  const removeColumn = (idx: number) => {
    setColumns(value.columns.filter((_, index) => index !== idx))
    setExpandedIdx(null)
  }

  const updateColumn = (idx: number, patch: Partial<TableColumnConfig>) => {
    setColumns(value.columns.map((column, index) => (index === idx ? { ...column, ...patch } : column)))
  }

  const setTopLevel = (patch: Partial<TableFieldConfig>) => onChange({ ...value, ...patch })

  return (
    <div className="cwgsyw-form">
      <div className="cwgsyw-form">
        <Field htmlFor="table-min-rows" label="最少行数">
          <Input
            type="number"
            min={0}
            value={value.minRows ?? ''}
            placeholder="无限制"
            onChange={(event) => setTopLevel({ minRows: event.target.value === '' ? undefined : Number(event.target.value) })}
          />
        </Field>
        <Field htmlFor="table-max-rows" label="最多行数">
          <Input
            type="number"
            min={0}
            value={value.maxRows ?? ''}
            placeholder="无限制"
            onChange={(event) => setTopLevel({ maxRows: event.target.value === '' ? undefined : Number(event.target.value) })}
          />
        </Field>
        <div className="cwgsyw-designer__actions">
          <Checkbox
            label="允许增行"
            checked={value.allowAddRow}
            onChange={(event) => setTopLevel({ allowAddRow: event.target.checked })}
          />
          <Checkbox
            label="允许删行"
            checked={value.allowDeleteRow}
            onChange={(event) => setTopLevel({ allowDeleteRow: event.target.checked })}
          />
        </div>
      </div>

      <div className="cwgsyw-form">
        <div className="cwgsyw-designer__actions">
          <strong>列配置（{value.columns.length} 列）</strong>
          <Button type="button" variant="ghost" size="sm" onClick={addColumn}>
            添加列
          </Button>
        </div>
        {value.columns.length === 0 ? <p>暂无列，点击“添加列”</p> : null}
        {value.columns.map((column, idx) => (
          <div key={`${column.key || 'col'}-${idx}`} className="cwgsyw-form">
            <div className="cwgsyw-designer__actions">
              <span>
                {column.label || '（未命名列）'} [{column.key || '?'}]
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}>
                {expandedIdx === idx ? '收起' : '展开'}
              </Button>
              <IconButton type="button" variant="ghost" size="sm" icon="trash" aria-label="删除列" onClick={() => removeColumn(idx)} />
            </div>
            {expandedIdx === idx ? (
              <div className="cwgsyw-form">
                <Field htmlFor={`col-key-${idx}`} label="列 Key（对应占位符后缀）">
                  <Input value={column.key} placeholder="如 server_name" onChange={(event) => updateColumn(idx, { key: event.target.value })} />
                </Field>
                <Field htmlFor={`col-label-${idx}`} label="列标签（表头显示）">
                  <Input value={column.label} placeholder="如 服务器名称" onChange={(event) => updateColumn(idx, { label: event.target.value })} />
                </Field>
                <Field htmlFor={`col-type-${idx}`} label="类型">
                  <Select
                    value={column.type}
                    options={COLUMN_TYPES}
                    onChange={(next) => updateColumn(idx, { type: next as TableColumnConfig['type'] })}
                  />
                </Field>
                <Checkbox
                  label="必填"
                  checked={column.required ?? false}
                  onChange={(event) => updateColumn(idx, { required: event.target.checked })}
                />
                {column.type === 'select' ? (
                  <Field htmlFor={`col-options-${idx}`} label="选项（每行一个，格式 value:标签，如 yes:是）">
                    <Textarea
                      rows={4}
                      value={(column.options ?? []).map((option) => `${option.value}:${option.label}`).join('\n')}
                      placeholder={'yes:是\nno:否'}
                      onChange={(event) => {
                        const options = event.target.value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean)
                          .map((line) => {
                            const sep = line.indexOf(':')
                            return sep >= 0
                              ? { value: line.slice(0, sep).trim(), label: line.slice(sep + 1).trim() }
                              : { value: line, label: line }
                          })
                        updateColumn(idx, { options })
                      }}
                    />
                  </Field>
                ) : null}
                {column.type !== 'checkbox' && column.type !== 'select' ? (
                  <Field htmlFor={`col-placeholder-${idx}`} label="占位提示文字（可选）">
                    <Input
                      value={column.placeholder ?? ''}
                      placeholder="例如：请输入…"
                      onChange={(event) => updateColumn(idx, { placeholder: event.target.value })}
                    />
                  </Field>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
