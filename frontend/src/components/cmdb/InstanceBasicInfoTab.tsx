'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Pencil, Save, X, Plus } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface TableColumn { key: string; name: string; type: string; system?: boolean; required?: boolean; options?: { id: string; name: string }[] }
interface TableSchema { schema_version?: number; row_key?: string; display_key?: string; columns: TableColumn[] }
interface CiAttributeVO {
  id: number; fieldKey: string; name: string; fieldType: string
  // option：enum 为数组 [{id,name}]；table 为对象 schema {columns:[...]}（§4.1）。
  isRequired: boolean; isEditable: boolean; option: { id: string; name: string; isDefault?: boolean }[] | TableSchema | null
  placeholder: string; unit: string; sortOrder: number; groupId: string
}
interface CiAttributeGroupVO { groupId: string; name: string; sortOrder: number }
interface CiModelVO { attributeGroups: CiAttributeGroupVO[] }

interface CiInstanceVO {
  id: number; modelId: string; name: string
  fieldsData: Record<string, unknown>
  attributes: CiAttributeVO[]
}

interface Props {
  modelCode: string
  inst: CiInstanceVO
}

/**
 * Basic-info tab for the instance detail view. Renders attribute groups (read
 * mode) and an inline edit mode with per-field dynamic controls via
 * {@link renderEditField}. Self-contained: fetches its own model (for group
 * names) and owns the edit/save state that previously lived in the page.
 */
