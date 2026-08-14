'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CiModelAdminItem } from '@/types/cmdb-model'
import { getModelDisplayName } from './utils'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DropdownMenu,
  NeutralAlertDialog,
  StatusBadge,
} from '@/design-system/figma-neutral/components'
import { useState } from 'react'

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
    <div className={justMoved ? 'cwgsyw-card cwgsyw-card--md cwgsyw-card--selected' : 'cwgsyw-card cwgsyw-card--md'}>
      <div className="cwgsyw-inline-controls">
        <Link href={`/cmdb/admin/models/${model.modelId}`} className="cwgsyw-form" style={{ flex: 1, minWidth: 0 }}>
          <div className="cwgsyw-inline-controls">
            <strong className="cwgsyw-type-title-sm">{displayName}</strong>
            {model.isBuiltIn ? <StatusBadge label="内置" status="neutral" /> : null}
          </div>
          <div className="cwgsyw-type-label-xs">{model.modelId}</div>
        </Link>
        {canShowMenu ? (
          <DropdownMenu
            trigger={
              <Button type="button" variant="ghost" size="sm" aria-label={`${displayName} 操作`}>
                操作
              </Button>
            }
          >
            {canWrite ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => router.push(`/cmdb/admin/models/${model.modelId}`)}>
                打开设置
              </Button>
            ) : null}
            {canRename ? (
              <Button type="button" variant="ghost" size="sm" onClick={onRename}>
                重命名
              </Button>
            ) : null}
            {canWrite ? (
              <div className="cwgsyw-form">
                <div className="cwgsyw-type-label-xs">移动到分类</div>
                {groups.map((group) => (
                  <Button
                    key={group.code}
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={group.code === model.group}
                    onClick={() => onMove(group.code)}
                  >
                    {group.name}
                    {group.code === model.group ? '（当前）' : ''}
                  </Button>
                ))}
              </div>
            ) : null}
            {canCopy ? (
              <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
                复制模型
              </Button>
            ) : null}
            {canDelete && !model.isBuiltIn ? (
              <Button type="button" variant="ghost" size="sm" disabled={deleting} onClick={() => setConfirmDelete(true)}>
                删除模型
              </Button>
            ) : null}
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
