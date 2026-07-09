import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { Pencil, Trash2 } from 'lucide-react'
import { Chip } from './Chip'
import type { CiAttributeVO } from './types'
import { FIELD_TYPES } from './types'

interface AttributeListProps {
  attributes: CiAttributeVO[]
  canManage: boolean
  onEdit: (attr: CiAttributeVO) => void
  onDelete: (attr: CiAttributeVO) => void
}

export function AttributeList({ attributes, canManage, onEdit, onDelete }: AttributeListProps) {
  const grouped = attributes.reduce(
    (acc, attr) => {
      const key = attr.groupName ?? '__ungrouped__'
      if (!acc[key]) acc[key] = []
      acc[key].push(attr)
      return acc
    },
    {} as Record<string, CiAttributeVO[]>,
  )

  return (
    <div className="space-y-6">
      {Object.entries(grouped)
        .sort(([a], [b]) => {
          if (a === '__ungrouped__') return 1
          if (b === '__ungrouped__') return -1
          return a.localeCompare(b)
        })
        .map(([groupName, attrs]) => (
          <div key={groupName}>
            <h3 className="mb-3 text-sm font-bold text-v2-muted">
              {groupName === '__ungrouped__' ? '未分组' : groupName}
            </h3>
            <div className="space-y-2">
              {attrs
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((attr) => (
                  <div
                    key={attr.id}
                    className="flex items-start gap-3 rounded-v2-md border border-v2-border bg-v2-surface p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-semibold text-v2-fg">{attr.displayName}</span>
                        <code className="rounded bg-v2-surface-soft px-1.5 py-0.5 font-v2-mono text-xs text-v2-muted">
                          {attr.fieldKey}
                        </code>
                        {attr.builtIn && (
                          <StatusBadge status="neutral">内置</StatusBadge>
                        )}
                      </div>
                      <div className="mb-2 text-xs text-v2-muted">
                        类型：{FIELD_TYPES[attr.fieldType] ?? attr.fieldType}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Chip label="必填" active={attr.required} />
                        <Chip label="可搜索" active={attr.searchable} />
                        <Chip label="唯一" active={attr.unique} />
                        <Chip label="列表显示" active={attr.inList} />
                        <Chip label="表单显示" active={attr.inForm} />
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(attr)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {!attr.builtIn && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-v2-danger hover:text-v2-danger"
                            onClick={() => {
                              if (
                                confirm(`确认删除属性「${attr.displayName}」？此操作不可恢复。`)
                              ) {
                                onDelete(attr)
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
    </div>
  )
}