export function InstanceBasicInfoTab({ modelCode, inst }: Props) {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [prevInstId, setPrevInstId] = useState(inst.id)
  // 值类型放宽为 unknown：标量保持 string，table 字段保留对象数组（§4.3b，避免 §0.12 的 String() 损坏数组）。
  const [editAttrs, setEditAttrs] = useState<Record<string, unknown>>({})

  const modelRes = useQuery({
    queryKey: ['cmdb-model', modelCode],
    queryFn: () => api.get(`/cmdb/models/${modelCode}`).then(r => r.data.data),
    staleTime: 600_000, // models rarely change during a session
  })
  const model: CiModelVO | undefined = modelRes.data
  // 进入编辑时按字段类型分流：table 保留原数组，其余 String 化（沿用原标量路径）。
  const tableKeys = useMemo(
    () => new Set((inst.attributes ?? []).filter(a => a.fieldType === 'table').map(a => a.fieldKey)),
    [inst],
  )
  const freshAttrs = useMemo(() => Object.fromEntries(
    Object.entries(inst.fieldsData ?? {}).map(([k, v]) =>
      tableKeys.has(k) ? [k, Array.isArray(v) ? v : []] : [k, String(v ?? '')],
    )
  ), [inst, tableKeys])

  // Reset editAttrs when instance changes (render-time conditional setState,
  // avoids set-state-in-effect that triggers inside useEffect).
  if (prevInstId !== inst.id) {
    setPrevInstId(inst.id)
    setEditAttrs(freshAttrs)
  }

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/cmdb/instances/${inst.id}`, {
      fieldsData: Object.fromEntries(Object.entries(editAttrs).filter(([k]) => !k.startsWith('_'))),
    }),
    onSuccess: () => {
      toast.success('已保存')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['cmdb-instance', modelCode, String(inst.id)] })
    },
    onError: (e: Error) => {
      const apiErr = e as { response?: { data?: { message?: string } } }
      toast.error(apiErr?.response?.data?.message ?? '保存失败')
    },
  })

  const canEdit = hasPermission('cmdb_instance', 'update')
  const fieldConfig = inst.attributes ?? []
  const groupNames = Object.fromEntries(
    (model?.attributeGroups ?? []).map(g => [g.groupId, g.name])
  )
  const attrsByGroup = fieldConfig.reduce((acc, a) => {
    const g = a.groupId || 'default'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {} as Record<string, CiAttributeVO[]>)
  const groupIds = [...new Set(fieldConfig.map(a => a.groupId || 'default'))]

  // Pre-compute grid layout per group (for lg 3-col view): row index + col-span
  // — used to (a) extend orphan cells to full row, (b) drop border-b on last-row cells.
  const COLS = 3
  const layoutByGroup = useMemo(() => {
    const result: Record<string, Array<{ row: number; col: number; span: number }>> = {}
    for (const gid of Object.keys(attrsByGroup)) {
      const sorted = [...attrsByGroup[gid]].sort((a, b) => a.sortOrder - b.sortOrder)
      const positions: Array<{ row: number; col: number; span: number }> = []
      let row = 0
      let col = 0
      for (const attr of sorted) {
        if (attr.fieldType === 'longchar') {
          if (col !== 0) { row++; col = 0 }
          positions.push({ row, col: 0, span: COLS })
          row++; col = 0
        } else {
          positions.push({ row, col, span: 1 })
          col++
          if (col >= COLS) { row++; col = 0 }
        }
      }
      // Mark orphan: if a run of consecutive non-wide cells ends with 1-cell row, expand it
      let runStart = 0
      for (let i = 0; i <= sorted.length; i++) {
        const isWideOrEnd = i === sorted.length || sorted[i].fieldType === 'longchar'
        if (isWideOrEnd) {
          const runLen = i - runStart
          if (runLen > 0 && runLen % COLS === 1) {
            positions[i - 1].span = COLS
          }
          runStart = i + 1
        }
      }
      result[gid] = positions
    }
    return result
  }, [attrsByGroup])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MaintStatusBadge value={inst.fieldsData?.['_maint_status_derived']} expire={inst.fieldsData?.['maint_expire']} />
        <BaselineBadge value={inst.fieldsData?.['_baseline_completeness']} />
      </div>
      {canEdit && (
        <div className="flex justify-end gap-2">
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />编辑
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />保存
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" />取消
              </Button>
            </>
          )}
        </div>
      )}

      {groupIds.map(groupId => {
        const attrs = (attrsByGroup[groupId] ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
        const layout = layoutByGroup[groupId] ?? []
        const lastRow = layout.length > 0 ? layout[layout.length - 1].row : 0
        return (
          <div key={groupId} className="overflow-hidden rounded-xl border border-v2-border bg-v2-surface">
            {groupNames[groupId] && (
              <div className="px-4 py-2 border-b border-v2-border bg-v2-surface-soft">
                <span className="text-xs font-bold uppercase tracking-wider text-v2-muted">
                  {groupNames[groupId]}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {attrs.map((attr, idx) => {
                const rawVal = inst.fieldsData?.[attr.fieldKey]
                const editVal = rawVal != null ? String(rawVal) : ''
                const pos = layout[idx]
                const isWide = pos.span === COLS
                const isEditing = editing && attr.isEditable
                const isLastRow = pos.row === lastRow
                const isLastCol = pos.col + pos.span >= COLS
                const spanClass = isWide
                  ? 'md:col-span-2 lg:col-span-3'
                  : pos.span === 2 ? 'lg:col-span-2' : ''
                return (
                  <div
                    key={attr.fieldKey}
                    className={`px-4 py-2.5 ${spanClass} ${
                      isLastRow ? '' : 'border-b border-v2-border'
                    } ${isLastCol ? '' : 'lg:border-r border-v2-border'} ${
                      isEditing || isWide ? '' : 'flex items-baseline gap-3'
                    }`}
                  >
                    <dt
                      className={`text-xs text-v2-muted ${
                        isEditing || isWide ? 'mb-1.5' : 'w-24 shrink-0 truncate'
                      }`}
                      title={attr.name}
                    >
                      {attr.name}
                      {attr.unit && <span className="ml-0.5">({attr.unit})</span>}
                      {attr.isRequired && <span className="ml-0.5 text-v2-danger">*</span>}
                    </dt>
                    <dd className={isEditing || isWide ? '' : 'min-w-0 flex-1'}>
                      {attr.fieldType === 'table' ? (
                        isEditing ? (
                          <TableFieldEditor
                            schema={attr.option}
                            rows={Array.isArray(editAttrs[attr.fieldKey])
                              ? (editAttrs[attr.fieldKey] as Record<string, unknown>[])
                              : (Array.isArray(rawVal) ? (rawVal as Record<string, unknown>[]) : [])}
                            onChange={rows => setEditAttrs(a => ({ ...a, [attr.fieldKey]: rows }))}
                          />
                        ) : (
                          <TableFieldDisplay schema={attr.option} rows={Array.isArray(rawVal) ? rawVal as Record<string, unknown>[] : []} />
                        )
                      ) : isEditing ? (
                        renderEditField(attr, String(editAttrs[attr.fieldKey] ?? editVal),
                          val => setEditAttrs(a => ({ ...a, [attr.fieldKey]: val })))
                      ) : (
                        renderDisplayValue(attr, rawVal)
                      )}
                    </dd>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function renderDisplayValue(attr: CiAttributeVO, rawVal: unknown) {
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

function renderEditField(attr: CiAttributeVO, value: string, onChange: (v: string) => void) {
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
        <SelectTrigger><SelectValue /></SelectTrigger>
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

/**
 * 维保状态徽章（spec §6）。读后端注入的只读派生键 `_maint_status_derived`（active/expiring/expired），
 * 红黄绿标色。无该键（实例未填 maint_expire）则不渲染。
 */
function MaintStatusBadge({ value, expire }: { value: unknown; expire: unknown }) {
  if (typeof value !== 'string' || !value) return null
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: '维保在保', cls: 'border-v2-success-border bg-v2-success-soft text-v2-success' },
    expiring: { label: '即将到期', cls: 'border-v2-warning-border bg-v2-warning-soft text-v2-warning' },
    expired: { label: '已过保', cls: 'border-v2-danger-border bg-v2-danger-soft text-v2-danger' },
  }
  const m = map[value]
  if (!m) return null
  const expireStr = typeof expire === 'string' && expire ? expire.slice(0, 10) : null
  return (
    <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${m.cls}`}>
      {m.label}
      {expireStr && <span className="font-normal opacity-80">· 到期 {expireStr}</span>}
    </div>
  )
}

