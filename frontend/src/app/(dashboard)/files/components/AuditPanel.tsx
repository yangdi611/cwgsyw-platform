'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, Card, EmptyState, StatusBadge, Table } from '@/design-system/figma-neutral/components'
import type { SharedFileAuditLog } from './types'

const AUDIT_ACTION_LABELS: Record<string, string> = {
  upload: '上传',
  delete: '删除文件',
  create_folder: '新建文件夹',
  delete_folder: '删除文件夹',
  acl_update: '修改权限',
}

const AUDIT_ACTION_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  upload: 'success',
  create_folder: 'success',
  delete: 'danger',
  delete_folder: 'danger',
  acl_update: 'warning',
}

export function AuditPanel() {
  const [open, setOpen] = useState(false)

  const { data } = useQuery<{ data: { records: SharedFileAuditLog[] } }>({
    queryKey: ['shared-file-audit'],
    queryFn: () =>
      api.get('/audit-logs', { params: { module: 'shared_file', page: 1, size: 10 } }).then((response) => response.data),
    enabled: open,
  })

  const records = data?.data?.records ?? []

  return (
    <Card
      title="操作日志"
      headerAction={
        <div className="cwgsyw-inline-controls">
          <Link href="/admin/audit?module=shared_file">查看全部</Link>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((current) => !current)}>
            {open ? '收起' : '展开'}
          </Button>
        </div>
      }
    >
      {open ? (
        <Table
          showSearch={false}
          columns={[
            { key: 'createdAt', label: '时间' },
            { key: 'action', label: '操作' },
            { key: 'target', label: '对象' },
            { key: 'operatorName', label: '操作人' },
            { key: 'remark', label: '备注' },
          ]}
          rows={records.map((record) => ({
            id: String(record.id),
            cells: {
              createdAt: new Date(record.createdAt).toLocaleString('zh-CN'),
              action: (
                <StatusBadge
                  label={AUDIT_ACTION_LABELS[record.action] ?? record.action}
                  status={AUDIT_ACTION_TONE[record.action] ?? 'neutral'}
                />
              ),
              target: `${record.targetType}${record.targetId ? ` #${record.targetId}` : ''}`,
              operatorName: record.operatorName,
              remark: record.remark,
            },
          }))}
          state={records.length === 0 ? 'empty' : 'data'}
          empty={<EmptyState title="暂无操作记录" description="打开后会加载最近的共享文件审计。" showAction={false} />}
        />
      ) : (
        <p className="cwgsyw-type-body-sm">展开后查看最近的上传、删除和权限变更。</p>
      )}
    </Card>
  )
}
