'use client'

import { useState } from 'react'
import type { AttributeAdminItem } from './types'
import { FIELD_TYPES } from './types'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Card,
  Chip,
  NeutralAlertDialog,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

interface AttributeListProps {
  attributes: AttributeAdminItem[]
  canUpdate: boolean
  canDelete: boolean
  onEdit: (attr: AttributeAdminItem) => void
  onDelete: (attr: AttributeAdminItem) => void
}

export function AttributeList({ attributes, canUpdate, canDelete, onEdit, onDelete }: AttributeListProps) {
  const [deleteTarget, setDeleteTarget] = useState<AttributeAdminItem | null>(null)
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
    <div className="cwgsyw-form">
      {Object.entries(grouped)
        .sort(([a], [b]) => {
          if (a === '__ungrouped__') return 1
          if (b === '__ungrouped__') return -1
          return a.localeCompare(b)
        })
        .map(([groupName, attrs]) => (
          <section key={groupName} className="cwgsyw-form">
            <div className="cwgsyw-type-label-sm">{groupName === '__ungrouped__' ? '未分组' : groupName}</div>
            {attrs
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((attr) => (
                <Card key={attr.id} showHeader={false} padding="sm">
                  <div className="cwgsyw-inline-controls">
                    <strong className="cwgsyw-type-title-sm">{attr.name}</strong>
                    <span className="cwgsyw-type-label-xs">{attr.fieldKey}</span>
                    {attr.isBuiltIn ? <StatusBadge label="内置" status="neutral" /> : null}
                  </div>
                  <div className="cwgsyw-type-label-xs">类型：{FIELD_TYPES[attr.fieldType] ?? attr.fieldType}</div>
                  <div className="cwgsyw-inline-controls">
                    <Chip label="必填" selected={attr.isRequired} />
                    <Chip label="实例可编辑" selected={attr.isEditable} />
                    <Chip label="唯一" selected={attr.isUnique} />
                    <Chip label="列表显示" selected={attr.isListShow} />
                    <Chip label="详情表单显示" selected={attr.isDrawerShow} />
                  </div>
                  {(canUpdate || canDelete) ? (
                    <div className="cwgsyw-inline-controls">
                      {canUpdate ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(attr)}>
                          编辑
                        </Button>
                      ) : null}
                      {canDelete && !attr.isBuiltIn ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteTarget(attr)}>
                          删除
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              ))}
          </section>
        ))}

      <NeutralAlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="确认删除属性"
        description={`确认删除属性「${deleteTarget?.name ?? ''}」？此操作不可恢复。`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
