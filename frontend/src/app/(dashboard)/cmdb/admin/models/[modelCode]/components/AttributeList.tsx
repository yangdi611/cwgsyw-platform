'use client'

import { useState } from 'react'
import type { AttributeAdminItem } from './types'
import { FIELD_TYPES } from './types'
import '@/design-system/figma-neutral/index.css'
import {
  IconButton,
  NeutralAlertDialog,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'
import { CmdbAdminActionIcon } from '../../../components/CmdbAdminActionIcon'

interface AttributeListProps {
  attributes: AttributeAdminItem[]
  canUpdate: boolean
  canDelete: boolean
  onEdit: (attr: AttributeAdminItem) => void
  onDelete: (attr: AttributeAdminItem) => void
}

export function AttributeList({ attributes, canUpdate, canDelete, onEdit, onDelete }: AttributeListProps) {
  const [deleteTarget, setDeleteTarget] = useState<AttributeAdminItem | null>(null)
  const hasActions = canUpdate || canDelete
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
    <div className="cwgsyw-cmdb-model-detail__groups">
      {Object.entries(grouped)
        .sort(([a], [b]) => {
          if (a === '__ungrouped__') return 1
          if (b === '__ungrouped__') return -1
          return a.localeCompare(b)
        })
        .map(([groupName, attrs]) => (
          <section key={groupName} className="cwgsyw-cmdb-model-detail__group">
            <h2 className="cwgsyw-cmdb-model-detail__group-title">
              {groupName === '__ungrouped__' ? '未分组' : groupName}
            </h2>
            <Table
              className={`cwgsyw-cmdb-table cwgsyw-cmdb-model-detail__attribute-table${hasActions ? ' cwgsyw-cmdb-admin__action-table' : ''}`}
              showSearch={false}
              columns={[
                { key: 'name', label: '属性名称' },
                { key: 'fieldKey', label: '字段标识' },
                { key: 'fieldType', label: '类型' },
                { key: 'flags', label: '配置' },
                ...(hasActions ? [{ key: 'actions', label: '', align: 'right' as const }] : []),
              ]}
              rows={[...attrs]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((attr) => {
                  const flags = [
                    attr.isRequired ? '必填' : null,
                    attr.isEditable ? '实例可编辑' : null,
                    attr.isUnique ? '唯一' : null,
                    attr.isListShow ? '列表显示' : null,
                    attr.isDrawerShow ? '详情显示' : null,
                  ].filter(Boolean).join(' · ')

                  return {
                    id: String(attr.id),
                    cells: {
                      name: (
                        <div className="cwgsyw-inline-controls cwgsyw-cmdb-model-detail__attribute-name">
                          <span>{attr.name}</span>
                          {attr.isBuiltIn ? <StatusBadge label="内置" status="neutral" /> : null}
                        </div>
                      ),
                      fieldKey: <span className="cwgsyw-cmdb-model-detail__field-key">{attr.fieldKey}</span>,
                      fieldType: FIELD_TYPES[attr.fieldType] ?? attr.fieldType,
                      flags: <span className="cwgsyw-cmdb-model-detail__flags-text">{flags || '—'}</span>,
                      actions: hasActions ? (
                        <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions">
                          {canUpdate ? (
                            <IconButton
                              type="button"
                              size="sm"
                              variant="ghost"
                              icon={<CmdbAdminActionIcon name="edit" />}
                              aria-label={`编辑属性 ${attr.name}`}
                              title="编辑"
                              onClick={() => onEdit(attr)}
                            />
                          ) : null}
                          {canDelete ? (
                            <IconButton
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="cwgsyw-cmdb-admin__delete-action"
                              icon={<CmdbAdminActionIcon name="trash" />}
                              aria-label={`删除属性 ${attr.name}`}
                              title={attr.isBuiltIn ? '内置属性不可删除' : '删除'}
                              disabled={attr.isBuiltIn}
                              onClick={() => setDeleteTarget(attr)}
                            />
                          ) : null}
                        </div>
                      ) : null,
                    },
                  }
                })}
            />
          </section>
        ))}

      <NeutralAlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        className="cwgsyw-cmdb-model-detail__delete-dialog"
        icon={<span aria-hidden="true" className="cwgsyw-cmdb-model-detail__delete-alert-icon" />}
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