/**
 * 基线完整度徽章（§6 P2）。读后端注入的 `_baseline_completeness`（0-100 必填字段填充率）。
 * ≥90 绿 / ≥60 黄 / 否则红。无该键（模型无必填字段）则不渲染。
 */
function BaselineBadge({ value }: { value: unknown }) {
  if (typeof value !== 'number') return null
  const cls = value >= 90
    ? 'border-v2-success-border bg-v2-success-soft text-v2-success'
    : value >= 60
      ? 'border-v2-warning-border bg-v2-warning-soft text-v2-warning'
      : 'border-v2-danger-border bg-v2-danger-soft text-v2-danger'
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold ${cls}`}>
      基线完整度 {value}%
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// table 字段（§4.3b）：结构化多值，绕过 §0.12 的 String() 路径，值始终保持对象数组。
// ─────────────────────────────────────────────────────────────
type TableCol = { key: string; name: string; type: string; system?: boolean; required?: boolean; options?: { id: string; name: string }[] }
type TableSchemaT = { row_key?: string; columns?: TableCol[] }

function schemaCols(schema: unknown): TableCol[] {
  if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
    const cols = (schema as TableSchemaT).columns
    if (Array.isArray(cols)) return cols
  }
  return []
}
function rowKeyOf(schema: unknown): string {
  if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
    const rk = (schema as TableSchemaT).row_key
    if (typeof rk === 'string' && rk) return rk
  }
  return 'row_id'
}
function genRowId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** table 只读渲染：表格展示非系统列。 */
function TableFieldDisplay({ schema, rows }: { schema: unknown; rows: Record<string, unknown>[] }) {
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

/** table 编辑：加行/删行，每行隐藏维护 row_id（新行自动生成）。子列仅标量输入（P2）。 */
function TableFieldEditor({
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
                        <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
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
