'use client'

import { useState } from 'react'
import { Button, IconButton, NeutralTooltip } from '@/design-system/figma-neutral/components'
import type { FolderNode } from './types'

export function FolderTreeNode({
  node,
  selectedId,
  onSelect,
  depth,
  canManage,
  canManageAcl,
  onDelete,
  onEdit,
  onEditAcl,
}: {
  node: FolderNode
  selectedId: number | null
  onSelect: (id: number | null) => void
  depth: number
  canManage: boolean
  canManageAcl: boolean
  onDelete: (node: FolderNode) => void
  onEdit: (node: FolderNode) => void
  onEditAcl: (node: FolderNode) => void
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = Boolean(node.children && node.children.length > 0)

  return (
    <div>
      <div
        className="cwgsyw-tree-item"
        data-selected={selectedId === node.id}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {hasChildren ? (
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            icon={<span aria-hidden="true" className={`cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-files-tree__chevron${expanded ? ' is-open' : ''}`} />}
            aria-label={expanded ? '折叠文件夹' : '展开文件夹'}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          />
        ) : (
          <span className="cwgsyw-files-tree__leaf" aria-hidden="true" />
        )}
        <NeutralTooltip content={node.name} className="cwgsyw-tooltip--pill" side="right">
          <Button type="button" variant="ghost" size="sm" className="cwgsyw-files-tree__name" onClick={() => onSelect(node.id)}>
            <span className="cwgsyw-files-tree__label">{node.name}</span>
            {node.aclCustom ? <span className="cwgsyw-files-tree__acl">自定义</span> : null}
          </Button>
        </NeutralTooltip>
        <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions cwgsyw-tree-item__actions">
          {canManageAcl && node.canManageAcl ? (
            <NeutralTooltip content="权限" className="cwgsyw-tooltip--pill" followCursor>
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--settings" />}
                aria-label={`设置 ${node.name} 权限`}
                onClick={() => onEditAcl(node)}
              />
            </NeutralTooltip>
          ) : null}
          {node.canUpdate ? (
            <NeutralTooltip content="编辑" className="cwgsyw-tooltip--pill" followCursor>
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--edit" />}
                aria-label={`编辑 ${node.name}`}
                onClick={() => onEdit(node)}
              />
            </NeutralTooltip>
          ) : null}
          {canManage && node.canDelete ? (
            <NeutralTooltip content="删除" className="cwgsyw-tooltip--pill" followCursor>
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                className="cwgsyw-cmdb-admin__delete-action"
                icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--trash" />}
                aria-label={`删除 ${node.name}`}
                onClick={() => onDelete(node)}
              />
            </NeutralTooltip>
          ) : null}
        </div>
      </div>
      {expanded && hasChildren
        ? node.children!.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
              canManage={canManage}
              canManageAcl={canManageAcl}
              onDelete={onDelete}
              onEdit={onEdit}
              onEditAcl={onEditAcl}
            />
          ))
        : null}
    </div>
  )
}
