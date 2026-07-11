'use client'

import { useState } from 'react'
import { FolderOpen, Folder, ChevronRight, Lock, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FolderNode } from './types'

export function FolderTreeNode({
  node,
  selectedId,
  onSelect,
  depth,
  canManage,
  canManageAcl,
  onDelete,
  onEditAcl,
}: {
  node: FolderNode
  selectedId: number | null
  onSelect: (id: number | null) => void
  depth: number
  canManage: boolean
  canManageAcl: boolean
  onDelete: (node: FolderNode) => void
  onEditAcl: (node: FolderNode) => void
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div>
      <div
        className={cn(
          'group flex w-full items-center gap-1.5 rounded-md pr-1 text-sm transition-colors',
          selectedId === node.id
            ? 'bg-v2-primary-soft font-semibold text-v2-primary'
            : 'text-v2-fg hover:bg-v2-surface-hover',
        )}
      >
        <button
          onClick={() => {
            onSelect(node.id)
            if (hasChildren) setExpanded((v) => !v)
          }}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {hasChildren ? (
            <ChevronRight
              className={cn('h-3 w-3 shrink-0 transition-transform', expanded && 'rotate-90')}
            />
          ) : (
            <span className="w-3" />
          )}
          {selectedId === node.id ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
          {node.aclCustom && (
            <Lock className="h-3 w-3 shrink-0 text-v2-warn" aria-label="自定义权限" />
          )}
        </button>
        {canManageAcl && node.canManageAcl && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEditAcl(node)
            }}
            title="权限设置"
            className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-v2-muted hover:bg-v2-surface hover:text-v2-fg group-hover:flex"
          >
            <Lock className="h-3.5 w-3.5" />
          </button>
        )}
        {canManage && node.canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(node)
            }}
            title="删除文件夹"
            className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-v2-muted hover:bg-v2-surface hover:text-v2-danger group-hover:flex"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
              canManage={canManage}
              canManageAcl={canManageAcl}
              onDelete={onDelete}
              onEditAcl={onEditAcl}
            />
          ))}
        </div>
      )}
    </div>
  )
}
