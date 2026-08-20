'use client'

import { useState } from 'react'
import { JsonDiffView } from './JsonDiffView'
import { Badge, Button, StatusBadge } from '@/design-system/figma-neutral/components'

export interface ChangeHistoryV2VO {
  id: number
  action: string
  operatorId: number | null
  operatorName: string | null
  beforeJson: Record<string, unknown> | null
  afterJson: Record<string, unknown> | null
  changedFields: string[] | null
  summary: string | null
  createdAt: string
}

const ACTION_META: Record<string, { label: string; status: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  create_instance: { label: '创建', status: 'success' },
  update_instance: { label: '更新', status: 'warning' },
  delete_instance: { label: '删除', status: 'danger' },
  create_relation: { label: '建立关联', status: 'success' },
  delete_relation: { label: '删除关联', status: 'danger' },
}

export function actionMeta(action: string) {
  return ACTION_META[action] ?? { label: action || '操作', status: 'neutral' as const }
}

interface ChangeRecordItemProps {
  record: ChangeHistoryV2VO
  compact?: boolean
  defaultOpen?: boolean
}

export function ChangeRecordItem({ record, compact = false, defaultOpen = false }: ChangeRecordItemProps) {
  const [open, setOpen] = useState(defaultOpen)
  const meta = actionMeta(record.action)
  const changedFields = record.changedFields ?? []
  const hasDiff = record.beforeJson != null || record.afterJson != null

  return (
    <div className="cwgsyw-stack-list">
      <Button type="button" variant="ghost" className="cwgsyw-inline-controls" onClick={() => setOpen((v) => !v)}>
        <span className="cwgsyw-type-label-sm" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <StatusBadge label={meta.label} status={meta.status} />
        <span className="cwgsyw-type-body-sm">{record.operatorName ?? '系统'}</span>
        <span className="cwgsyw-type-label-sm">{new Date(record.createdAt).toLocaleString('zh-CN')}</span>
      </Button>
      {record.summary ? <p className={compact ? 'cwgsyw-type-label-sm' : 'cwgsyw-type-body-sm'}>{record.summary}</p> : null}
      {open ? (
        <div className="cwgsyw-stack-list">
          {changedFields.length > 0 ? (
            <div className="cwgsyw-inline-controls">
              {changedFields.map((field) => <Badge key={field} label={field} />)}
            </div>
          ) : null}
          {hasDiff ? (
            <JsonDiffView before={record.beforeJson} after={record.afterJson} />
          ) : (
            <p className="cwgsyw-type-label-sm">无变更快照数据</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
