'use client'

import { useState } from 'react'
import { Button, Chip, IconButton } from '@/design-system/figma-neutral/components'
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
        style={{ paddingLeft: `calc(var(--cwgsyw-space-2) + ${depth} * var(--cwgsyw-space-4))` }}
      >
        {hasChildren ? (
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            icon="chevron-right"
            aria-label={expanded ? '折叠文件夹' : '展开文件夹'}
            aria-expanded={expanded}
            className={expanded ? 'rotate-90' : undefined}
            onClick={() => setExpanded((current) => !current)}
          />
        ) : (
          <span className="cwgsyw-type-label-sm" aria-hidden="true">·</span>
        )}
        <Button type="button" variant="ghost" className="cwgsyw-inline-controls" onClick={() => onSelect(node.id)}>
          <span>{node.name}</span>
          {node.aclCustom ? <Chip label="自定义权限" /> : null}
        </Button>
        <div className="cwgsyw-tree-item__actions">
          {canManageAcl && node.canManageAcl ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onEditAcl(node)}>
              权限
            </Button>
          ) : null}
          {node.canUpdate ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(node)}>
              编辑
            </Button>
          ) : null}
          {canManage && node.canDelete ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(node)}>
              删除
            </Button>
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
