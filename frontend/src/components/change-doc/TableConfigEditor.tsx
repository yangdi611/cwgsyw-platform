'use client'
import { useState, useCallback } from 'react'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { Trash2, Plus, GripVertical, Settings2 } from 'lucide-react'
import type { TableFieldConfig, TableColumnConfig } from './tableFieldTypes'

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
    const next = value.columns.filter((_, i) => i !== idx)
    setColumns(next)
    setExpandedIdx(null)
  }

  const updateColumn = (idx: number, patch: Partial<TableColumnConfig>) => {
    setColumns(value.columns.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  const setTopLevel = (patch: Partial<TableFieldConfig>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-4 rounded-v2-md border border-v2-border bg-v2-surface-soft p-4">
      {/* 行约束 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">最少行数</Label>
          <Input
            type="number"
            min={0}
            value={value.minRows ?? ''}
            onChange={(e) => setTopLevel({ minRows: e.target.value === '' ? undefined : Number(e.target.value) })}
            placeholder="无限制"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">最多行数</Label>
          <Input
            type="number"
            min={0}
            value={value.maxRows ?? ''}
            onChange={(e) => setTopLevel({ maxRows: e.target.value === '' ? undefined : Number(e.target.value) })}
            placeholder="无限制"
          />
        </div>
        <div className="flex items-center gap-4 pt-5">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-v2-fg">
            <input
              type="checkbox"
              checked={value.allowAddRow}
              onChange={(e) => setTopLevel({ allowAddRow: e.target.checked })}
              className="rounded border-v2-border"
            />
            允许增行
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-v2-fg">
            <input
              type="checkbox"
              checked={value.allowDeleteRow}
              onChange={(e) => setTopLevel({ allowDeleteRow: e.target.checked })}
              className="rounded border-v2-border"
            />
            允许删行
          </label>
        </div>
      </div>

      {/* 列列表 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs font-bold">列配置（{value.columns.length} 列）</Label>
          <Button variant="ghost" size="sm" onClick={addColumn} className="h-7 text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" />
            添加列
          </Button>
        </div>
        {value.columns.length === 0 && (
          <p className="py-3 text-center text-xs text-v2-muted">暂无列，点击&ldquo;添加列&rdquo;</p>
        )}
        <div className="space-y-1">
          {value.columns.map((col, idx) => (
            <div key={idx} className="rounded-md border border-v2-border bg-v2-surface">
              <div className="flex items-center gap-2 px-3 py-2">
                <GripVertical className="h-3.5 w-3.5 cursor-grab text-v2-muted" />
                <span className="flex-1 text-xs font-medium text-v2-fg">
                  {col.label || <span className="text-v2-muted">（未命名列）</span>}
                  <span className="ml-2 text-v2-muted">[{col.key || '?'}]</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-v2-muted"
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-v2-danger"
                  onClick={() => removeColumn(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {expandedIdx === idx && (
                <div className="grid grid-cols-2 gap-3 border-t border-v2-border px-3 py-3">
                  <div className="space-y-1">
                    <Label className="text-xs">列 Key（对应占位符后缀）</Label>
                    <Input
                      value={col.key}
                      onChange={(e) => updateColumn(idx, { key: e.target.value })}
                      placeholder="如 server_name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">列标签（表头显示）</Label>
                    <Input
                      value={col.label}
                      onChange={(e) => updateColumn(idx, { label: e.target.value })}
                      placeholder="如 服务器名称"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">类型</Label>
                    <Select value={col.type} onValueChange={(v) => updateColumn(idx, { type: v as TableColumnConfig['type'] })}>
                      <SelectTrigger>
                        <SelectValue>
                          {(v: string) => COLUMN_TYPES.find((t) => t.value === v)?.label ?? v}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-4 pt-5">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-v2-fg">
                      <input
                        type="checkbox"
                        checked={col.required ?? false}
                        onChange={(e) => updateColumn(idx, { required: e.target.checked })}
                        className="rounded border-v2-border"
                      />
                      必填
                    </label>
                  </div>
                  {col.type === 'select' && (
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">选项（每行一个，格式 value:标签，如 yes:是）</Label>
                      <textarea
                        className="w-full rounded-md border border-v2-border bg-v2-surface p-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-v2-primary"
                        rows={4}
                        value={(col.options ?? []).map((o) => `${o.value}:${o.label}`).join('\n')}
                        onChange={(e) => {
                          const opts = e.target.value
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .map((line) => {
                              const sep = line.indexOf(':')
                              return sep >= 0
                                ? { value: line.slice(0, sep).trim(), label: line.slice(sep + 1).trim() }
                                : { value: line, label: line }
                            })
                          updateColumn(idx, { options: opts })
                        }}
                        placeholder={"yes:是\nno:否"}
                      />
                    </div>
                  )}
                  {col.type !== 'checkbox' && col.type !== 'select' && (
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">占位提示文字（可选）</Label>
                      <Input
                        value={col.placeholder ?? ''}
                        onChange={(e) => updateColumn(idx, { placeholder: e.target.value })}
                        placeholder="例如：请输入…"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
