import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { Chip } from '@/components/v2/Chip'
import { Pencil, Trash2 } from 'lucide-react'
import type { AttributeAdminItem } from './types'
import { FIELD_TYPES } from './types'

interface AttributeListProps {
  attributes: AttributeAdminItem[]
  canManage: boolean
  onEdit: (attr: AttributeAdminItem) => void
  onDelete: (attr: AttributeAdminItem) => void
}

export function AttributeList({ attributes, canManage, onEdit, onDelete }: AttributeListProps) {
  const grouped = attributes.reduce(
    (acc, attr) => {
      const key = attr.groupName ?? '__ungrouped__'
      if (!acc[key]) acc[key] = []
      acc[key].push(attr)
      return acc
    },
    {} as Record<string, AttributeAdminItem[]>,
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
                        <span className="font-semibold text-v2-fg">{attr.name}</span>
                        <code className="rounded bg-v2-surface-soft px-1.5 py-0.5 font-v2-mono text-xs text-v2-muted">
                          {attr.fieldKey}
                        </code>
                        {attr.isBuiltIn && (
                          <StatusBadge status="neutral">内置</StatusBadge>
                        )}
                      </div>
                      <div className="mb-2 text-xs text-v2-muted">
                        类型：{FIELD_TYPES[attr.fieldType] ?? attr.fieldType}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Chip active={attr.isRequired}>必填</Chip>
                        <Chip active={attr.isEditable}>实例可编辑</Chip>
                        <Chip active={attr.isUnique}>唯一</Chip>
                        <Chip active={attr.isListShow}>列表显示</Chip>
                        <Chip active={attr.isDrawerShow}>详情表单显示</Chip>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`编辑属性 ${attr.name}`}
                          title={`编辑属性 ${attr.name}`}
                          onClick={() => onEdit(attr)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {!attr.isBuiltIn && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`删除属性 ${attr.name}`}
                            title={`删除属性 ${attr.name}`}
                            className="text-v2-danger hover:text-v2-danger"
                            onClick={() => {
                              if (
                                confirm(`确认删除属性「${attr.name}」？此操作不可恢复。`)
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
