import { Button, IconButton, Input, Select, Table } from '@/design-system/figma-neutral/components'
import { schemaCols, rowKeyOf, genRowId } from './types'

export function TableFieldDisplay({ schema, rows }: { schema: unknown; rows: Record<string, unknown>[] }) {
  const cols = schemaCols(schema).filter((c) => !c.system)
  if (!rows || rows.length === 0) return <span className="cwgsyw-type-body-sm">—</span>
  if (cols.length === 0) return <span className="cwgsyw-type-body-sm">{rows.length} 项</span>
  return (
    <Table
      showSearch={false}
      density="compact"
      columns={cols.map((c) => ({ key: c.key, label: c.name }))}
      rows={rows.map((row, i) => ({
        id: String(i),
        cells: Object.fromEntries(cols.map((c) => {
          const v = row[c.key]
          const disp = c.type === 'enum' && Array.isArray(c.options)
            ? (c.options.find((o) => o.id === String(v))?.name ?? (v == null ? '—' : String(v)))
            : (v == null || v === '' ? '—' : String(v))
          return [c.key, disp]
        })),
      }))}
    />
  )
}

export function TableFieldEditor({
  schema, rows, onChange,
}: { schema: unknown; rows: Record<string, unknown>[]; onChange: (rows: Record<string, unknown>[]) => void }) {
  const cols = schemaCols(schema)
  const rowKey = rowKeyOf(schema)
  const visibleCols = cols.filter((c) => !c.system)

  const updateCell = (rowIdx: number, key: string, val: unknown) => {
    onChange(rows.map((r, i) => (i === rowIdx ? { ...r, [key]: val } : r)))
  }
  const addRow = () => {
    const blank: Record<string, unknown> = { [rowKey]: genRowId() }
    for (const c of visibleCols) blank[c.key] = ''
    onChange([...rows, blank])
  }
  const removeRow = (rowIdx: number) => onChange(rows.filter((_, i) => i !== rowIdx))

  if (visibleCols.length === 0) {
    return <p className="cwgsyw-type-body-sm">该表格字段尚未配置子列 schema（请在模型属性编辑里设置）。</p>
  }

  return (
    <div className="cwgsyw-stack-list">
      <Table
        showSearch={false}
        density="compact"
        state={rows.length === 0 ? 'empty' : 'data'}
        empty="暂无数据，点击下方添加行"
        columns={[...visibleCols.map((c) => ({ key: c.key, label: c.required ? `${c.name} *` : c.name })), { key: '_remove', label: '' }]}
        rows={rows.map((row, i) => ({
          id: String(row[rowKey] ?? i),
          cells: {
            ...Object.fromEntries(visibleCols.map((c) => [
              c.key,
              c.type === 'enum' && Array.isArray(c.options) ? (
                <Select
                  size="sm"
                  value={String(row[c.key] ?? '')}
                  placeholder="选择"
                  options={c.options.map((o) => ({ value: o.id, label: o.name }))}
                  onChange={(v) => updateCell(i, c.key, v)}
                />
              ) : c.type === 'bool' ? (
                <Select
                  size="sm"
                  value={String(row[c.key] ?? '')}
                  placeholder="—"
                  options={[
                    { value: 'true', label: '是' },
                    { value: 'false', label: '否' },
                  ]}
                  onChange={(v) => updateCell(i, c.key, v === 'true')}
                />
              ) : c.type === 'int' || c.type === 'float' ? (
                <Input size="sm" type="number" value={String(row[c.key] ?? '')} onChange={(e) => updateCell(i, c.key, e.target.value)} />
              ) : (
                <Input size="sm" value={String(row[c.key] ?? '')} onChange={(e) => updateCell(i, c.key, e.target.value)} />
              ),
            ])),
            _remove: (
              <IconButton
                size="sm"
                variant="ghost"
                icon="trash"
                aria-label="删除行"
                onClick={() => removeRow(i)}
              />
            ),
          },
        }))}
      />
      <Button type="button" size="sm" variant="secondary" onClick={addRow}>
        添加行
      </Button>
    </div>
  )
}
