'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CiModelAdminItem } from '@/types/cmdb-model'
import { getModelDisplayName } from './utils'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DropdownMenu,
  IconButton,
  MenuItem,
  NeutralAlertDialog,
  StatusBadge,
} from '@/design-system/figma-neutral/components'
import { useState } from 'react'
import { CmdbAdminModelMenuIcon } from './CmdbAdminModelMenuIcon'
import { CmdbAdminModelMenuItemIcon } from './CmdbAdminModelMenuItemIcon'

interface ModelCardProps {
  model: CiModelAdminItem
  groups: { code: string; name: string }[]
  canWrite: boolean
  canCreate: boolean
  canDelete: boolean
  deleting: boolean
  justMoved: boolean
  onMove: (toCode: string) => void
  onRename: () => void
  onCopy: () => void
  onDelete: () => void
}

export function ModelCard({
  model,
  groups,
  canWrite,
  canCreate,
  canDelete,
  deleting,
  justMoved,
  onMove,
  onRename,
  onCopy,
  onDelete,
}: ModelCardProps) {
  const router = useRouter()
  const canRename = canWrite && !model.isBuiltIn
  const canCopy = canCreate && !model.isBuiltIn
  const canShowMenu = canWrite || canCopy || (canDelete && !model.isBuiltIn)
  const displayName = getModelDisplayName(model)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className={justMoved ? 'cwgsyw-card cwgsyw-card--md cwgsyw-card--selected cwgsyw-cmdb-admin__model-card' : 'cwgsyw-card cwgsyw-card--md cwgsyw-cmdb-admin__model-card'}>
      <div className="cwgsyw-inline-controls">
        <Link href={`/cmdb/admin/models/${model.modelId}`} className="cwgsyw-cmdb-admin__model-link">
          <div className="cwgsyw-inline-controls">
            <span className="cwgsyw-cmdb-admin__model-title">{displayName}</span>
            {model.isBuiltIn ? <StatusBadge label="内置" status="neutral" /> : null}
          </div>
          <span className="cwgsyw-cmdb-admin__model-meta">{model.modelId}</span>
        </Link>
        {canShowMenu ? (
          <DropdownMenu
            trigger={
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                className="cwgsyw-cmdb-admin__model-menu-trigger"
                icon={<CmdbAdminModelMenuIcon />}
                aria-label={`${displayName} 操作`}
                title="操作"
              />
            }
          >
            <div className="cwgsyw-cmdb-admin__model-menu">
              {canWrite ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  role="menuitem"
                  className="cwgsyw-menu-item"
                  onClick={() => router.push(`/cmdb/admin/models/${model.modelId}`)}
                >
                  <span className="cwgsyw-cmdb-admin__model-menu-item-content">
                    <CmdbAdminModelMenuItemIcon name="settings" />
                    <span>打开设置</span>
                  </span>
                </Button>
              ) : null}
              {canRename ? <MenuItem label="重命名" onClick={onRename} /> : null}
              {canCopy ? <MenuItem label="复制模型" onClick={onCopy} /> : null}
              {canWrite && groups.length > 0 ? (
                <>
                  <div className="cwgsyw-cmdb-admin__model-menu-separator" role="separator" />
                  <div className="cwgsyw-cmdb-admin__model-menu-label">
                    <CmdbAdminModelMenuItemIcon name="move" />
                    <span>移动到分类</span>
                  </div>
                  {groups.map((group) => (
                    <MenuItem
                      key={group.code}
                      label={group.name + (group.code === model.group ? '（当前）' : '')}
                      disabled={group.code === model.group}
                      onClick={() => onMove(group.code)}
                    />
                  ))}
                </>
              ) : null}
              {canDelete && !model.isBuiltIn ? (
                <>
                  <div className="cwgsyw-cmdb-admin__model-menu-separator" role="separator" />
                  <MenuItem label="删除模型" type="destructive" disabled={deleting} onClick={() => setConfirmDelete(true)} />
                </>
              ) : null}
            </div>
          </DropdownMenu>
        ) : null}
      </div>
      <NeutralAlertDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="确认删除模型"
        description={`确认删除模型「${displayName}」？删除后该模型的属性定义也会被删除。`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={onDelete}
      />
    </div>
  )
}
